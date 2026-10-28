import { describe, expect, it } from 'vitest';
import { addPart, removePart, setValue, type Circuit, type PartKind } from '../editor/model';
import { LEVELS } from './data';
import { evaluateGoal } from './evaluate';
import { goalFocus, isInteractive } from './types';

// راه‌حل مرجع هر مرحله‌ی تعاملی؛ ثابت می‌کند همه مرحله‌ها حل‌شدنی‌اند.
const SOLUTIONS: Record<string, (c: Circuit) => Circuit> = {
  'ohm-1': (c) => setValue(c, 'R1', 300),
  'ohm-2': (c) => setValue(c, 'E1', 9),
  'kvl-1': (c) => setValue(c, 'R1', 200),
  'kcl-1': (c) => setValue(c, 'R2', 500),
  'eq-1': (c) => addPart(c, 'R', [8, 3], [8, 9]),
  'div-1': (c) => setValue(c, 'R1', 3000),
  'sup-1': (c) => setValue(c, 'Is1', 0.002),
  'eq-2': (c) => setValue(c, 'R3', 150),
  'mesh-1': (c) => setValue(c, 'E2', 3),
  'pow-1': (c) => setValue(c, 'R2', 100),
  'bridge-1': (c) => setValue(c, 'R4', 600),
  'thev-1': (c) => setValue(c, 'R2', 200),
  'cap-1': (c) => setValue(c, 'C1', 1e-6),
  'cap-2': (c) => setValue(c, 'E1', 13.6),
  'ind-1': (c) => setValue(c, 'L1', 0.1),
  'cap-3': (c) => setValue(c, 'R1', 1000),
  'cap-4': (c) => setValue(c, 'R2', 500),
  'fix-3': (c) => removePart(addPart(c, 'W', [13, 9], [3, 9]), 'W3'),
  'design-3': (c) => {
    let x = addPart(c, 'R', [3, 3], [8, 3], 1000);
    x = addPart(x, 'R', [8, 3], [8, 9], 1000);
    x = addPart(x, 'W', [8, 3], [13, 3]);
    x = addPart(x, 'R', [13, 3], [13, 6], 1000);
    x = addPart(x, 'R', [13, 6], [13, 9], 1000);
    x = addPart(x, 'W', [13, 9], [8, 9]);
    return addPart(x, 'W', [8, 9], [3, 9]);
  },
  'mesh-2': (c) => setValue(setValue(c, 'E2', 3), 'R2', 100),
  'ladder-1': (c) => setValue(c, 'R4', 1500),
  'thev-2': (c) => setValue(c, 'R3', 133.3),
  'bridge-2': (c) => setValue(c, 'R4', 450),
  'peak-1': (c) => setValue(c, 'R1', 10),
  'comp-1': (c) => addPart(c, 'R', [8, 3], [8, 9], 500),
  'fix-1': (c) => addPart(c, 'W', [8, 9], [3, 9]),
  'fix-2': (c) => removePart(c, 'W3'),
  'design-div': (c) => addPart(addPart(c, 'R', [8, 3], [8, 6], 2000), 'R', [8, 6], [8, 9], 1000),
  'puzzle-1': (c) => {
    let x = addPart(c, 'R', [3, 3], [8, 3], 100);
    x = addPart(x, 'R', [8, 3], [8, 9], 100);
    x = addPart(x, 'W', [8, 3], [13, 3]);
    x = addPart(x, 'R', [13, 3], [13, 9], 100);
    x = addPart(x, 'W', [13, 9], [8, 9]);
    return addPart(x, 'W', [8, 9], [3, 9]);
  },
};
const INTERACTIVE = LEVELS.filter(isInteractive);
const count = (c: Circuit, kind: PartKind) => c.parts.filter((p) => p.kind === kind).length;

describe('مرحله‌های تعاملی', () => {
  for (const level of INTERACTIVE) {
    it(`${level.id} (${level.type}): ابتدا حل‌نشده و با راه‌حل مرجع حل می‌شود`, () => {
      const before = evaluateGoal(level.goal, level.circuit);
      expect(before.ok && before.met).toBe(false);
      const solved = SOLUTIONS[level.id](level.circuit);
      const after = evaluateGoal(level.goal, solved);
      expect(after.ok && after.met).toBe(true);
    });
    it(`${level.id}: قطعه‌های قفل وجود دارند و راه‌حل از محدودیت‌ها تجاوز نمی‌کند`, () => {
      const ids = new Set(level.circuit.parts.map((p) => p.id));
      expect(level.locked.every((id) => ids.has(id))).toBe(true);
      if (level.limits) {
        const solved = SOLUTIONS[level.id](level.circuit);
        for (const kind of ['R', 'V', 'I', 'C', 'L'] as PartKind[]) {
          const added = count(solved, kind) - count(level.circuit, kind);
          expect(added <= (level.limits[kind] ?? 0)).toBe(true);
        }
      }
    });
  }
});

describe('فهرست مرحله‌ها', () => {
  it('شناسه‌ها یکتا و هر مرحله‌ی تعاملی راه‌حل مرجع دارد', () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(INTERACTIVE.every((l) => l.id in SOLUTIONS)).toBe(true);
  });
  it('جهان‌ها پیوسته‌اند', () => {
    const worlds = LEVELS.map((l) => l.world).filter((w, i, a) => i === 0 || a[i - 1] !== w);
    expect(new Set(worlds).size).toBe(worlds.length);
  });
  it('هر هفت نوع سؤال وجود دارد (۳۱ مرحله)', () => {
    expect(LEVELS.length).toBe(42);
    expect(new Set(LEVELS.map((l) => l.type)).size).toBe(7);
  });
  it('مقابله با موتور: راه‌حل مرجع از موتور قطعه‌ی کمتری دارد (قابل‌برد است)', () => {
    for (const level of INTERACTIVE) {
      if (level.engineParts === undefined) continue;
      const solved = SOLUTIONS[level.id](level.circuit);
      expect(solved.parts.filter((p) => p.kind !== 'W').length < level.engineParts).toBe(true);
    }
  });
  it('هر مرحله سختی ۱ تا ۳ دارد و سختی با پیشرفت بازی بالا می‌رود', () => {
    expect(LEVELS.every((l) => l.difficulty === 1 || l.difficulty === 2 || l.difficulty === 3)).toBe(true);
    const avg = (xs: typeof LEVELS) => xs.reduce((a, l) => a + (l.difficulty ?? 1), 0) / xs.length;
    const third = Math.floor(LEVELS.length / 3);
    expect(avg(LEVELS.slice(-third)) > avg(LEVELS.slice(0, third)) + 0.5).toBe(true);
    expect(LEVELS.filter((l) => l.difficulty === 3).length >= 8).toBe(true);
  });
  it('هر جهان دست‌کم یک مرحله‌ی سخت‌تر از ساده‌ترین مرحله‌اش دارد', () => {
    const byWorld = new Map<string, number[]>();
    for (const l of LEVELS) byWorld.set(l.world, [...(byWorld.get(l.world) ?? []), l.difficulty ?? 1]);
    for (const [, d] of byWorld) expect(Math.max(...d) > Math.min(...d)).toBe(true);
  });
  it('درس‌نامه‌ی اولین مرحله وجود دارد', () => {
    expect(LEVELS[0].lesson !== undefined).toBe(true);
  });
});

describe('هدف‌های زمانی (گذرا)', () => {
  const cap1 = INTERACTIVE.find((l) => l.id === 'cap-1')!;
  const ind1 = INTERACTIVE.find((l) => l.id === 'ind-1')!;
  it('مقدار سنجیده‌شده با فرمول تحلیلی یکی است', () => {
    const r = evaluateGoal({ kind: 'transient', id: 'C1', quantity: 'voltage', at: 2e-3, target: 0 }, SOLUTIONS['cap-1'](cap1.circuit));
    expect(r.ok && r.actual).toBeCloseTo(10 * (1 - Math.exp(-2)), 3);
    const q = evaluateGoal({ kind: 'transient', id: 'L1', quantity: 'current', at: 2e-3, target: 0 }, SOLUTIONS['ind-1'](ind1.circuit));
    expect(q.ok && q.actual).toBeCloseTo(0.12 * (1 - Math.exp(-2)), 5);
  });
  it('قطعه‌ی ناموجود پیام خطا می‌دهد', () => {
    expect(evaluateGoal({ kind: 'transient', id: 'C9', quantity: 'voltage', at: 1e-3, target: 1 }, cap1.circuit).ok).toBe(false);
  });
});

describe('هدف چندگانه و بیشینه (peak)', () => {
  const mesh = INTERACTIVE.find((l) => l.id === 'mesh-2')!;
  it('all: فقط وقتی هر دو هدف برآورده شود حل می‌شود و جزئیات هر هدف را برمی‌گرداند', () => {
    const half = evaluateGoal(mesh.goal, setValue(mesh.circuit, 'E2', 3)); // R2 هنوز ۲۰۰ است
    expect(half.ok && half.met).toBe(false);
    expect(half.ok && half.parts?.length).toBe(2);
    const full = evaluateGoal(mesh.goal, SOLUTIONS['mesh-2'](mesh.circuit));
    expect(full.ok && full.met).toBe(true);
    expect(full.ok && full.parts?.every((p) => p.met)).toBe(true);
  });
  it('goalFocus قطعه‌ها و نقطه‌های همه‌ی هدف‌ها را برمی‌گرداند', () => {
    const f = goalFocus(mesh.goal);
    expect(f.ids.join()).toBe('R3,R2');
    expect(goalFocus({ kind: 'node', at: [8, 6], target: 1 }).points.length).toBe(1);
    expect(goalFocus(null).ids.length).toBe(0);
  });
  it('peak: بیشینه‌ی ولتاژ خازن RLC با فرمول فراجهش یکی است', () => {
    const lv = INTERACTIVE.find((l) => l.id === 'peak-1')!;
    const r = evaluateGoal(lv.goal, SOLUTIONS['peak-1'](lv.circuit));
    const zeta = 0.5;
    expect(r.ok && r.actual).toBeCloseTo(10 * (1 + Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta))), 2);
    const critical = evaluateGoal(lv.goal, lv.circuit); // R = 20 Ω: میرایی بحرانی، بدون فراجهش
    expect(critical.ok && critical.actual < 10.1).toBe(true);
  });
});
