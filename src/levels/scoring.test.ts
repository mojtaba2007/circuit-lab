import { describe, expect, it } from 'vitest';
import { attemptsFor, computeScore, difficultyBonus, duelBonus, parSeconds, roundMultiplier, speedBonus, type ScoreInput } from './scoring';

const perfect: ScoreInput = { closeness: 0, partCount: 3, maxParts: 3, hintsUsed: 0, failedAttempts: 0, rounds: 0 };

describe('computeScore', () => {
  it('پاسخ کامل: ۱۰۰۰ امتیاز و ۳ ستاره', () => {
    const s = computeScore(perfect);
    expect(s.total).toBe(1000);
    expect(s.stars).toBe(3);
  });
  it('هر راهنما ۳۵ امتیاز کم می‌کند', () => {
    expect(computeScore({ ...perfect, hintsUsed: 1 }).total).toBe(965);
  });
  it('پاسخ اشتباه قبلی: ۴۰ امتیاز از هر کدام', () => {
    expect(computeScore({ ...perfect, failedAttempts: 2 }).total).toBe(920);
  });
  it('قطعه اضافه و دقت کمتر', () => {
    expect(computeScore({ ...perfect, partCount: 5 }).total).toBe(900);
    expect(computeScore({ ...perfect, closeness: 0.5 }).total).toBe(925);
  });
  it('دور جدید ضریب را کم می‌کند و ستاره‌ها را می‌کاهد', () => {
    expect(roundMultiplier(0)).toBe(1);
    expect(roundMultiplier(1)).toBe(0.75);
    expect(roundMultiplier(9)).toBe(0.25);
    expect(computeScore({ ...perfect, rounds: 1 })).toMatchObject({ total: 750, stars: 2 });
    expect(computeScore({ ...perfect, rounds: 3 })).toMatchObject({ total: 250, stars: 1 });
  });
});

describe('attemptsFor', () => {
  it('تعداد تلاش بر اساس نوع سؤال', () => {
    expect(attemptsFor('tune')).toBe(3);
    expect(attemptsFor('design')).toBe(3);
    expect(attemptsFor('predict')).toBe(2);
    expect(attemptsFor('choose')).toBe(2);
    expect(attemptsFor('truefalse')).toBe(Infinity);
  });
});

describe('پاداش‌ها', () => {
  it('پاداش سرعت: تا زمان مرجع ۱۰۰ و خطی تا صفر در سه برابر', () => {
    expect(speedBonus(10, 60)).toBe(100);
    expect(speedBonus(60, 60)).toBe(100);
    expect(speedBonus(120, 60)).toBe(50);
    expect(speedBonus(180, 60)).toBe(0);
    expect(speedBonus(500, 60)).toBe(0);
  });
  it('پاداش مقابله با موتور', () => {
    expect(duelBonus(3, 4)).toBe(100);
    expect(duelBonus(4, 4)).toBe(50);
    expect(duelBonus(5, 4)).toBe(0);
  });
  it('پاداش‌ها به امتیاز کل اضافه می‌شوند ولی ستاره‌ها فقط از امتیاز پایه‌اند', () => {
    const s = computeScore({ ...perfect, elapsedSec: 5, parSec: 60, engineParts: 5 });
    expect(s.base).toBe(1000);
    expect(s.total).toBe(1200);
    expect(s.bonuses.length).toBe(2);
    const late = computeScore({ ...perfect, rounds: 1, elapsedSec: 1, parSec: 60 });
    expect(late.base).toBe(750);
    expect(late.total).toBe(850);
    expect(late.stars).toBe(2);
  });
  it('بدون ورودی زمان و موتور پاداشی نیست', () => {
    expect(computeScore(perfect).bonuses.length).toBe(0);
  });
  it('زمان مرجع بر اساس نوع و حالت blind', () => {
    expect(parSeconds({ type: 'tune' })).toBe(90);
    expect(parSeconds({ type: 'tune', blind: true })).toBe(144);
    expect(parSeconds({ type: 'truefalse', parTime: 20 })).toBe(20);
  });
});

describe('پاداش سختی', () => {
  it('مرحله‌ی آسان صفر، متوسط ۵۰ و سخت ۱۰۰', () => {
    expect(difficultyBonus(1)).toBe(0);
    expect(difficultyBonus(2)).toBe(50);
    expect(difficultyBonus(3)).toBe(100);
  });
  it('پاداش سختی به جمع اضافه می‌شود، ستاره‌ها را عوض نمی‌کند و سقف ۱۳۰۰ است', () => {
    expect(computeScore({ ...perfect, difficulty: 1 }).bonuses.length).toBe(0);
    const hard = computeScore({ ...perfect, difficulty: 3, elapsedSec: 1, parSec: 60, engineParts: 5 });
    expect(hard.base).toBe(1000);
    expect(hard.total).toBe(1300);
    expect(hard.stars).toBe(3);
  });
});
