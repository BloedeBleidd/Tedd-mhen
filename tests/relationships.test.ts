import { describe, it, expect } from 'vitest';
import { emptyEntry, shiftDate, summarize, type EntrySummary } from '../shared/schema';
import { featureCatalog, featureSeries } from '../shared/features';
import { alignedPairs, analyzeRelationships, blockInterval } from '../shared/relationships';
import { detrend, invertPositive, pearson, ranks, spearman } from '../shared/statistics';
const rows = (n = 90): EntrySummary[] =>
  Array.from({ length: n }, (_, i) => {
    const e = emptyEntry(shiftDate('2026-01-01', i));
    e.stress = Math.sin(i * 0.7) + 4;
    e.wellbeing = Math.sin((i - 1) * 0.7) + 6;
    e.sleep.durationMinutes = 420 + i;
    e.labels = i % 2 ? [] : ['travel'];
    e.illnessSeverity = 0;
    e.sleep.bedtime = '23:59';
    return summarize({ ...e, revision: 1, createdAt: '', updatedAt: '' });
  });
const feature = (id: string) => featureCatalog(rows()).find((f) => f.id === id)!;
describe('Statistical primitives and calendar alignment', () => {
  it('computes centered Pearson and average-rank Spearman, including ties and constants', () => {
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 12);
    expect(ranks([3, 1, 1, 2])).toEqual([4, 1.5, 1.5, 3]);
    expect(spearman([1, 1, 2, 3], [4, 3, 2, 1])).toBeCloseTo(-Math.sqrt(0.9), 12);
    expect(pearson([2, 2, 2], [1, 2, 3])).toBeNull();
    expect(pearson([1, 2], [1, 2])).toBeNull();
    expect(pearson([1, NaN, 3], [1, 2, 3])).toBeNull();
    expect(spearman([1, NaN, 3], [1, 2, 3])).toBeNull();
    expect(spearman([1, 2, 3], [1, 2, Infinity])).toBeNull();
  });
  it('inverts a positive-definite precision matrix and rejects nonpositive pivots', () => {
    const inverse = invertPositive([
      [4, 1],
      [1, 3],
    ]);
    expect(inverse[0][0]).toBeCloseTo(3 / 11, 12);
    expect(inverse[1][1]).toBeCloseTo(4 / 11, 12);
    expect(inverse[0][1]).toBeCloseTo(-1 / 11, 12);
    expect(() => invertPositive([[0]])).toThrow('positive definite');
  });
  it('pairs actual calendar dates and removes a shared linear trend', () => {
    const entries = rows(60).filter((_, i) => i !== 20);
    const pairs = alignedPairs(entries, feature('stress'), feature('wellbeing'), 1, 'daily');
    expect(pairs).toHaveLength(57);
    expect(
      pearson(
        pairs.map((p) => p.x),
        pairs.map((p) => p.y),
      ),
    ).toBeCloseTo(1, 12);
    expect(pairs.some((p) => p.date === '2026-01-22')).toBe(false);
    expect(pairs[0].predictorDate).toBe('2026-01-01');
    expect(detrend([0, 2, 5, 7], [1, 5, 11, 15]).every((x) => Math.abs(x) < 1e-12)).toBe(true);
    expect(() =>
      alignedPairs(entries, feature('stress'), feature('wellbeing'), -1, 'daily'),
    ).toThrow();
  });
  it('requires complete calendar windows and consecutive observations for changes', () => {
    const entries = rows(40).filter((_, i) => i !== 20);
    const values = featureSeries(entries, feature('stress'), 7);
    const day = Date.parse('2026-01-01') / 86400000;
    expect(values.get(day + 5)).toBeNull();
    expect(values.get(day + 6)).not.toBeNull();
    expect(values.get(day + 22)).toBeNull();
    expect(values.get(day + 27)).not.toBeNull();
    const changes = alignedPairs(entries, feature('stress'), feature('wellbeing'), 1, 'changes');
    expect(changes.some((p) => p.date === '2026-01-23')).toBe(false);
    const binary = featureSeries(entries, feature('label:travel'), 28);
    expect(binary.get(day)).toBe(1);
  });
  it('distinguishes absent labels and symptoms from unrecorded context', () => {
    const entries = rows(3);
    entries[0].labels = null;
    entries[0].illnessSeverity = null;
    expect(feature('label:travel').get(entries[0])).toBeNull();
    expect(feature('label:travel').get(entries[1])).toBe(0);
    expect(feature('label:travel').get(entries[2])).toBe(1);
    expect(feature('symptom:cough').get(entries[0])).toBeNull();
    expect(feature('symptom:cough').get(entries[1])).toBe(0);
    expect(feature('trained').get(entries[0])).toBeNull();
    entries[0].trainingStatus = 'rest';
    expect(feature('trained').get(entries[0])).toBe(0);
    const sine = feature('bedtimeSin').get(entries[1])!;
    expect(Math.abs(sine)).toBeLessThan(0.005);
    expect(feature('bedtimeCos').get(entries[1])).toBeGreaterThan(0.999);
  });
  it('calculates derived effort and symptom totals and preserves clock and category semantics', () => {
    const entry = rows(1)[0];
    entry.trainingStatus = 'trained';
    entry.trainingMinutes = 80;
    entry.trainingLoad = 460;
    entry.workoutCount = 2;
    entry.workoutTypes = ['running', 'strength'];
    expect(feature('trainingHours').get(entry)).toBeCloseTo(4 / 3);
    expect(feature('trainingEffort').get(entry)).toBe(5.75);
    expect(feature('workoutCount').get(entry)).toBe(2);
    expect(feature('activity:running').get(entry)).toBe(1);
    expect(feature('activity:swimming').get(entry)).toBe(0);
    entry.trainingLoad = null;
    expect(feature('trainingEffort').get(entry)).toBeNull();
    entry.trainingStatus = 'rest';
    entry.trainingMinutes = 0;
    entry.trainingLoad = 0;
    expect(feature('trainingEffort').get(entry)).toBeNull();
    entry.symptoms = [
      { name: 'cough', severity: 3 },
      { name: 'headache', severity: 4 },
    ];
    expect(feature('symptomCount').get(entry)).toBe(2);
    expect(feature('symptomBurden').get(entry)).toBe(7);
    entry.symptoms = [];
    expect(feature('symptomBurden').get(entry)).toBe(0);
    entry.illnessSeverity = null;
    expect(feature('symptomBurden').get(entry)).toBeNull();
    entry.sleep.wakeTime = '06:00';
    expect(feature('wakeTimeSin').get(entry)).toBeCloseTo(1, 12);
    expect(feature('wakeTimeCos').get(entry)).toBeCloseTo(0, 12);
    entry.sleep.wakeTime = null;
    expect(feature('wakeTimeSin').get(entry)).toBeNull();
    entry.physiology.source = 'garmin';
    entry.physiology.hrvMethod = 'rmssd';
    expect(feature('source:garmin').get(entry)).toBe(1);
    expect(feature('source:apple').get(entry)).toBe(0);
    expect(feature('method:rmssd').get(entry)).toBe(1);
    expect(feature('method:sdnn').get(entry)).toBe(0);
    expect(feature('weekday:3').get(entry)).toBe(1); // 1 January 2026 is Thursday.
    expect(feature('weekday:6').get(entry)).toBe(0);
  });
  it('uses reproducible calendar-block intervals without bridging missing days in pairing', () => {
    const pairs = alignedPairs(rows(70), feature('stress'), feature('wellbeing'), 1, 'daily');
    const a = blockInterval(pairs, 'pearson', 7, 80, 41),
      b = blockInterval(pairs, 'pearson', 7, 80, 41);
    expect(a).toEqual(b);
    expect(a!.interval[0]).toBeCloseTo(1, 12);
    expect(a!.interval[1]).toBeCloseTo(1, 12);
    expect(blockInterval(pairs.slice(0, 20), 'spearman')).toBeNull();
    expect(blockInterval(pairs, 'spearman', 28)).toBeNull();
    expect(
      blockInterval(
        pairs.map((p) => ({ ...p, x: 1 })),
        'pearson',
      ),
    ).toBeNull();
  });
  it('reports rankings and lag profiles without claiming significance and keeps insufficient pairs undefined', () => {
    const result = analyzeRelationships(rows(), {
      target: 'wellbeing',
      predictor: 'stress',
      features: ['stress', 'sleepHours', 'wellbeing'],
      lag: 1,
      view: 'daily',
      method: 'pearson',
      block: 7,
    });
    expect(result.ranking[0].id).toBe('stress');
    expect(result.selected.coefficient).toBeCloseTo(1, 12);
    expect(result.ranking).toHaveLength(2);
    expect(result.lagProfile.find((p) => p.lag === 1)?.coefficient).toBeCloseTo(1, 12);
    const tiny = analyzeRelationships(rows(10), result.settings);
    expect(tiny.selected.coefficient).toBeNull();
    expect(() => analyzeRelationships([...rows(), rows()[0]], result.settings)).toThrow(
      'Duplicate',
    );
  });
});
