export type Point = readonly [number, number];
export type PartKind = 'R' | 'V' | 'I' | 'C' | 'L' | 'W';

/** قطعه روی صفحه. W یعنی سیم (فقط اتصال می‌دهد و وارد محاسبه نمی‌شود). */
export interface Part {
  id: string;
  kind: PartKind;
  a: Point;
  b: Point;
  value: number;
  /** شرط اولیه (فقط خازن و سلف): ولتاژ اولیه خازن یا جریان اولیه سلف */
  ic?: number;
}
export interface Circuit {
  parts: Part[];
  ground: Point | null;
}

export const GRID = { cols: 20, rows: 12, size: 40 } as const;
export const DEFAULT_VALUE: Record<PartKind, number> = { R: 100, V: 10, I: 0.01, C: 1e-6, L: 1e-3, W: 0 };
export const UNIT: Record<PartKind, string> = { R: 'Ω', V: 'V', I: 'A', C: 'F', L: 'H', W: '' };
const PREFIX: Record<PartKind, string> = { R: 'R', V: 'E', I: 'Is', C: 'C', L: 'L', W: 'W' };

export const key = (p: Point) => `${p[0]},${p[1]}`;
export const samePoint = (p: Point, q: Point) => p[0] === q[0] && p[1] === q[1];

export function addPart(c: Circuit, kind: PartKind, a: Point, b: Point, value?: number): Circuit {
  const used = new Set(c.parts.map((p) => p.id));
  let n = 1;
  while (used.has(`${PREFIX[kind]}${n}`)) n++;
  const part: Part = { id: `${PREFIX[kind]}${n}`, kind, a, b, value: value ?? DEFAULT_VALUE[kind] };
  return { ...c, parts: [...c.parts, part] };
}
export const removePart = (c: Circuit, id: string): Circuit => ({
  ...c,
  parts: c.parts.filter((p) => p.id !== id),
});
export const setValue = (c: Circuit, id: string, value: number): Circuit => ({
  ...c,
  parts: c.parts.map((p) => (p.id === id ? { ...p, value } : p)),
});
export const setInitial = (c: Circuit, id: string, ic: number): Circuit => ({
  ...c,
  parts: c.parts.map((p) => (p.id === id ? { ...p, ic } : p)),
});
