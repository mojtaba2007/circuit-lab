import type { LevelType } from './types';

/** تعداد پاسخ اشتباهی که در هر دور مجاز است (سؤال‌های تعاملی) */
export const MAX_ATTEMPTS = 3;
export const MAX_SCORE = 1000;
/**
 * درست/نادرست محدودیت تلاش ندارد (هر پاسخ اشتباه فقط از امتیاز «تلاش کم» کم می‌کند)؛
 * پیش‌بینی و «کدام مدار؟» دو تلاش دارند.
 */
export const attemptsFor = (type: LevelType): number =>
  type === 'truefalse' ? Infinity : type === 'predict' || type === 'choose' ? 2 : MAX_ATTEMPTS;

/** ضریب امتیاز: هر دور جدید (بعد از اتمام تلاش‌ها) ۲۵٪ از سقف امتیاز را کم می‌کند، حداقل ۲۵٪ */
export const roundMultiplier = (rounds: number): number => Math.max(0.25, 1 - 0.25 * rounds);

/** زمان مرجع (ثانیه) هر نوع سؤال برای پاداش سرعت */
const PAR: Record<LevelType, number> = { tune: 90, design: 150, complete: 90, repair: 100, truefalse: 30, predict: 45, choose: 45 };
export const parSeconds = (l: { type: LevelType; blind?: boolean; parTime?: number }): number =>
  l.parTime ?? Math.round(PAR[l.type] * (l.blind ? 1.6 : 1));

/** پاداش سرعت: تا زمان مرجع ۱۰۰، و به‌صورت خطی تا صفر در سه برابر زمان مرجع */
export const speedBonus = (elapsedSec: number, parSec: number): number =>
  elapsedSec <= parSec ? 100 : elapsedSec >= 3 * parSec ? 0 : Math.round((100 * (3 * parSec - elapsedSec)) / (2 * parSec));
/** پاداش سختی: مرحله‌ی متوسط ۵۰ و سخت ۱۰۰ */
export const difficultyBonus = (d: number): number => (d >= 3 ? 100 : d === 2 ? 50 : 0);
/** پاداش مقابله با موتور: کمتر از موتور ۱۰۰، برابر ۵۰ */
export const duelBonus = (parts: number, engineParts: number): number => (parts < engineParts ? 100 : parts === engineParts ? 50 : 0);

export interface ScoreInput {
  /** نزدیکی به هدف: 0 دقیق، 1 لبه تلورانس (خروجی evaluateGoal) */
  closeness: number;
  partCount: number;
  maxParts: number;
  hintsUsed: number;
  /** تعداد پاسخ‌های اشتباه قبلی در همین دور */
  failedAttempts: number;
  /** تعداد دورهای قبلی که تلاش‌هایشان تمام شده */
  rounds: number;
  /** زمان صرف‌شده و زمان مرجع (ثانیه) برای پاداش سرعت؛ اگر نیامده پاداشی نیست */
  elapsedSec?: number;
  parSec?: number;
  /** تعداد قطعه‌ی راه‌حل موتور برای پاداش مقابله با موتور */
  engineParts?: number;
  /** سختی مرحله (۱ تا ۳) برای پاداش سختی */
  difficulty?: number;
}
export interface ScoreItem {
  label: string;
  points: number;
  max: number;
}
export interface ScoreBreakdown {
  items: ScoreItem[];
  /** پاداش‌ها (سرعت، مقابله با موتور)؛ روی ستاره‌ها اثر ندارند */
  bonuses: ScoreItem[];
  raw: number;
  multiplier: number;
  /** امتیاز پایه بعد از ضریب دور (بدون پاداش) */
  base: number;
  total: number;
  stars: number;
}

export function computeScore(i: ScoreInput): ScoreBreakdown {
  const items: ScoreItem[] = [
    { label: 'حل مرحله', points: 500, max: 500 },
    { label: 'دقت پاسخ', points: Math.round(150 * Math.max(0, 1 - i.closeness)), max: 150 },
    { label: 'کمترین قطعه', points: Math.max(0, 150 - 50 * Math.max(0, i.partCount - i.maxParts)), max: 150 },
    { label: 'بدون راهنما', points: Math.max(0, 100 - 35 * i.hintsUsed), max: 100 },
    { label: 'تلاش کم', points: Math.max(0, 100 - 40 * i.failedAttempts), max: 100 },
  ];
  const bonuses: ScoreItem[] = [];
  if (i.elapsedSec !== undefined && i.parSec !== undefined) bonuses.push({ label: 'پاداش سرعت', points: speedBonus(i.elapsedSec, i.parSec), max: 100 });
  if (i.engineParts !== undefined) bonuses.push({ label: 'مقابله با موتور', points: duelBonus(i.partCount, i.engineParts), max: 100 });
  if (i.difficulty !== undefined && i.difficulty > 1) bonuses.push({ label: 'پاداش سختی', points: difficultyBonus(i.difficulty), max: 100 });
  const raw = items.reduce((a, x) => a + x.points, 0);
  const multiplier = roundMultiplier(i.rounds);
  const base = Math.round(raw * multiplier);
  const total = base + bonuses.reduce((a, x) => a + x.points, 0);
  return { items, bonuses, raw, multiplier, base, total, stars: base >= 800 ? 3 : base >= 550 ? 2 : 1 };
}
