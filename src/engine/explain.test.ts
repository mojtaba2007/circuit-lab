import { describe, expect, it } from 'vitest';
import { explainDC, solveDC, type NetElement } from './index';

const els: NetElement[] = [
  { id: 'E1', kind: 'V', a: '1', b: '0', value: 10 },
  { id: 'R1', kind: 'R', a: '1', b: '2', value: 3000 },
  { id: 'R2', kind: 'R', a: '2', b: '0', value: 1000 },
];

describe('explainDC', () => {
  const steps = explainDC(els, solveDC(els));
  it('چهار مرحله و دو معادله KCL', () => {
    expect(steps.length).toBe(4);
    expect(steps[0].lines.length).toBe(2);
  });
  it('معادله KCL گره ۱', () => {
    expect(steps[0].lines[0]).toBe('گره V1:  I(E1) + (V1 − V2)/3000 = 0');
  });
  it('قانون اهم با اعداد واقعی', () => {
    expect(steps[2].lines[0]).toBe('R1: (10 − 2.5) / 3000 = 2.5 mA');
  });
});

describe('explainDC با خازن و سلف', () => {
  it('خازن مدار باز و سلف اتصال کوتاه توضیح داده می‌شود', () => {
    const e: NetElement[] = [
      { id: 'E1', kind: 'V', a: '1', b: '0', value: 10 },
      { id: 'R1', kind: 'R', a: '1', b: '2', value: 100 },
      { id: 'L1', kind: 'L', a: '2', b: '3', value: 0.01 },
      { id: 'R2', kind: 'R', a: '3', b: '0', value: 100 },
      { id: 'C1', kind: 'C', a: '3', b: '0', value: 1e-6 },
    ];
    const steps = explainDC(e, solveDC(e));
    expect(steps[0].lines).toEqual(['L1: اتصال کوتاه (V = 0)', 'C1: مدار باز (I = 0)']);
    expect(steps.some((st) => st.lines.some((l) => l.includes('I(L1)')))).toBe(true);
  });
});
