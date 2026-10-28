import { describe, expect, it } from 'vitest';
import { LEVELS } from './data';
import {
  emptyProgress, getRun, isUnlocked, mergeProgress, nextLevelIndex, recordFail, recordHint, recordSuccess, sanitizeProgress, startNewRound, totalScore, totalStars,
} from './progress';

const done = (...ids: string[]) =>
  ids.reduce((p, id) => recordSuccess(p, id, { score: 900, stars: 3 }), emptyProgress());

describe('قفل مرحله‌ها', () => {
  it('در ابتدا فقط مرحله اول باز است', () => {
    expect(isUnlocked(LEVELS, emptyProgress(), 0)).toBe(true);
    expect(isUnlocked(LEVELS, emptyProgress(), 1)).toBe(false);
    expect(nextLevelIndex(LEVELS, emptyProgress())).toBe(0);
  });
  it('حل یک مرحله، مرحله بعد را باز می‌کند (نه بعدتر را)', () => {
    const p = done(LEVELS[0].id);
    expect(isUnlocked(LEVELS, p, 1)).toBe(true);
    expect(isUnlocked(LEVELS, p, 2)).toBe(false);
    expect(nextLevelIndex(LEVELS, p)).toBe(1);
    expect(totalStars(p)).toBe(3);
    expect(totalScore(p)).toBe(900);
  });
  it('وقتی همه حل شدند nextLevelIndex منفی است', () => {
    expect(nextLevelIndex(LEVELS, done(...LEVELS.map((l) => l.id)))).toBe(-1);
  });
});

describe('تلاش‌ها و دورها', () => {
  it('پاسخ اشتباه تلاش را می‌شمارد', () => {
    expect(getRun(recordFail(recordFail(emptyProgress(), 'a'), 'a'), 'a').failed).toBe(2);
  });
  it('دور جدید تلاش‌ها را برمی‌گرداند و دور را زیاد می‌کند، راهنماها می‌مانند', () => {
    let p = recordHint(recordFail(emptyProgress(), 'a'), 'a', 3);
    p = startNewRound(p, 'a');
    expect(getRun(p, 'a')).toEqual({ failed: 0, rounds: 1, hints: 1 });
  });
  it('راهنما از سقف بیشتر نمی‌شود', () => {
    let p = emptyProgress();
    for (let i = 0; i < 5; i++) p = recordHint(p, 'a', 3);
    expect(getRun(p, 'a').hints).toBe(3);
  });
  it('برد، بهترین امتیاز را نگه می‌دارد و دور را ریست می‌کند', () => {
    let p = recordSuccess(emptyProgress(), 'a', { score: 800, stars: 3 });
    p = recordFail(p, 'a');
    p = recordSuccess(p, 'a', { score: 600, stars: 2 });
    expect(p.results.a.score).toBe(800);
    expect(getRun(p, 'a')).toEqual({ failed: 0, rounds: 0, hints: 0 });
  });
});

describe('ادغام و پاک‌سازی پیشرفت', () => {
  it('بهترین نتیجه‌ی هر مرحله می‌ماند و مرحله‌های هر دو سمت حفظ می‌شوند', () => {
    const a = recordSuccess(emptyProgress(), 'x', { score: 800, stars: 3 });
    const b = recordSuccess(recordSuccess(emptyProgress(), 'x', { score: 900, stars: 3 }), 'y', { score: 500, stars: 1 });
    const m = mergeProgress(a, b);
    expect(m.results.x.score).toBe(900);
    expect(m.results.y.score).toBe(500);
    expect(totalScore(m)).toBe(1400);
  });
  it('در تعارض دور جاری، primary برنده است', () => {
    const a = recordFail(emptyProgress(), 'x');
    const b = recordHint(emptyProgress(), 'x', 3);
    expect(getRun(mergeProgress(a, b), 'x').failed).toBe(1);
  });
  it('sanitizeProgress ورودی‌های خراب را دور می‌ریزد', () => {
    const p = sanitizeProgress({ results: { a: { score: 10, stars: 1 }, b: { score: 'x' } }, runs: { c: { failed: 1 } }, extra: 1 });
    expect(Object.keys(p.results).join()).toBe('a');
    expect(Object.keys(p.runs).length).toBe(0);
    expect(sanitizeProgress(null).results).toEqual({});
  });
});
