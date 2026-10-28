import { CircuitError } from './errors';

const PIVOT_EPS = 1e-12;

/** حل دستگاه Ax = b با روش گاوس-جردن و pivoting جزئی. */
export function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const A = matrix.map((row, i) => [...row, rhs[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    if (Math.abs(A[p][i]) < PIVOT_EPS) {
      throw new CircuitError(
        'SINGULAR',
        'مدار حل‌پذیر نیست: گره شناور، اتصال کوتاه منبع ولتاژ یا حلقه‌ای از منابع ولتاژ وجود دارد.',
      );
    }
    [A[i], A[p]] = [A[p], A[i]];
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const m = A[r][i] / A[i][i];
      if (m === 0) continue;
      for (let c = i; c <= n; c++) A[r][c] -= m * A[i][c];
    }
  }
  return A.map((row, i) => row[n] / row[i]);
}
