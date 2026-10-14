export const mean = (values: number[]) => values.reduce((sum, x) => sum + x, 0) / values.length;
export function pearson(x: number[], y: number[]) {
  if (
    x.length !== y.length ||
    x.length < 3 ||
    x.some((v) => !Number.isFinite(v)) ||
    y.some((v) => !Number.isFinite(v))
  )
    return null;
  const mx = mean(x),
    my = mean(y);
  let xx = 0,
    yy = 0,
    xy = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i] - mx,
      b = y[i] - my;
    xx += a * a;
    yy += b * b;
    xy += a * b;
  }
  return xx < 1e-20 || yy < 1e-20 ? null : Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy)));
}
export function ranks(values: number[]) {
  const sorted = values.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value),
    result = Array(values.length).fill(0);
  for (let i = 0; i < sorted.length;) {
    let end = i + 1;
    while (end < sorted.length && sorted[end].value === sorted[i].value) end++;
    const rank = (i + end - 1) / 2 + 1;
    for (let j = i; j < end; j++) result[sorted[j].i] = rank;
    i = end;
  }
  return result as number[];
}
export const spearman = (x: number[], y: number[]) =>
  [...x, ...y].some((v) => !Number.isFinite(v)) ? null : pearson(ranks(x), ranks(y));
export function detrend(days: number[], values: number[]) {
  const md = mean(days),
    mv = mean(values);
  let numerator = 0,
    denominator = 0;
  for (let i = 0; i < days.length; i++) {
    numerator += (days[i] - md) * (values[i] - mv);
    denominator += (days[i] - md) ** 2;
  }
  const slope = denominator ? numerator / denominator : 0;
  return values.map((v, i) => v - mv - slope * (days[i] - md));
}
export function quantile(sorted: number[], p: number) {
  const at = (sorted.length - 1) * p,
    low = Math.floor(at);
  return sorted[low] + (sorted[Math.ceil(at)] - sorted[low]) * (at - low);
}
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
/** Cholesky inversion for positive-definite posterior precision; no unregularized normal equations. */
export function invertPositive(matrix: number[][]) {
  const p = matrix.length,
    L = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < p; i++)
    for (let j = 0; j <= i; j++) {
      let value = matrix[i][j];
      for (let k = 0; k < j; k++) value -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(value > 0) || !Number.isFinite(value))
          throw new Error('Posterior precision is not positive definite.');
        L[i][j] = Math.sqrt(value);
      } else L[i][j] = value / L[j][j];
    }
  const inverse = Array.from({ length: p }, () => Array(p).fill(0));
  for (let column = 0; column < p; column++) {
    const z = Array(p).fill(0),
      x = Array(p).fill(0);
    for (let i = 0; i < p; i++) {
      let value = i === column ? 1 : 0;
      for (let j = 0; j < i; j++) value -= L[i][j] * z[j];
      z[i] = value / L[i][i];
    }
    for (let i = p - 1; i >= 0; i--) {
      let value = z[i];
      for (let j = i + 1; j < p; j++) value -= L[j][i] * x[j];
      x[i] = value / L[i][i];
    }
    for (let i = 0; i < p; i++) inverse[i][column] = x[i];
  }
  return inverse;
}
export const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
export const quadratic = (x: number[], matrix: number[][]) =>
  dot(
    x,
    matrix.map((row) => dot(row, x)),
  );
