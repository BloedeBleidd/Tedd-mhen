import { jStat } from 'jstat';
import { metrics, type MetricKey } from './metrics';
import { dayNumber, summarize, type Entry, type EntrySummary } from './schema';
import { featureCatalog } from './features';
import { detrend, mean, pearson, quantile } from './statistics';

export const REVIEW_VERSION = 'checkin-history-review-v1';
export const REVIEW_MINIMUM = 30;
export const REVIEW_DAYS = 90;
export type ReviewWarning = {
  kind: 'value' | 'relationship';
  label: string;
  value: number;
  n: number;
  lower: number;
  upper: number;
  predictor?: string;
  predictorValue?: number;
  lag?: number;
  correlation?: number;
};
const relationships: [MetricKey, MetricKey, number][] = [
  ['stress', 'sleepHours', 0],
  ['stress', 'sleepHours', 1],
  ['trainingLoad', 'sleepHours', 1],
  ['sleepHours', 'wellbeing', 0],
  ['sleepHours', 'energy', 0],
  ['stress', 'fatigue', 0],
  ['stress', 'hrv', 0],
  ['trainingLoad', 'soreness', 1],
];
const body = new Set<MetricKey>([
  'hrv',
  'restingHeartRate',
  'respiratoryRate',
  'temperature',
  'bodyWeight',
  'sleepScore',
]);
function comparable(a: EntrySummary, b: EntrySummary, id: string) {
  if (!body.has(id as MetricKey)) return true;
  if (a.physiology.source !== b.physiology.source) return false;
  return (
    id !== 'hrv' ||
    (a.physiology.hrvMethod !== 'unknown' && a.physiology.hrvMethod === b.physiology.hrvMethod)
  );
}
/** Conservative review prompts, never automatic corrections or exclusion rules. */
export function reviewCheckIn(entry: Entry, all: EntrySummary[]) {
  const today = summarize({ ...entry, revision: 0, createdAt: '', updatedAt: '' });
  const day = dayNumber(entry.date);
  const history = all
    .filter((e) => e.date < entry.date && dayNumber(e.date) >= day - REVIEW_DAYS)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const warnings: ReviewWarning[] = [];
  const catalog = featureCatalog([...history, today]).filter(
    (f) => f.kind === 'numeric' && !f.id.endsWith('Sin') && !f.id.endsWith('Cos'),
  );
  for (const feature of catalog) {
    const value = feature.get(today);
    if (value === null || !Number.isFinite(value)) continue;
    const values = history
      .filter((e) => comparable(e, today, feature.id))
      .flatMap((e) => {
        const v = feature.get(e);
        return v === null || !Number.isFinite(v) ? [] : [v];
      })
      .sort((a, b) => a - b);
    if (values.length < REVIEW_MINIMUM) continue;
    const median = quantile(values, 0.5);
    const mad = quantile(
      values.map((v) => Math.abs(v - median)).sort((a, b) => a - b),
      0.5,
    );
    const spec = metrics[feature.id as MetricKey];
    // A scale floor avoids dividing by zero and flagging tiny changes in rounded/constant records.
    const floor = spec ? spec.scale * 0.25 : feature.unit === 'min' ? 5 : 1;
    const spread = Math.max(mad / 0.67448975, floor);
    if (Math.abs(value - median) > 3.5 * spread)
      warnings.push({
        kind: 'value',
        label: feature.label,
        value,
        n: values.length,
        lower: median - 3.5 * spread,
        upper: median + 3.5 * spread,
      });
  }
  const dated = new Map(history.map((e) => [dayNumber(e.date), e]));
  for (const [xId, yId, lag] of relationships) {
    const xSpec = metrics[xId],
      ySpec = metrics[yId];
    const origin = lag ? dated.get(day - lag) : today;
    if (!origin || !comparable(origin, today, xId)) continue;
    const xValue = xSpec.get(origin),
      value = ySpec.get(today);
    if (xValue === null || value === null) continue;
    const pairs = history.flatMap((e) => {
      const from = lag ? dated.get(dayNumber(e.date) - lag) : e;
      if (!from || !comparable(from, today, xId) || !comparable(e, today, yId)) return [];
      const x = xSpec.get(from),
        y = ySpec.get(e);
      return x === null || y === null ? [] : [{ x, y, day: dayNumber(e.date) }];
    });
    if (pairs.length < REVIEW_MINIMUM) continue;
    const xs = pairs.map((p) => p.x),
      ys = pairs.map((p) => p.y),
      days = pairs.map((p) => p.day);
    const r = pearson(xs, ys),
      split = Math.floor(pairs.length / 2);
    const first = pearson(xs.slice(0, split), ys.slice(0, split)),
      last = pearson(xs.slice(split), ys.slice(split));
    const adjusted = pearson(detrend(days, xs), detrend(days, ys));
    if (
      r === null ||
      Math.abs(r) < 0.7 ||
      first === null ||
      last === null ||
      adjusted === null ||
      Math.sign(r) * first < 0.5 ||
      Math.sign(r) * last < 0.5 ||
      Math.sign(r) * adjusted < 0.6 ||
      xValue < Math.min(...xs) ||
      xValue > Math.max(...xs)
    )
      continue;
    const mx = mean(xs),
      my = mean(ys),
      sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    if (sxx < 1e-12) continue;
    const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / sxx;
    const predicted = my + slope * (xValue - mx);
    const variance = Math.max(
      ys.reduce((s, y, i) => s + (y - my - slope * (xs[i] - mx)) ** 2, 0) / (pairs.length - 2),
      (ySpec.scale * 0.25) ** 2,
    );
    const width =
      jStat.studentt.inv(0.9975, pairs.length - 2) *
      Math.sqrt(variance * (1 + 1 / pairs.length + (xValue - mx) ** 2 / sxx));
    if (Math.abs(value - predicted) > width)
      warnings.push({
        kind: 'relationship',
        label: ySpec.label,
        value,
        n: pairs.length,
        lower: predicted - width,
        upper: predicted + width,
        predictor: xSpec.label,
        predictorValue: xValue,
        lag,
        correlation: r,
      });
  }
  return { version: REVIEW_VERSION, historyDays: history.length, warnings };
}
