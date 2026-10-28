import { describe, expect, it } from 'vitest';
import { USERNAME_RE } from './api';

describe('نام کاربری', () => {
  it('حرف، عدد و _ (فارسی و انگلیسی) و طول ۳ تا ۲۰', () => {
    expect(USERNAME_RE.test('ali_1')).toBe(true);
    expect(USERNAME_RE.test('رضا_۱')).toBe(true);
    expect(USERNAME_RE.test('ab')).toBe(false);
    expect(USERNAME_RE.test('bad name')).toBe(false);
    expect(USERNAME_RE.test('x'.repeat(21))).toBe(false);
  });
});
