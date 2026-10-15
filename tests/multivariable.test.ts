import { describe, it, expect } from 'vitest';
import {
  conjugateRegression,
  fitMultivariable,
  modelRows,
  posteriorPrediction,
  type ModelSettings,
} from '../shared/multivariable';
import { emptyEntry, shiftDate, summarize } from '../shared/schema';
const settings: ModelSettings = {
  target: 'wellbeing',
  features: ['stress', 'sleepHours', 'label:late meal'],
  horizon: 1,
  window: 1,
  history: false,
  time: true,
  prior: 'regular',
};
const fixture = (n = 180) =>
  Array.from({ length: n }, (_, i) => {
    const e = emptyEntry(shiftDate('2026-01-01', i));
    e.stress = 3 + 2 * Math.sin(i * 1.31);
    e.sleep.durationMinutes = 420 + 60 * Math.cos(i * 0.43);
    e.wellbeing =
      3 +
      0.6 * (3 + 2 * Math.sin((i - 1) * 1.31)) +
      0.2 * (7 + Math.cos((i - 1) * 0.43)) -
      0.4 * Number((i - 1) % 3 === 0) +
      0.05 * Math.sin(i * 2.1);
    e.labels = i % 3 === 0 ? ['late meal'] : [];
    e.motivation = 7;
    return summarize({ ...e, revision: 1, createdAt: '', updatedAt: '' });
  });
describe('Multivariable Normal–Inverse-Gamma model', () => {
  it('matches an independently derived orthogonal three-coefficient posterior', () => {
    const model = conjugateRegression(
      [
        [1, -1, -1],
        [1, -1, 1],
        [1, 1, -1],
        [1, 1, 1],
      ],
      [-2, 0, 0, 2],
      [10, 1, 1],
    );
    expect(model.coefficients[0]).toBeCloseTo(0, 12);
    expect(model.coefficients[1]).toBeCloseTo(0.8, 12);
    expect(model.coefficients[2]).toBeCloseTo(0.8, 12);
    expect(model.covariance[0][0]).toBeCloseTo(10 / 41, 12);
    expect(model.covariance[1][1]).toBeCloseTo(0.2, 12);
    expect(model.alpha).toBe(4);
    expect(model.beta).toBeCloseTo(1.8, 12);
    const prediction = posteriorPrediction(model, [1, 2, 3], 0, 1);
    expect(prediction.mean).toBeCloseTo(4, 12);
    expect(prediction.predictive[1]).toBeGreaterThan(prediction.credible[1]);
    const half = 2.306004135204166 * Math.sqrt((1.8 / 4) * (1 + 10 / 41 + 13 / 5));
    expect(prediction.predictive[1] - 4).toBeCloseTo(half, 6);
  });
  it('keeps collinear designs finite through a proper prior and validates the matrix', () => {
    const model = conjugateRegression(
      [
        [1, 1, 1],
        [1, 2, 2],
        [1, 3, 3],
      ],
      [1, 2, 3],
      [10, 1, 1],
    );
    expect(model.coefficients.every(Number.isFinite)).toBe(true);
    expect(model.coefficients[1]).toBeCloseTo(model.coefficients[2], 12);
    expect(() => conjugateRegression([[1, NaN]], [1], [1, 1])).toThrow();
  });
  it('learns numeric and categorical associations, predicts a calendar horizon and beats persistence on synthetic known structure', () => {
    const fit = fitMultivariable(fixture(), settings);
    expect(fit.ready).toBe(true);
    if (!fit.ready) return;
    expect(fit.coefficients.find((c) => c.id === 'stress')!.value).toBeCloseTo(0.6, 1);
    expect(fit.coefficients.find((c) => c.id === 'label:late meal')!.value).toBeLessThan(-0.2);
    expect(fit.future!.date).toBe(shiftDate(fixture().at(-1)!.date, 1));
    expect(fit.future!.observed).toBeNull();
    expect(fit.validation!.lastTrainingOutcome < fit.validation!.firstValidationOrigin).toBe(true);
    expect(fit.validation!.mae).toBeLessThan(fit.validation!.persistenceMae!);
    expect(fit.validation!.coverage).toBeGreaterThanOrEqual(0);
    expect(
      fit.curve.every((p) => p.predictive[1] - p.predictive[0] > p.credible[1] - p.credible[0]),
    ).toBe(true);
  });
  it('does not let held-out outcome values affect earlier predictions or preprocessing', () => {
    const entries = fixture(),
      first = fitMultivariable(entries, settings);
    if (!first.ready) throw new Error('Expected model');
    const cutoff = first.validation!.firstValidationOrigin;
    const changed = entries.map((e) => (e.date >= cutoff ? { ...e, wellbeing: 1000 } : e)),
      second = fitMultivariable(changed, settings);
    if (!second.ready) throw new Error('Expected model');
    expect(second.validation!.predictions.map((p) => p.mean)).toEqual(
      first.validation!.predictions.map((p) => p.mean),
    );
    expect(second.validation!.mae).toBeGreaterThan(first.validation!.mae);
  });
  it('excludes target leakage, honors missing calendar days and keeps unknown inputs unknown', () => {
    const rows = modelRows(fixture(10), {
      ...settings,
      horizon: 0,
      features: ['wellbeing', 'stress'],
      history: true,
    });
    expect(rows.meta.map((f) => f.id)).toEqual(['stress', 'history']);
    expect(rows.rows[0].x[1]).toBeNull();
    expect(rows.rows[1].x[1]).toBe(fixture(10)[0].wellbeing);
    const entries = fixture().filter((_, i) => i !== 20);
    const prepared = modelRows(entries, settings);
    expect(prepared.rows.find((r) => r.origin === '2026-01-20')!.y).toBeNull();
    const sparse = fitMultivariable(entries, {
      ...settings,
      features: ['temperature', 'motivation'],
    });
    expect(sparse.ready).toBe(false);
    expect(sparse.dropped).toHaveLength(2);
    expect(() => modelRows([...entries, entries[0]], settings)).toThrow('Duplicate');
  });
  it('uses a horizon embargo for validation, reports missing forecasts and rejects undersized fits', () => {
    const entries = fixture(),
      fit = fitMultivariable(entries, { ...settings, horizon: 7 });
    if (!fit.ready) throw new Error('Expected model');
    expect(fit.validation!.lastTrainingOutcome < fit.validation!.firstValidationOrigin).toBe(true);
    entries.at(-1)!.stress = null;
    const missing = fitMultivariable(entries, settings);
    if (!missing.ready) throw new Error('Expected model');
    expect(missing.future).toBeNull();
    expect(fitMultivariable(fixture(20), settings).ready).toBe(false);
  });
  it('screens rare and future-only labels using the training period and compares matched baselines', () => {
    const entries = fixture();
    for (let i = 0; i < entries.length; i++) {
      if (i < 4) entries[i].labels!.push('rare');
      if (i >= 150) entries[i].labels!.push('future only');
      if (i % 10 === 0) entries[i].wellbeing = null;
    }
    const fit = fitMultivariable(entries, {
      ...settings,
      features: [...settings.features, 'label:rare', 'label:future only'],
    });
    if (!fit.ready || !fit.validation) throw new Error('Expected model and holdout');
    expect(fit.dropped.find((f) => f.id === 'label:rare')?.reason).toContain('Fewer than 5');
    expect(fit.dropped.find((f) => f.id === 'label:future only')?.reason).toContain('No variation');
    const lookup = new Map(entries.map((e) => [e.date, e.wellbeing]));
    const paired = fit.validation.predictions.filter(
      (p) => lookup.get(shiftDate(p.date, -1)) != null,
    );
    expect(paired.length).toBe(fit.validation.persistenceN);
    expect(fit.validation.matchedModelMae).toBeCloseTo(
      paired.reduce((sum, p) => sum + Math.abs(p.observed - p.mean), 0) / paired.length,
      12,
    );
    expect(fit.validation.persistenceN).toBeLessThan(fit.validation.n);
  });
});

it.each([14, 28])('uses an embargo and calendar targets at the %i-day horizon', (horizon) => {
  const entries = fixture(240);
  const long = { ...settings, horizon };
  const fit = fitMultivariable(entries, long);
  if (!fit.ready || !fit.validation) throw new Error('Expected long-horizon holdout');
  expect(fit.validation.lastTrainingOutcome < fit.validation.firstValidationOrigin).toBe(true);
  expect(fit.future!.date).toBe(shiftDate(entries.at(-1)!.date, horizon));
  expect(fit.validation.evaluation.n).toBe(fit.validation.n);
  expect(fit.validation.evaluation.intervalScore).toBeGreaterThanOrEqual(
    fit.validation.evaluation.meanWidth,
  );
  const changed = entries.map((e) =>
    e.date >= fit.validation!.firstValidationOrigin ? { ...e, wellbeing: 100 } : e,
  );
  const second = fitMultivariable(changed, long);
  if (!second.ready || !second.validation) throw new Error('Expected holdout');
  expect(second.validation.predictions.map((p) => p.mean)).toEqual(
    fit.validation.predictions.map((p) => p.mean),
  );
  expect(second.validation.evaluation.intervalScore).toBeGreaterThan(
    fit.validation.evaluation.intervalScore,
  );
  const sparse = modelRows(
    entries.filter((_, i) => i !== horizon),
    long,
  );
  expect(sparse.rows[0].y).toBeNull();
});
