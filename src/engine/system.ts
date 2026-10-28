import { CircuitError } from './errors';
import type { NetElement, NodeId } from './types';

/** چینش مجهول‌ها در دستگاه MNA: ولتاژ گره‌ها (به‌جز زمین) و سپس جریان شاخه‌ها (منابع ولتاژ و سلف‌ها). */
export interface Layout {
  ground: NodeId;
  index: Map<NodeId, number>;
  /** تعداد گره‌های غیرزمین */
  n: number;
  /** ردیف مجهول جریان هر شاخه (کلید: id قطعه) */
  row: Map<string, number>;
  size: number;
}
export interface System {
  A: number[][];
  z: number[];
}

export function makeLayout(elements: NetElement[], ground: NodeId): Layout {
  if (elements.length === 0) throw new CircuitError('EMPTY', 'هیچ قطعه‌ای در مدار نیست.');
  const ids = new Set<string>();
  const nodes = new Set<NodeId>();
  for (const e of elements) {
    if (ids.has(e.id)) throw new CircuitError('INVALID_VALUE', `شناسه قطعه ${e.id} تکراری است.`);
    ids.add(e.id);
    const needsPositive = e.kind === 'R' || e.kind === 'C' || e.kind === 'L';
    if (!Number.isFinite(e.value) || (needsPositive && e.value <= 0)) {
      throw new CircuitError('INVALID_VALUE', `مقدار قطعه ${e.id} نامعتبر است.`);
    }
    nodes.add(e.a).add(e.b);
  }
  if (!nodes.has(ground)) throw new CircuitError('NO_GROUND', 'زمین (گره مرجع) به هیچ قطعه‌ای وصل نیست.');

  const index = new Map<NodeId, number>();
  [...nodes].filter((n) => n !== ground).forEach((n, i) => index.set(n, i));
  const n = index.size;
  const row = new Map<string, number>();
  let branches = 0;
  for (const e of elements) if (e.kind === 'V' || e.kind === 'L') row.set(e.id, n + branches++);
  return { ground, index, n, row, size: n + branches };
}

export const nodeIdx = (l: Layout, node: NodeId): number => l.index.get(node) ?? -1;
export function rowOf(l: Layout, id: string): number {
  const r = l.row.get(id);
  if (r === undefined) throw new Error(`شاخه ${id} در چینش وجود ندارد`);
  return r;
}
export const newSystem = (size: number): System => ({
  A: Array.from({ length: size }, () => new Array<number>(size).fill(0)),
  z: new Array<number>(size).fill(0),
});

/** هدایت g بین دو گره (اندیس −1 یعنی زمین) */
export function stampConductance(s: System, a: number, b: number, g: number): void {
  if (a >= 0) s.A[a][a] += g;
  if (b >= 0) s.A[b][b] += g;
  if (a >= 0 && b >= 0) {
    s.A[a][b] -= g;
    s.A[b][a] -= g;
  }
}
/** جریان i از درون قطعه از a به b می‌گذرد: از گره a خارج و به گره b وارد می‌شود. */
export function stampCurrent(s: System, a: number, b: number, i: number): void {
  if (a >= 0) s.z[a] -= i;
  if (b >= 0) s.z[b] += i;
}
/** معادله شاخه: V(a) − V(b) − req·I = rhs ؛ جریان شاخه از a به b مجهول ردیف row است. */
export function stampBranch(s: System, a: number, b: number, row: number, rhs: number, req = 0): void {
  if (a >= 0) {
    s.A[a][row] += 1;
    s.A[row][a] += 1;
  }
  if (b >= 0) {
    s.A[b][row] -= 1;
    s.A[row][b] -= 1;
  }
  s.A[row][row] -= req;
  s.z[row] = rhs;
}
