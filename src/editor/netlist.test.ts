import { describe, expect, it } from 'vitest';
import { solveDC } from '../engine';
import type { Circuit } from './model';
import { buildNetlist } from './netlist';

const loop: Circuit = {
  ground: [0, 4],
  parts: [
    { id: 'E1', kind: 'V', a: [0, 0], b: [0, 4], value: 10 },
    { id: 'W1', kind: 'W', a: [0, 0], b: [4, 0], value: 0 },
    { id: 'R1', kind: 'R', a: [4, 0], b: [4, 4], value: 100 },
    { id: 'W2', kind: 'W', a: [4, 4], b: [0, 4], value: 0 },
  ],
};

describe('buildNetlist', () => {
  it('سیم‌ها گره‌ها را ادغام می‌کنند و زمین گره 0 است', () => {
    const n = buildNetlist(loop);
    expect(n.elements.length).toBe(2);
    expect(n.elements[0].a).toBe('1');
    expect(n.elements[0].b).toBe('0');
    expect(n.elements[1].a).toBe('1');
    expect(n.elements[1].b).toBe('0');
  });
  it('نتیجه با موتور: ۱۰ ولت روی ۱۰۰ اهم → ۱۰۰ میلی‌آمپر', () => {
    const n = buildNetlist(loop);
    expect(solveDC(n.elements, n.ground).elements.R1.current).toBeCloseTo(0.1);
  });
  it('بدون زمین خطا می‌دهد', () => {
    expect(() => buildNetlist({ ...loop, ground: null })).toThrow();
  });
});

describe('خازن و سلف در netlist', () => {
  it('شرط اولیه و نوع قطعه به موتور منتقل می‌شود', () => {
    const c: Circuit = {
      ground: [0, 4],
      parts: [
        { id: 'C1', kind: 'C', a: [0, 0], b: [0, 4], value: 1e-6, ic: 5 },
        { id: 'L1', kind: 'L', a: [0, 0], b: [0, 4], value: 1e-3 },
      ],
    };
    const n = buildNetlist(c);
    expect(n.elements[0].kind).toBe('C');
    expect(n.elements[0].ic).toBe(5);
    expect(n.elements[1].kind).toBe('L');
  });
});
