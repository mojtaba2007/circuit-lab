import { describe, expect, it } from 'vitest';
import { LEVELS } from './data';
import { correctCircuit, correctOption, evaluateClaim } from './quiz';

// پاسخ مورد انتظار هر گزاره (مستقل از موتور نوشته شده تا هم‌خوانی داده با موتور تست شود)
const EXPECTED_TRUTH: Record<string, boolean> = { 'tf-ohm': false, 'tf-kvl': false, 'tf-bridge': true, 'tf-rc': true, 'tf-ss': false };

describe('سؤال‌های درست/نادرست', () => {
  for (const level of LEVELS) {
    if (level.type !== 'truefalse') continue;
    it(`${level.id}: درستی گزاره با موتور و جواب مورد انتظار یکی است`, () => {
      const v = evaluateClaim(level.claim, level.circuit);
      expect(v.ok && v.truth).toBe(EXPECTED_TRUTH[level.id]);
    });
  }
  it('همه‌ی گزاره‌ها پاسخ مورد انتظار دارند و هر دو نوع پاسخ (درست و نادرست) وجود دارد', () => {
    const tf = LEVELS.filter((l) => l.type === 'truefalse');
    expect(tf.every((l) => l.id in EXPECTED_TRUTH)).toBe(true);
    const values = Object.values(EXPECTED_TRUTH);
    expect(values.includes(true) && values.includes(false)).toBe(true);
  });
});

describe('سؤال‌های پیش‌بینی', () => {
  for (const level of LEVELS) {
    if (level.type !== 'predict') continue;
    it(`${level.id}: دقیقاً یک گزینه با مقدار واقعی (۱٪) هم‌خوان است`, () => {
      const r = correctOption(level.ask, level.options, level.circuit);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const near = level.options.filter((o) => Math.abs(o - r.actual) <= 0.01 * Math.abs(r.actual));
      expect(near.length).toBe(1);
      expect(Math.abs(level.options[r.index] - r.actual) <= 0.01 * Math.abs(r.actual)).toBe(true);
    });
  }
});

// مدار درست در سؤال «کدام مدار؟» (۰ = A و ۱ = B)
const EXPECTED_CHOICE: Record<string, number> = { 'choose-1': 0, 'choose-2': 1, 'choose-3': 0, 'choose-4': 1 };

describe('سؤال‌های «کدام مدار؟»', () => {
  for (const level of LEVELS) {
    if (level.type !== 'choose') continue;
    it(`${level.id}: مدار درست با موتور و جواب مورد انتظار یکی است`, () => {
      const r = correctCircuit(level.criterion, level.circuit, level.circuitB);
      expect(r.ok && r.index).toBe(EXPECTED_CHOICE[level.id]);
    });
  }
  it('همه‌ی سؤال‌های «کدام مدار؟» پاسخ مورد انتظار دارند و جواب هر دو سمت وجود دارد', () => {
    const ids = LEVELS.filter((l) => l.type === 'choose').map((l) => l.id);
    expect(ids.every((id) => id in EXPECTED_CHOICE)).toBe(true);
    const v = Object.values(EXPECTED_CHOICE);
    expect(v.includes(0) && v.includes(1)).toBe(true);
  });
});
