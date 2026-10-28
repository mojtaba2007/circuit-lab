import type { Circuit, PartKind, Point } from '../editor/model';

/**
 * هدف مرحله‌های تعاملی. تلورانس نسبی پیش‌فرض ۱٪ است؛ برای هدف صفر از abs (تلورانس مطلق) استفاده کن.
 */
export type SimpleGoal =
  | { kind: 'current'; id: string; target: number; tol?: number; abs?: number } // |جریان| قطعه
  | { kind: 'voltage'; id: string; target: number; tol?: number; abs?: number } // |ولتاژ| دو سر قطعه
  | { kind: 'power'; id: string; target: number; tol?: number; abs?: number } // |توان| قطعه
  | { kind: 'node'; at: Point; target: number; tol?: number; abs?: number } // ولتاژ گره در یک نقطه
  // |ولتاژ| یا |جریان| یک قطعه در لحظه‌ی at (ثانیه) پس از شروع تحلیل گذرا
  | { kind: 'transient'; id: string; quantity: 'voltage' | 'current'; at: number; target: number; tol?: number; abs?: number; initial?: 'ic' | 'dc' }
  // بیشینه‌ی |ولتاژ| یا |جریان| یک قطعه در بازه‌ی [0, within] ثانیه (مثلاً فراجهش مدار RLC)
  | { kind: 'peak'; id: string; quantity: 'voltage' | 'current'; within: number; target: number; tol?: number; abs?: number; initial?: 'ic' | 'dc' };

/** چند هدف هم‌زمان: مرحله وقتی حل می‌شود که همه‌ی هدف‌ها برآورده شوند (برای مرحله‌های چندمجهولی) */
export type Goal = SimpleGoal | { kind: 'all'; goals: SimpleGoal[] };

/** قطعه‌ها و نقطه‌هایی که هدف به آن‌ها اشاره می‌کند (برای نشانه‌گذاری روی برد) */
export function goalFocus(goal: Goal | null): { ids: string[]; points: Point[] } {
  if (!goal) return { ids: [], points: [] };
  if (goal.kind === 'all') {
    const parts = goal.goals.map(goalFocus);
    return { ids: parts.flatMap((p) => p.ids), points: parts.flatMap((p) => p.points) };
  }
  return goal.kind === 'node' ? { ids: [], points: [goal.at] } : { ids: [goal.id], points: [] };
}

/** یک کمیت قابل اندازه‌گیری برای سؤال‌های درست/نادرست و پیش‌بینی (مقدار مطلق) */
export type Quantity =
  | { quantity: 'voltage' | 'current' | 'power'; id: string }
  | { quantity: 'node'; at: Point };

/** گزاره‌ای که درستی‌اش با موتور شبیه‌ساز سنجیده می‌شود (یا برای مفهوم‌ها مقدار ثابت دارد) */
export type Claim =
  | { kind: 'compare'; a: Quantity; op: '>' | '<' | '='; b: Quantity; tol?: number }
  | { kind: 'value'; a: Quantity; target: number; tol?: number; abs?: number }
  | { kind: 'fixed'; value: boolean };

/** درس‌نامه خیلی کوتاه که قبل از مرحله نشان داده می‌شود. */
export interface Lesson {
  title: string;
  body: string;
  formula?: string;
  steps?: string[];
}

export type LevelType = 'tune' | 'design' | 'complete' | 'repair' | 'truefalse' | 'predict' | 'choose';

/** جای خالی مدار برای سؤال‌های «تکمیل» (فقط راهنمای بصری؛ درستی را هدف مرحله می‌سنجد) */
export interface Slot {
  a: Point;
  b: Point;
}

interface LevelBase {
  id: string;
  world: string;
  title: string;
  story: string;
  hints: string[];
  circuit: Circuit;
  /** قطعه‌هایی که بازیکن نمی‌تواند تغییر بدهد یا حذف کند */
  locked: string[];
  lesson?: Lesson;
  /** مرحله‌ی محاسبه‌ی سنگین: زمان مرجع پاداش سرعت ۱٫۶ برابر می‌شود */
  blind?: boolean;
  /** زمان مرجع (ثانیه) برای پاداش سرعت؛ پیش‌فرض بر اساس نوع سؤال */
  parTime?: number;
  /** سختی: ۱ آسان، ۲ متوسط، ۳ سخت (پاداش سختی می‌گیرد) */
  difficulty?: 1 | 2 | 3;
}

/** سؤال‌های تعاملی: تنظیم مقدار، طراحی، تکمیل و عیب‌یابی */
export interface InteractiveLevel extends LevelBase {
  type: 'tune' | 'design' | 'complete' | 'repair';
  goal: Goal;
  /** سقف تعداد قطعه (بدون سیم) برای امتیاز کامل بخش «کمترین قطعه» */
  maxParts: number;
  slots?: Slot[];
  /** حداکثر تعداد مجاز هر نوع قطعه در مدار؛ نوعی که نیامده باشد مجاز نیست */
  limits?: Partial<Record<PartKind, number>>;
  /** مقدار ثابت قطعه‌هایی که بازیکن اضافه می‌کند (غیرقابل تغییر) */
  fixedValues?: Partial<Record<PartKind, number>>;
  /** تعداد قطعه‌ی (بدون سیم) راه‌حل «موتور»؛ برای پاداش مقابله با موتور (کمتر از آن = پیروزی) */
  engineParts?: number;
}
export interface TrueFalseLevel extends LevelBase {
  type: 'truefalse';
  statement: string;
  claim: Claim;
  explanation: string;
}
export interface PredictLevel extends LevelBase {
  type: 'predict';
  question: string;
  ask: Quantity;
  options: number[];
  explanation: string;
}
/** معیار انتخاب مدار درست در سؤال «کدام مدار؟» */
export type ChooseCriterion =
  | { kind: 'claim'; claim: Claim } // دقیقاً در یکی از دو مدار درست است
  | { kind: 'extreme'; quantity: Quantity; pick: 'max' | 'min' }; // مدار با بیشترین/کمترین مقدار
export interface ChooseLevel extends LevelBase {
  type: 'choose';
  question: string;
  /** مدار B؛ مدار A همان circuit است */
  circuitB: Circuit;
  criterion: ChooseCriterion;
  explanation: string;
}
export type QuizLevel = TrueFalseLevel | PredictLevel | ChooseLevel;
export type Level = InteractiveLevel | QuizLevel;
/** مرحله‌های قدیمی که فیلد type ندارند و «تنظیم مقدار» حساب می‌شوند */
export type LegacyLevel = Omit<InteractiveLevel, 'type'>;

export const isQuiz = (l: Level): l is QuizLevel => l.type === 'truefalse' || l.type === 'predict' || l.type === 'choose';
export const isInteractive = (l: Level): l is InteractiveLevel => !isQuiz(l);
