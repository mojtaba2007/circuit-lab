import { describe, expect, it } from 'vitest';
import { equivalentResistance, timeConstants, type NetElement } from './index';

const V = (id: string, a: string, b: string, value: number): NetElement => ({ id, kind: 'V', a, b, value });
const R = (id: string, a: string, b: string, value: number): NetElement => ({ id, kind: 'R', a, b, value });
const C = (id: string, a: string, b: string, value: number): NetElement => ({ id, kind: 'C', a, b, value });
const L = (id: string, a: string, b: string, value: number): NetElement => ({ id, kind: 'L', a, b, value });

describe('equivalentResistance', () => {
  const divider = [V('E1', '1', '0', 10), R('R1', '1', '2', 1000), R('R2', '2', '0', 1000)];
  it('تقسیم‌کننده: از دید گره ۲ برابر R1 ∥ R2 = ۵۰۰ اهم', () => {
    expect(equivalentResistance(divider, '2', '0')).toBeCloseTo(500, 6);
  });
  it('منبع خاموش گره ۱ را به زمین وصل می‌کند: بین گره‌های ۱ و ۲ برابر R1 ∥ R2', () => {
    const els = [V('E1', '1', '0', 10), R('R1', '1', '2', 1000), R('R2', '2', '0', 2000)];
    expect(equivalentResistance(els, '1', '2')).toBeCloseTo((1000 * 2000) / 3000, 6);
  });
});

describe('timeConstants', () => {
  it('RC ساده: τ = R·C', () => {
    const t = timeConstants([V('E1', '1', '0', 10), R('R1', '1', '2', 1000), C('C1', '2', '0', 1e-6)]);
    expect(t.length).toBe(1);
    expect(t[0].id).toBe('C1');
    expect(t[0].tau).toBeCloseTo(1e-3, 9);
  });
  it('RC با تقسیم‌کننده: τ = (R1 ∥ R2)·C', () => {
    const t = timeConstants([V('E1', '1', '0', 10), R('R1', '1', '2', 1000), R('R2', '2', '0', 1000), C('C1', '2', '0', 1e-6)]);
    expect(t[0].tau).toBeCloseTo(5e-4, 9);
  });
  it('RL: τ = L/R', () => {
    const t = timeConstants([V('E1', '1', '0', 12), R('R1', '1', '2', 100), L('L1', '2', '0', 0.1)]);
    expect(t[0].tau).toBeCloseTo(1e-3, 9);
  });
  it('مداری بدون عنصر ذخیره‌کننده ثابت زمانی ندارد', () => {
    expect(timeConstants([V('E1', '1', '0', 10), R('R1', '1', '0', 100)]).length).toBe(0);
  });
});
