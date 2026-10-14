import { describe, expect, it } from 'vitest';
import { fitTrend } from '../shared/bayes';
import { shiftDate } from '../shared/schema';
const points = (n: number, value: (i: number) => number, spacing = 1) =>
  Array.from({ length: n }, (_, i) => ({
    date: shiftDate('2026-01-01', i * spacing),
    value: value(i),
  }));
describe('Exact Normal–Inverse-Gamma trend', () => {
  it('does not report an inferred trend below the observation threshold', () => {
    expect(
      fitTrend(
        points(13, () => 7),
        'wellbeing',
      ),
    ).toBeNull();
  });
  it('matches a hand-derived conjugate posterior for centered linear observations', () => {
    // n=14, x=(i-6.5)/7, z=0.1(i-6.5); Σx²=65/14, Σxz=13/4, Σz²=91/40.
    // V11=14/79; m1=91/158; a=9; b=1+(91/40-(91/158)*(13/4))/2.
    const fit = fitTrend(
      points(14, (i) => 5.5 + 0.2 * (i - 6.5)),
      'wellbeing',
    )!;
    expect(fit.posterior.mean[0]).toBeCloseTo(0, 12);
    expect(fit.posterior.mean[1]).toBeCloseTo(91 / 158, 12);
    expect(fit.posterior.covarianceScale[2]).toBeCloseTo(14 / 79, 12);
    expect(fit.posterior.alpha).toBe(9);
    expect(fit.posterior.beta).toBeCloseTo(1 + (91 / 40 - (91 / 158) * (13 / 4)) / 2, 12);
    expect(fit.slope).toBeCloseTo(91 / 79, 12);
    // Independent Student-t 0.975 quantile at 18 degrees of freedom.
    const halfWidth = 2.10092204024096 * 2 * Math.sqrt((fit.posterior.beta / 9) * (14 / 79));
    expect(fit.slopeInterval[1] - fit.slope).toBeCloseTo(halfWidth, 6);
  });
  it('uses real elapsed time rather than the ordinal index of recorded rows', () => {
    const daily = fitTrend(
      points(30, (i) => 5 + i * 0.1),
      'wellbeing',
      'weak',
    )!;
    const spaced = fitTrend(
      points(30, (i) => 5 + i * 0.1, 2),
      'wellbeing',
      'weak',
    )!;
    expect(daily.slope / spaced.slope).toBeCloseTo(2, 2);
    expect(spaced.days).toBe(59);
    expect(spaced.curve.filter((p) => p.observed === null && !p.forecast)).toHaveLength(29);
  });
  it('separates uncertainty of the mean from a new observation and keeps finite constant-data results', () => {
    const fit = fitTrend(
      points(28, () => 5.5),
      'wellbeing',
    )!;
    expect(fit.slope).toBe(0);
    expect(fit.probabilityIncreasing).toBeCloseTo(0.5, 12);
    for (const p of fit.curve) {
      expect(Number.isFinite(p.mean)).toBe(true);
      expect(p.predictive[0]).toBeLessThan(p.credible[0]);
      expect(p.predictive[1]).toBeGreaterThan(p.credible[1]);
    }
  });
  it('shrinks slopes more strongly under the stronger prior', () => {
    const observations = points(20, (i) => 4 + 0.15 * i);
    expect(fitTrend(observations, 'wellbeing', 'strong')!.slope).toBeLessThan(
      fitTrend(observations, 'wellbeing', 'weak')!.slope,
    );
  });
  it('does not conceal boundary violations by clipping intervals', () => {
    const fit = fitTrend(
      points(14, () => 10),
      'wellbeing',
    )!;
    expect(fit.boundaryWarning).toBe(true);
    expect(Math.max(...fit.curve.map((p) => p.predictive[1]))).toBeGreaterThan(10);
  });
  it('rejects duplicate dates and invalid horizons', () => {
    const data = points(14, (i) => i);
    expect(() => fitTrend([...data, data[0]], 'wellbeing')).toThrow('One observation');
    expect(() => fitTrend(data, 'wellbeing', 'regular', 30)).toThrow('0–7');
  });
});
