import { describe, expect, it } from 'vitest';
import { CircuitError, solveDC, type NetElement } from './index';

const V = (id: string, a: string, b: string, value: number): NetElement => ({ id, kind: 'V', a, b, value });
const R = (id: string, a: string, b: string, value: number): NetElement => ({ id, kind: 'R', a, b, value });
const I = (id: string, a: string, b: string, value: number): NetElement => ({ id, kind: 'I', a, b, value });

describe('قانون اهم', () => {
  it('باتری ۱۲ ولت روی ۱۰۰ اهم → ۱۲۰ میلی‌آمپر', () => {
    const s = solveDC([V('E1', '1', '0', 12), R('R1', '1', '0', 100)]);
    expect(s.nodeVoltages['1']).toBeCloseTo(12);
    expect(s.elements.R1.current).toBeCloseTo(0.12);
    // باتری توان تولید می‌کند: جریان داخلی منفی و توان منفی
    expect(s.elements.E1.current).toBeCloseTo(-0.12);
    expect(s.elements.E1.power).toBeCloseTo(-1.44);
  });
});

describe('تقسیم ولتاژ', () => {
  it('۱۰ ولت با R1=3k و R2=1k → ۲٫۵ ولت روی R2', () => {
    const s = solveDC([V('E1', '1', '0', 10), R('R1', '1', '2', 3000), R('R2', '2', '0', 1000)]);
    expect(s.nodeVoltages['2']).toBeCloseTo(2.5);
  });
});

describe('سری و موازی', () => {
  it('R1 سری با (R2 ∥ R3): Req=150Ω ، I=80mA ، V2=4V', () => {
    const s = solveDC([
      V('E1', '1', '0', 12), R('R1', '1', '2', 100), R('R2', '2', '0', 100), R('R3', '2', '0', 100),
    ]);
    expect(Math.abs(s.elements.E1.current)).toBeCloseTo(0.08);
    expect(s.nodeVoltages['2']).toBeCloseTo(4);
  });
});

describe('منبع جریان', () => {
  it('۲ میلی‌آمپر روی ۱ کیلواهم → ۲ ولت', () => {
    const s = solveDC([I('Is1', '0', '1', 0.002), R('R1', '1', '0', 1000)]);
    expect(s.nodeVoltages['1']).toBeCloseTo(2);
  });
});

describe('جمع آثار (Superposition)', () => {
  const circuit = (e: number, i: number) => [
    V('E1', '1', '0', e), R('R1', '1', '2', 2000), R('R2', '2', '0', 2000), I('Is1', '0', '2', i),
  ];
  it('پاسخ کل = پاسخ منبع ولتاژ + پاسخ منبع جریان', () => {
    const total = solveDC(circuit(10, 0.001)).nodeVoltages['2'];
    const onlyE = solveDC(circuit(10, 0)).nodeVoltages['2'];
    const onlyI = solveDC(circuit(0, 0.001)).nodeVoltages['2'];
    expect(onlyE).toBeCloseTo(5);
    expect(onlyI).toBeCloseTo(1);
    expect(total).toBeCloseTo(onlyE + onlyI);
  });
  it('پایستگی توان: مجموع توان‌ها صفر است', () => {
    const s = solveDC(circuit(10, 0.001));
    const sum = Object.values(s.elements).reduce((acc, r) => acc + r.power, 0);
    expect(sum).toBeCloseTo(0);
  });
});

describe('پل وتستون', () => {
  it('پل متعادل: جریان آشکارساز صفر است', () => {
    const s = solveDC([
      V('E1', '1', '0', 10), R('R1', '1', '2', 100), R('R2', '2', '0', 200),
      R('R3', '1', '3', 300), R('R4', '3', '0', 600), R('R5', '2', '3', 1000),
    ]);
    expect(s.elements.R5.current).toBeCloseTo(0);
    expect(s.nodeVoltages['2']).toBeCloseTo(20 / 3);
  });
});

describe('خطاها', () => {
  const code = (fn: () => unknown) => {
    try { fn(); } catch (e) { return e instanceof CircuitError ? e.code : 'OTHER'; }
    return 'NONE';
  };
  it('بدون زمین', () => expect(code(() => solveDC([R('R1', '1', '2', 10)]))).toBe('NO_GROUND'));
  it('مقاومت نامعتبر', () => expect(code(() => solveDC([R('R1', '1', '0', 0)]))).toBe('INVALID_VALUE'));
  it('دو منبع ولتاژ متفاوت موازی', () =>
    expect(code(() => solveDC([V('E1', '1', '0', 10), V('E2', '1', '0', 5)]))).toBe('SINGULAR'));
});
