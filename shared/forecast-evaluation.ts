export type EvaluatedForecast = {
  observed: number;
  mean: number;
  predictive: [number, number];
};

/** Equal-tailed interval score, Gneiting & Raftery (2007), equation 43. */
export function intervalScore(observed: number, lower: number, upper: number, alpha = 0.05) {
  if (
    ![observed, lower, upper, alpha].every(Number.isFinite) ||
    lower > upper ||
    alpha <= 0 ||
    alpha >= 1
  )
    throw new Error('Invalid interval score inputs.');
  return upper - lower + (2 / alpha) * Math.max(lower - observed, observed - upper, 0);
}

export function evaluateForecasts(rows: EvaluatedForecast[]) {
  if (!rows.length) return null;
  const scores = rows.map((r) => intervalScore(r.observed, ...r.predictive));
  if (rows.some((r) => !Number.isFinite(r.mean))) throw new Error('Invalid forecast mean.');
  const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const errors = rows.map((r) => r.observed - r.mean);
  return {
    version: 'held-out-interval-score-v1',
    alpha: 0.05,
    n: rows.length,
    bias: average(errors),
    meanWidth: average(rows.map((r) => r.predictive[1] - r.predictive[0])),
    intervalScore: average(scores),
  };
}
