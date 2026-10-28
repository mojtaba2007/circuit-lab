import { describe, expect, it } from 'vitest';
import { formatValue, parseValue, toInputText } from './index';

describe('parseValue', () => {
  it('پیشوندهای مهندسی', () => {
    expect(parseValue('4.7k')).toBeCloseTo(4700);
    expect(parseValue('10m')).toBeCloseTo(0.01);
    expect(parseValue('2u')).toBeCloseTo(2e-6);
    expect(parseValue('abc')).toBeNaN();
    expect(parseValue('-2m')).toBeCloseTo(-0.002);
    expect(parseValue('1.2.3')).toBeNaN();
    expect(parseValue('.5k')).toBeCloseTo(500);
  });
});

describe('formatValue', () => {
  it('نمایش مهندسی', () => {
    expect(formatValue(0.05, 'A')).toBe('50 mA');
    expect(formatValue(1000, 'Ω')).toBe('1 kΩ');
    expect(formatValue(0, 'V')).toBe('0 V');
  });
});

describe('toInputText', () => {
  it('پیشوند قابل‌تایپ می‌سازد و با parseValue رفت‌وبرگشتی است', () => {
    expect(toInputText(1e-6)).toBe('1u');
    expect(toInputText(4700)).toBe('4.7k');
    expect(toInputText(300)).toBe('300');
    expect(toInputText(0.01)).toBe('10m');
    for (const v of [1e-6, 4700, 300, 0.01, 2.2e-9, 1.5e6]) expect(parseValue(toInputText(v))).toBeCloseTo(v, 12);
    expect(parseValue('1µ')).toBeCloseTo(1e-6, 12);
  });
});
