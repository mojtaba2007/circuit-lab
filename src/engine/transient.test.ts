import { describe, expect, it } from 'vitest';
import { CircuitError, solveDC, solveTransient, type NetElement } from './index';

const V = (id: string, a: string, b: string, value: number): NetElement => ({ id, kind: 'V', a, b, value });
const R = (id: string, a: string, b: string, value: number): NetElement => ({ id, kind: 'R', a, b, value });
const C = (id: string, a: string, b: string, value: number, ic?: number): NetElement => ({ id, kind: 'C', a, b, value, ic });
const L = (id: string, a: string, b: string, value: number, ic?: number): NetElement => ({ id, kind: 'L', a, b, value, ic });
const codeOf = (fn: () => unknown) => {
  try { fn(); } catch (e) { return e instanceof CircuitError ? e.code : 'OTHER'; }
  return 'NONE';
};

describe('مدار RC (شارژ خازن) در برابر جواب تحلیلی', () => {
  const rc = [V('E1', '1', '0', 10), R('R1', '1', '2', 1000), C('C1', '2', '0', 1e-6)];
  const res = solveTransient(rc, { stop: 5e-3, dt: 1e-5 });
  it('ولتاژ خازن: Vc = E(1 − e^(−t/τ)) با τ = 1ms', () => {
    expect(res.times.length).toBe(501);
    expect(res.nodeVoltages['2'][0]).toBe(0);
    for (const k of [50, 100, 200, 500]) {
      expect(res.nodeVoltages['2'][k]).toBeCloseTo(10 * (1 - Math.exp(-res.times[k] / 1e-3)), 3);
    }
  });
  it('جریان: i = (E/R)·e^(−t/τ) و در لحظه 0+ برابر E/R', () => {
    expect(res.elements.C1.current[0]).toBeCloseTo(0.01, 6);
    for (const k of [0, 100, 300]) expect(res.elements.R1.current[k]).toBeCloseTo(0.01 * Math.exp(-res.times[k] / 1e-3), 5);
  });
  it('Backward Euler کم‌دقت‌تر از Trapezoidal ولی قابل‌قبول است', () => {
    const be = solveTransient(rc, { stop: 5e-3, dt: 1e-5, method: 'backward-euler' });
    const exact = 10 * (1 - Math.exp(-1));
    const errBE = Math.abs(be.nodeVoltages['2'][100] - exact);
    const errTR = Math.abs(res.nodeVoltages['2'][100] - exact);
    expect(errBE).toBeLessThan(0.05);
    expect(errTR).toBeLessThan(errBE);
  });
});

describe('مدار RL', () => {
  it('جریان سلف: i = (E/R)(1 − e^(−t/τ)) با τ = L/R = 1ms', () => {
    const res = solveTransient([V('E1', '1', '0', 12), R('R1', '1', '2', 100), L('L1', '2', '0', 0.1)], { stop: 5e-3, dt: 1e-5 });
    expect(res.elements.L1.current[0]).toBe(0);
    for (const k of [50, 100, 250, 500]) {
      expect(res.elements.L1.current[k]).toBeCloseTo(0.12 * (1 - Math.exp(-res.times[k] / 1e-3)), 5);
    }
  });
});

describe('مدار RLC سری (کم‌میرا) در برابر جواب تحلیلی', () => {
  it('Vc(t) = E[1 − e^(−αt)(cos ωd·t + (α/ωd)·sin ωd·t)]', () => {
    const els = [V('E1', '1', '0', 10), R('R1', '1', '2', 10), L('L1', '2', '3', 1e-3), C('C1', '3', '0', 1e-5)];
    const res = solveTransient(els, { stop: 2e-3, dt: 1e-6 });
    const alpha = 10 / (2 * 1e-3);
    const wd = Math.sqrt(1 / (1e-3 * 1e-5) - alpha * alpha);
    const exact = (t: number) => 10 * (1 - Math.exp(-alpha * t) * (Math.cos(wd * t) + (alpha / wd) * Math.sin(wd * t)));
    for (const k of [100, 363, 500, 1000, 2000]) expect(res.nodeVoltages['3'][k]).toBeCloseTo(exact(res.times[k]), 3);
    expect(Math.max(...res.nodeVoltages['3'])).toBeGreaterThan(11); // فراجهش
  });
});

describe('شرط‌های اولیه', () => {
  it('تخلیه خازن با ولتاژ اولیه ۵ ولت: v = 5·e^(−t/τ)', () => {
    const res = solveTransient([R('R1', '1', '0', 1000), C('C1', '1', '0', 1e-6, 5)], { stop: 5e-3, dt: 1e-5 });
    expect(res.nodeVoltages['1'][0]).toBeCloseTo(5, 9);
    for (const k of [100, 300]) expect(res.nodeVoltages['1'][k]).toBeCloseTo(5 * Math.exp(-res.times[k] / 1e-3), 3);
  });
  it('نوسانگر LC بدون تلفات: انرژی ثابت می‌ماند و v = cos(ωt)', () => {
    const c = 1e-6, l = 1e-3;
    const res = solveTransient([C('C1', '1', '0', c, 1), L('L1', '1', '0', l)], { stop: 1e-3, dt: 1e-7 });
    const energy = (k: number) => 0.5 * c * res.nodeVoltages['1'][k] ** 2 + 0.5 * l * res.elements.L1.current[k] ** 2;
    const e0 = energy(0);
    expect(e0).toBeCloseTo(0.5e-6, 12);
    for (const k of [1, 500, 2500, 7000, 10000]) expect(Math.abs(energy(k) - e0) / e0).toBeLessThan(1e-6);
    const w = 1 / Math.sqrt(l * c);
    expect(res.nodeVoltages['1'][1000]).toBeCloseTo(Math.cos(w * res.times[1000]), 3);
  });
  it('شروع از حالت پایدار DC: ولتاژ خازن ثابت می‌ماند', () => {
    const els = [V('E1', '1', '0', 10), R('R1', '1', '2', 1000), R('R2', '2', '0', 1000), C('C1', '2', '0', 1e-6)];
    const res = solveTransient(els, { stop: 2e-3, dt: 2e-5, initial: 'dc' });
    expect(Math.min(...res.nodeVoltages['2'])).toBeCloseTo(5, 9);
    expect(Math.max(...res.nodeVoltages['2'])).toBeCloseTo(5, 9);
  });
});

describe('سازگاری با DC پایدار', () => {
  const els = [V('E1', '1', '0', 10), R('R1', '1', '2', 1000), R('R2', '2', '0', 1000), C('C1', '2', '0', 1e-6)];
  it('مقدار نهایی گذرا = جواب DC (خازن مدار باز)', () => {
    const res = solveTransient(els, { stop: 10e-3, dt: 2e-5 });
    const dc = solveDC(els);
    expect(dc.nodeVoltages['2']).toBeCloseTo(5, 9);
    expect(res.nodeVoltages['2'][res.times.length - 1]).toBeCloseTo(dc.nodeVoltages['2'], 4);
  });
  it('DC با سلف: اتصال کوتاه با ولتاژ صفر و جریان E/R', () => {
    const dc = solveDC([V('E1', '1', '0', 10), R('R1', '1', '2', 100), L('L1', '2', '0', 0.01)]);
    expect(dc.nodeVoltages['2']).toBeCloseTo(0, 9);
    expect(dc.elements.L1.current).toBeCloseTo(0.1, 9);
    expect(dc.elements.L1.voltage).toBeCloseTo(0, 9);
  });
  it('DC با خازن: جریان صفر و ولتاژ کامل منبع', () => {
    const dc = solveDC([V('E1', '1', '0', 10), R('R1', '1', '2', 1000), C('C1', '2', '0', 1e-6)]);
    expect(dc.elements.C1.current).toBe(0);
    expect(dc.elements.C1.voltage).toBeCloseTo(10, 9);
  });
});

describe('خطاها', () => {
  const rc = [V('E1', '1', '0', 10), R('R1', '1', '2', 1000), C('C1', '2', '0', 1e-6)];
  it('گام یا زمان نامعتبر', () => {
    expect(codeOf(() => solveTransient(rc, { stop: 1e-3, dt: 0 }))).toBe('INVALID_OPTIONS');
    expect(codeOf(() => solveTransient(rc, { stop: -1, dt: 1e-3 }))).toBe('INVALID_OPTIONS');
    expect(codeOf(() => solveTransient(rc, { stop: 1, dt: 1e-9 }))).toBe('INVALID_OPTIONS');
  });
  it('مقدار نامعتبر خازن و شناسه تکراری', () => {
    expect(codeOf(() => solveDC([V('E1', '1', '0', 1), C('C1', '1', '0', 0)]))).toBe('INVALID_VALUE');
    expect(codeOf(() => solveDC([V('E1', '1', '0', 1), R('E1', '1', '0', 5)]))).toBe('INVALID_VALUE');
  });
});
