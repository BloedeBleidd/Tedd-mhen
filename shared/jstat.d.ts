declare module 'jstat' {
  export const jStat: {
    studentt: { inv(p: number, df: number): number; cdf(x: number, df: number): number };
  };
}
