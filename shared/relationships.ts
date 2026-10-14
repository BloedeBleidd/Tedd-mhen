import { dayNumber, type EntrySummary } from './schema';
import { featureCatalog, featureSeries, type Feature } from './features';
import type { MetricKey } from './metrics';
import { detrend, pearson, quantile, seededRandom, spearman } from './statistics';
export type RelationshipView = 'daily' | 'changes' | 'detrended' | 'week' | 'month';
export type Pair = { day: number; date: string; predictorDate: string; x: number; y: number };
export type RelationshipSettings = {
  target: MetricKey;
  predictor: string;
  features: string[];
  lag: number;
  view: RelationshipView;
  method: 'pearson' | 'spearman';
  block: number;
};
export const RELATIONSHIP_VERSION = 'calendar-paired-correlations-v1';
export function alignedPairs(
  entries: EntrySummary[],
  predictor: Feature,
  outcome: Feature,
  lag: number,
  view: RelationshipView,
): Pair[] {
  if (!Number.isInteger(lag) || lag < 0 || lag > 28)
    throw new Error('Lag must be 0–28 calendar days.');
  const width = view === 'week' ? 7 : view === 'month' ? 28 : 1;
  const x = featureSeries(entries, predictor, width),
    y = featureSeries(entries, outcome, width);
  const pairs: Pair[] = [];
  for (const entry of entries) {
    const day = dayNumber(entry.date),
      origin = day - lag;
    let a = x.get(origin),
      b = y.get(day);
    if (a == null || b == null) continue;
    if (view === 'changes') {
      const previousX = x.get(origin - 1),
        previousY = y.get(day - 1);
      if (previousX == null || previousY == null) continue;
      a -= previousX;
      b -= previousY;
    }
    pairs.push({
      day,
      date: entry.date,
      predictorDate: new Date(origin * 86400000).toISOString().slice(0, 10),
      x: a,
      y: b,
    });
  }
  if (view === 'detrended' && pairs.length) {
    const days = pairs.map((p) => p.day),
      dx = detrend(
        days,
        pairs.map((p) => p.x),
      ),
      dy = detrend(
        days,
        pairs.map((p) => p.y),
      );
    return pairs.map((p, i) => ({ ...p, x: dx[i], y: dy[i] }));
  }
  return pairs;
}
export function blockInterval(
  pairs: Pair[],
  method: 'pearson' | 'spearman',
  block = 7,
  replicates = 200,
  seed = 20261014,
) {
  if (!Number.isInteger(block) || block < 2 || block > 56) throw new Error('Invalid block length.');
  if (pairs.length < 28) return null;
  const start = Math.min(...pairs.map((p) => p.day)),
    end = Math.max(...pairs.map((p) => p.day)),
    span = end - start + 1;
  if (span < 4 * block) return null;
  const grid = new Map(pairs.map((p) => [p.day - start, p])),
    random = seededRandom(seed),
    estimates: number[] = [];
  const correlate = method === 'pearson' ? pearson : spearman;
  for (let r = 0; r < replicates; r++) {
    const x: number[] = [],
      y: number[] = [];
    for (let i = 0; i < span; i += block) {
      const at = Math.floor(random() * span);
      for (let j = 0; j < Math.min(block, span - i); j++) {
        const point = grid.get((at + j) % span);
        if (point) {
          x.push(point.x);
          y.push(point.y);
        }
      }
    }
    const value = x.length >= 14 ? correlate(x, y) : null;
    if (value !== null) estimates.push(value);
  }
  if (estimates.length < replicates * 0.9) return null;
  estimates.sort((a, b) => a - b);
  return {
    interval: [quantile(estimates, 0.025), quantile(estimates, 0.975)] as [number, number],
    block,
    replicates,
    validReplicates: estimates.length,
    seed,
  };
}
export function analyzeRelationships(entries: EntrySummary[], settings: RelationshipSettings) {
  if (new Set(entries.map((e) => e.date)).size !== entries.length)
    throw new Error('Duplicate journal dates.');
  const catalog = featureCatalog(entries),
    byId = new Map(catalog.map((f) => [f.id, f])),
    outcome = byId.get(settings.target),
    predictor = byId.get(settings.predictor);
  if (!outcome || !predictor) throw new Error('Select recorded, supported variables.');
  if (settings.features.length > 180)
    throw new Error('Select at most 180 relationship candidates.');
  const correlate = settings.method === 'pearson' ? pearson : spearman;
  const summarize = (feature: Feature, lag = settings.lag) => {
    const pairs = alignedPairs(entries, feature, outcome, lag, settings.view);
    return {
      id: feature.id,
      label: feature.label,
      n: pairs.length,
      coefficient:
        pairs.length >= 14
          ? correlate(
              pairs.map((p) => p.x),
              pairs.map((p) => p.y),
            )
          : null,
    };
  };
  const ranking = [...new Set(settings.features)]
    .filter((id) => id !== settings.target && byId.has(id))
    .map((id) => summarize(byId.get(id)!))
    .sort((a, b) => Math.abs(b.coefficient ?? -0) - Math.abs(a.coefficient ?? -0) || b.n - a.n);
  const pairs = alignedPairs(entries, predictor, outcome, settings.lag, settings.view),
    x = pairs.map((p) => p.x),
    y = pairs.map((p) => p.y);
  const selected = {
    ...summarize(predictor),
    pearson: pairs.length >= 14 ? pearson(x, y) : null,
    spearman: pairs.length >= 14 ? spearman(x, y) : null,
  };
  const block = Math.max(
    settings.block,
    settings.view === 'month' ? 28 : settings.view === 'week' ? 7 : 2,
  );
  return {
    version: RELATIONSHIP_VERSION,
    settings,
    selected,
    ranking,
    pairs,
    interval: blockInterval(pairs, settings.method, block),
    lagProfile: [0, 1, 2, 3, 7, 14, 28].map((lag) => ({ ...summarize(predictor, lag), lag })),
    selectedDays: entries.length,
  };
}
