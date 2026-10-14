import { jStat } from 'jstat';
import { dayNumber, shiftDate, type EntrySummary } from './schema';
import { metrics, type MetricKey } from './metrics';

export type Observation = { date: string; value: number };
export type Prior = 'weak' | 'regular' | 'strong';
export type Prediction = {
  date: string;
  mean: number;
  credible: [number, number];
  predictive: [number, number];
  observed: number | null;
  forecast: boolean;
};
export const MODEL_VERSION = 'normal-inverse-gamma-linear-v1';
export const MIN_OBSERVATIONS = 14;

/** Exact conjugate Bayesian linear regression, no MCMC or random approximation.
 * y is scaled with fixed metric constants, x is elapsed weeks centered in the window.
 * sigma² ~ InvGamma(2, 1); beta | sigma² ~ N(0, sigma² diag(10, slopeVariance)).
 */
export function fitTrend(
  observations: Observation[],
  metric: MetricKey,
  prior: Prior = 'regular',
  horizon = 7,
) {
  const sorted = observations
    .filter((o) => Number.isFinite(o.value))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < MIN_OBSERVATIONS) return null;
  if (new Set(sorted.map((o) => o.date)).size !== sorted.length)
    throw new Error('One observation per calendar day is required.');
  if (!Number.isInteger(horizon) || horizon < 0 || horizon > 7)
    throw new Error('Forecast horizon must be 0–7 days.');
  const spec = metrics[metric];
  const firstDay = dayNumber(sorted[0].date),
    lastDay = dayNumber(sorted.at(-1)!.date);
  const midpoint = (firstDay + lastDay) / 2;
  const points = sorted.map((o) => ({
    x: (dayNumber(o.date) - midpoint) / 7,
    y: (o.value - spec.center) / spec.scale,
  }));
  const slopeVariance = { weak: 10, regular: 1, strong: 0.1 }[prior];
  const p00 = 0.1 + points.length;
  const p01 = points.reduce((s, p) => s + p.x, 0);
  const p11 = 1 / slopeVariance + points.reduce((s, p) => s + p.x * p.x, 0);
  const det = p00 * p11 - p01 * p01;
  const v00 = p11 / det,
    v01 = -p01 / det,
    v11 = p00 / det;
  const t0 = points.reduce((s, p) => s + p.y, 0),
    t1 = points.reduce((s, p) => s + p.x * p.y, 0);
  const m0 = v00 * t0 + v01 * t1,
    m1 = v01 * t0 + v11 * t1;
  const alpha = 2 + points.length / 2;
  // Residual + prior penalty form avoids catastrophic cancellation in y'y - m'Pm.
  const residuals = points.map((p) => p.y - m0 - m1 * p.x);
  const beta =
    1 +
    0.5 * (residuals.reduce((s, e) => s + e * e, 0) + 0.1 * m0 * m0 + (m1 * m1) / slopeVariance);
  const df = 2 * alpha,
    variance = beta / alpha;
  const quantile = jStat.studentt.inv(0.975, df);
  const slope = m1 * spec.scale,
    slopeScale = Math.sqrt(variance * v11) * spec.scale;
  const probabilityIncreasing = slope === 0 ? 0.5 : jStat.studentt.cdf(slope / slopeScale, df);
  const observed = new Map(sorted.map((o) => [o.date, o.value]));
  const curve: Prediction[] = [];
  for (let day = firstDay; day <= lastDay + horizon; day++) {
    const date = shiftDate(sorted[0].date, day - firstDay);
    const x = (day - midpoint) / 7;
    const leverage = v00 + 2 * x * v01 + x * x * v11;
    const mean = spec.center + spec.scale * (m0 + m1 * x);
    const credibleWidth = quantile * spec.scale * Math.sqrt(variance * leverage);
    const predictiveWidth = quantile * spec.scale * Math.sqrt(variance * (1 + leverage));
    curve.push({
      date,
      mean,
      credible: [mean - credibleWidth, mean + credibleWidth],
      predictive: [mean - predictiveWidth, mean + predictiveWidth],
      observed: observed.get(date) ?? null,
      forecast: day > lastDay,
    });
  }
  // Only consecutive calendar days enter the lag-one diagnostic.
  const pairs: [number, number][] = [];
  sorted.forEach((o, i) => {
    if (i && dayNumber(o.date) - dayNumber(sorted[i - 1].date) === 1)
      pairs.push([residuals[i - 1], residuals[i]]);
  });
  let residualAutocorrelation: number | null = null;
  if (pairs.length >= 7) {
    const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length,
      my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
    const numerator = pairs.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
    const denominator = Math.sqrt(
      pairs.reduce((s, p) => s + (p[0] - mx) ** 2, 0) *
        pairs.reduce((s, p) => s + (p[1] - my) ** 2, 0),
    );
    if (denominator > 1e-10) residualAutocorrelation = numerator / denominator;
  }
  return {
    modelVersion: MODEL_VERSION,
    n: sorted.length,
    days: lastDay - firstDay + 1,
    firstDate: sorted[0].date,
    lastDate: sorted.at(-1)!.date,
    slope,
    slopeInterval: [slope - quantile * slopeScale, slope + quantile * slopeScale] as [
      number,
      number,
    ],
    probabilityIncreasing,
    curve,
    residualAutocorrelation,
    residualPairs: pairs.length,
    boundaryWarning: curve.some((p) => p.predictive[0] < spec.min || p.predictive[1] > spec.max),
    prior: {
      alpha: 2,
      beta: 1,
      interceptVariance: 10,
      slopeVariance,
      center: spec.center,
      scale: spec.scale,
    },
    posterior: { alpha, beta, mean: [m0, m1], covarianceScale: [v00, v01, v11], df },
  };
}
export function observationsFor(entries: EntrySummary[], metric: MetricKey): Observation[] {
  return entries.flatMap((entry) => {
    const value = metrics[metric].get(entry);
    return value === null ? [] : [{ date: entry.date, value }];
  });
}
