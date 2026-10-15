import { describe, it, expect } from 'vitest';
import { evaluateForecasts, intervalScore } from '../shared/forecast-evaluation';

describe('Held-out interval evaluation', () => {
  it('scores interval width and symmetric tail misses against a hand calculation', () => {
    expect(intervalScore(5, 3, 7)).toBe(4);
    expect(intervalScore(3, 3, 7)).toBe(4);
    expect(intervalScore(7, 3, 7)).toBe(4);
    expect(intervalScore(2, 3, 7)).toBe(44);
    expect(intervalScore(8, 3, 7)).toBe(44);
    expect(intervalScore(2, 3, 7, 0.2)).toBe(14);
    expect(intervalScore(5, 5, 5)).toBe(0);
  });
  it('keeps the original measurement units and reports signed forecast error', () => {
    const result = evaluateForecasts([
      { observed: 2, mean: 4, predictive: [3, 7] },
      { observed: 8, mean: 5, predictive: [3, 7] },
      { observed: 5, mean: 5, predictive: [3, 7] },
    ])!;
    expect(result.bias).toBeCloseTo(1 / 3);
    expect(result.meanWidth).toBe(4);
    expect(result.intervalScore).toBeCloseTo(92 / 3);
    expect(result.n).toBe(3);
    expect(intervalScore(20, 30, 70)).toBe(10 * intervalScore(2, 3, 7));
    expect(intervalScore(102, 103, 107)).toBe(intervalScore(2, 3, 7));
  });
  it('does not report empty data as perfect performance and rejects invalid bounds', () => {
    expect(evaluateForecasts([])).toBeNull();
    for (const alpha of [0, 1, -1, NaN]) expect(() => intervalScore(5, 3, 7, alpha)).toThrow();
    expect(() => intervalScore(5, 7, 3)).toThrow();
    expect(() => intervalScore(NaN, 3, 7)).toThrow();
    expect(() =>
      evaluateForecasts([{ observed: 5, mean: Infinity, predictive: [3, 7] }]),
    ).toThrow();
  });
});
