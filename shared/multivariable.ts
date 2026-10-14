import { jStat } from 'jstat';
import { metrics, type MetricKey } from './metrics';
import { dayNumber, type EntrySummary } from './schema';
import { featureCatalog, featureSeries } from './features';
import { dot, invertPositive, mean, pearson, quadratic } from './statistics';
import type { Prior } from './bayes';
export const MULTIVARIABLE_VERSION = 'normal-inverse-gamma-multivariable-direct-v1';
export type ModelSettings = {
  target: MetricKey;
  features: string[];
  horizon: number;
  window: number;
  prior: Prior;
  history: boolean;
  time: boolean;
};
export type ModelRow = {
  origin: string;
  date: string;
  day: number;
  x: (number | null)[];
  y: number | null;
  baseline: number | null;
};
export type Scale = {
  id: string;
  label: string;
  kind: 'numeric' | 'binary';
  center: number;
  scale: number;
  min: number;
  max: number;
};
export function conjugateRegression(X: number[][], y: number[], priorVariance: number[]) {
  if (
    !X.length ||
    X.length !== y.length ||
    X.some((row) => row.length !== priorVariance.length) ||
    [...y, ...X.flat(), ...priorVariance].some((x) => !Number.isFinite(x)) ||
    priorVariance.some((v) => v <= 0)
  )
    throw new Error('Invalid regression design.');
  const p = priorVariance.length,
    precision = Array.from({ length: p }, (_, i) =>
      Array.from({ length: p }, (_, j) => (i === j ? 1 / priorVariance[i] : 0)),
    ),
    cross = Array(p).fill(0);
  for (let n = 0; n < X.length; n++)
    for (let i = 0; i < p; i++) {
      cross[i] += X[n][i] * y[n];
      for (let j = 0; j < p; j++) precision[i][j] += X[n][i] * X[n][j];
    }
  const covariance = invertPositive(precision),
    coefficients = covariance.map((row) => dot(row, cross));
  const residuals = y.map((v, i) => v - dot(X[i], coefficients));
  const alpha = 2 + y.length / 2,
    beta =
      1 +
      0.5 *
        (dot(residuals, residuals) +
          coefficients.reduce((sum, v, i) => sum + (v * v) / priorVariance[i], 0));
  return { coefficients, covariance, alpha, beta, df: 2 * alpha, residuals };
}
export function posteriorPrediction(
  model: ReturnType<typeof conjugateRegression>,
  x: number[],
  center: number,
  scale: number,
) {
  const leverage = Math.max(0, quadratic(x, model.covariance)),
    q = jStat.studentt.inv(0.975, model.df),
    value = center + scale * dot(x, model.coefficients),
    variance = model.beta / model.alpha;
  const credible = q * scale * Math.sqrt(variance * leverage),
    predictive = q * scale * Math.sqrt(variance * (1 + leverage));
  return {
    mean: value,
    credible: [value - credible, value + credible] as [number, number],
    predictive: [value - predictive, value + predictive] as [number, number],
  };
}
export function modelRows(entries: EntrySummary[], settings: ModelSettings) {
  if (![0, 1, 3, 7].includes(settings.horizon) || ![1, 7, 28].includes(settings.window))
    throw new Error('Unsupported horizon or history window.');
  if (new Set(entries.map((e) => e.date)).size !== entries.length)
    throw new Error('Duplicate journal dates.');
  const catalog = featureCatalog(entries),
    lookup = new Map(catalog.map((f) => [f.id, f]));
  const ids = [...new Set(settings.features)].filter((id) => id !== settings.target);
  if (ids.length > 180) throw new Error('Select at most 180 candidate inputs.');
  const features = ids.map((id) => {
    const f = lookup.get(id);
    if (!f) throw new Error(`Unknown predictor: ${id}`);
    return f;
  });
  const series = features.map((f) => featureSeries(entries, f, settings.window)),
    target = featureSeries(entries, lookup.get(settings.target)!, 1);
  const meta = features.map((f) => ({ id: f.id, label: f.label, kind: f.kind }));
  if (settings.history)
    meta.push({
      id: 'history',
      label: settings.horizon ? 'Outcome at forecast origin' : 'Outcome on preceding day',
      kind: 'numeric',
    });
  const rows: ModelRow[] = entries
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const origin = dayNumber(e.date),
        day = origin + settings.horizon,
        baseline = target.get(origin - (settings.horizon === 0 ? 1 : 0)) ?? null,
        x = series.map((s) => s.get(origin) ?? null);
      if (settings.history) x.push(baseline);
      return {
        origin: e.date,
        date: new Date(day * 86400000).toISOString().slice(0, 10),
        day,
        x,
        y: target.get(day) ?? null,
        baseline,
      };
    });
  return { rows, meta };
}
export function fitMultivariable(entries: EntrySummary[], settings: ModelSettings) {
  const { rows, meta } = modelRows(entries, settings),
    spec = metrics[settings.target];
  const observed = rows.filter((r) => r.y !== null),
    cut = Math.floor(observed.length * 0.8);
  // A training outcome must predate the first validation origin, not merely its outcome date.
  const validationOrigin = observed[cut]?.origin;
  const trainingPool = validationOrigin ? observed.filter((r) => r.date < validationOrigin) : [];
  const screening = trainingPool.length >= 20 ? trainingPool : observed;
  const dropped: { id: string; label: string; reason: string }[] = [],
    indices: number[] = [],
    scales: Scale[] = [];
  for (let i = 0; i < meta.length; i++) {
    const values = screening.flatMap((r) => (r.x[i] === null ? [] : [r.x[i]!]));
    if (values.length < Math.max(14, Math.ceil(screening.length * 0.8))) {
      dropped.push({
        ...meta[i],
        reason: 'Fewer than 14 known values or less than 80% coverage in the screening period.',
      });
      continue;
    }
    const center = mean(values),
      scale = Math.sqrt(mean(values.map((v) => (v - center) ** 2)));
    if (scale < 1e-8) {
      dropped.push({ ...meta[i], reason: 'No variation in the screening period.' });
      continue;
    }
    if (
      meta[i].kind === 'binary' &&
      (values.filter((v) => v === 1).length < 5 || values.filter((v) => v === 0).length < 5)
    ) {
      dropped.push({
        ...meta[i],
        reason: 'Fewer than 5 present or 5 absent observations in the screening period.',
      });
      continue;
    }
    indices.push(i);
    scales.push({ ...meta[i], center, scale, min: Math.min(...values), max: Math.max(...values) });
  }
  const complete = (r: ModelRow) => indices.every((i) => r.x[i] !== null);
  const usable = observed.filter(complete),
    p = indices.length + 1 + Number(settings.time),
    minimum = Math.max(30, 2 * p);
  const base = {
    version: MULTIVARIABLE_VERSION,
    settings,
    dropped,
    selected: meta.length,
    active: indices.length,
    observed: observed.length,
    n: usable.length,
    excluded: observed.length - usable.length,
    minimum,
  };
  if (!indices.length)
    return {
      ...base,
      ready: false as const,
      reason:
        'No selected input has enough coverage and variation. Choose other inputs or record more observations.',
    };
  if (indices.length > 80)
    return {
      ...base,
      ready: false as const,
      reason: 'More than 80 active inputs. Select fewer inputs before fitting.',
    };
  if (usable.length < minimum)
    return {
      ...base,
      ready: false as const,
      reason: `${usable.length} complete observations; at least ${minimum} required for ${p} coefficients. This is a display threshold, not a guarantee of reliability.`,
    };
  if (
    indices.some((idx) => {
      const values = usable.map((r) => r.x[idx]!);
      return Math.max(...values) - Math.min(...values) < 1e-8;
    })
  )
    return {
      ...base,
      ready: false as const,
      reason:
        'An input becomes constant after incomplete rows are removed. Select fewer inputs or a wider period.',
    };
  const midpoint = (usable[0].day + usable.at(-1)!.day) / 2;
  const encode = (r: ModelRow, parameters: Scale[] = scales, centerDay = midpoint) => [
    1,
    ...(settings.time ? [(r.day - centerDay) / 7] : []),
    ...indices.map((idx, j) => (r.x[idx]! - parameters[j].center) / parameters[j].scale),
  ];
  const priorVariance = [
    10,
    ...Array(p - 1).fill({ weak: 10, regular: 1, strong: 0.1 }[settings.prior]),
  ];
  const fit = (data: ModelRow[], parameters: Scale[] = scales, centerDay = midpoint) =>
    conjugateRegression(
      data.map((r) => encode(r, parameters, centerDay)),
      data.map((r) => (r.y! - spec.center) / spec.scale),
      priorVariance,
    );
  const train = trainingPool.filter(complete),
    test = validationOrigin
      ? observed.filter((r) => r.origin >= validationOrigin && complete(r))
      : [];
  let validation: null | {
    trainN: number;
    n: number;
    excluded: number;
    lastTrainingOutcome: string;
    firstValidationOrigin: string;
    mae: number;
    rmse: number;
    meanBaselineMae: number;
    persistenceMae: number | null;
    persistenceN: number;
    matchedModelMae: number | null;
    coverage: number;
    predictions: { date: string; observed: number; mean: number; predictive: [number, number] }[];
  } = null;
  if (train.length >= minimum && test.length >= 7) {
    const trainingMidpoint = (train[0].day + train.at(-1)!.day) / 2,
      trainingModel = fit(train, scales, trainingMidpoint),
      predictions = test.map((r) => ({
        ...posteriorPrediction(
          trainingModel,
          encode(r, scales, trainingMidpoint),
          spec.center,
          spec.scale,
        ),
        date: r.date,
        observed: r.y!,
      })),
      errors = predictions.map((r) => r.observed - r.mean),
      constant = mean(train.map((r) => r.y!)),
      baselineRows = test.filter((r) => r.baseline !== null);
    validation = {
      trainN: train.length,
      n: test.length,
      excluded: observed.filter((r) => r.origin >= validationOrigin!).length - test.length,
      lastTrainingOutcome: train.at(-1)!.date,
      firstValidationOrigin: validationOrigin!,
      mae: mean(errors.map(Math.abs)),
      rmse: Math.sqrt(mean(errors.map((e) => e * e))),
      meanBaselineMae: mean(test.map((r) => Math.abs(r.y! - constant))),
      persistenceMae: baselineRows.length
        ? mean(baselineRows.map((r) => Math.abs(r.y! - r.baseline!)))
        : null,
      persistenceN: baselineRows.length,
      matchedModelMae: baselineRows.length
        ? mean(
            baselineRows.map((r) =>
              Math.abs(
                r.y! -
                  posteriorPrediction(
                    trainingModel,
                    encode(r, scales, trainingMidpoint),
                    spec.center,
                    spec.scale,
                  ).mean,
              ),
            ),
          )
        : null,
      coverage: mean(
        predictions.map((r) =>
          Number(r.observed >= r.predictive[0] && r.observed <= r.predictive[1]),
        ),
      ),
      predictions,
    };
  }
  // Refit descriptive/future coefficients on all complete selected rows; validation stays separate.
  const finalScales = scales.map((s, j) => {
    const values = usable.map((r) => r.x[indices[j]]!);
    const center = mean(values);
    return {
      ...s,
      center,
      scale: Math.sqrt(mean(values.map((v) => (v - center) ** 2))),
      min: Math.min(...values),
      max: Math.max(...values),
    };
  });
  const model = fit(usable, finalScales),
    q = jStat.studentt.inv(0.975, model.df),
    offset = 1 + Number(settings.time);
  const coefficients = finalScales
    .map((s, i) => {
      const k = i + offset,
        value = (model.coefficients[k] * spec.scale) / s.scale,
        se =
          (Math.sqrt((model.beta / model.alpha) * model.covariance[k][k]) * spec.scale) / s.scale;
      return {
        ...s,
        value,
        interval: [value - q * se, value + q * se] as [number, number],
        typicalChange: model.coefficients[k] * spec.scale,
        probabilityPositive: jStat.studentt.cdf(value / se, model.df),
      };
    })
    .sort((a, b) => Math.abs(b.typicalChange) - Math.abs(a.typicalChange));
  const curve = usable.map((r) => ({
    ...posteriorPrediction(model, encode(r, finalScales), spec.center, spec.scale),
    date: r.date,
    observed: r.y,
    forecast: false,
  }));
  const latest = rows.at(-1),
    future =
      latest && complete(latest)
        ? {
            ...posteriorPrediction(model, encode(latest, finalScales), spec.center, spec.scale),
            date: latest.date,
            origin: latest.origin,
            observed: latest.y,
            forecast: latest.y === null,
            inputs: finalScales.map((s, i) => ({
              id: s.id,
              label: s.label,
              value: latest.x[indices[i]]!,
              outsideRange: latest.x[indices[i]]! < s.min || latest.x[indices[i]]! > s.max,
            })),
          }
        : null;
  const collinear: { a: string; b: string; r: number }[] = [];
  for (let i = 0; i < indices.length; i++)
    for (let j = 0; j < i; j++) {
      const r = pearson(
        usable.map((row) => row.x[indices[i]]!),
        usable.map((row) => row.x[indices[j]]!),
      );
      if (r !== null && Math.abs(r) > 0.95)
        collinear.push({ a: finalScales[i].label, b: finalScales[j].label, r });
    }
  const residualPairs = usable.flatMap((r, i) =>
    i && r.day - usable[i - 1].day === 1 ? [[model.residuals[i - 1], model.residuals[i]]] : [],
  );
  const residualCorrelation =
    residualPairs.length >= 7
      ? pearson(
          residualPairs.map((p) => p[0]),
          residualPairs.map((p) => p[1]),
        )
      : null;
  return {
    ...base,
    ready: true as const,
    coefficients,
    validation,
    curve,
    future,
    collinear,
    residualCorrelation,
    residualPairs: residualPairs.length,
    boundaryWarning: [...curve, ...(future ? [future] : [])].some(
      (p) => p.predictive[0] < spec.min || p.predictive[1] > spec.max,
    ),
    posterior: model,
    scales: finalScales,
    midpoint,
    priorVariance,
    rows: usable.map((r) => ({
      origin: r.origin,
      date: r.date,
      x: indices.map((i) => r.x[i]!),
      y: r.y,
    })),
    validationUnavailableReason: validation
      ? null
      : `Temporal validation needs ${minimum} complete training rows and 7 later rows, with a ${settings.horizon}-day separation. Current: ${train.length} training / ${test.length} later rows.`,
  };
}
