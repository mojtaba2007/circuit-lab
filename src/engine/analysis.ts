import { CircuitError } from './errors';
import { solveDC } from './mna';
import type { NetElement, NodeId } from './types';

/**
 * مقاومت معادل دیده‌شده از دو گره a و b: همه منابع مستقل خاموش
 * (منبع ولتاژ ← اتصال کوتاه، منبع جریان ← مدار باز)، خازن مدار باز و سلف اتصال کوتاه.
 * روش: تزریق جریان آزمون ۱ آمپری و اندازه‌گیری V(a) − V(b). پایه‌ی محاسبه تونن/نورتون.
 */
export function equivalentResistance(elements: NetElement[], a: NodeId, b: NodeId, ground: NodeId = '0'): number {
  const passive: NetElement[] = elements.flatMap((e): NetElement[] =>
    e.kind === 'I' ? [] : e.kind === 'V' ? [{ ...e, value: 0 }] : [e],
  );
  const nodes = new Set(passive.flatMap((e) => [e.a, e.b]));
  if (!nodes.has(a) || !nodes.has(b)) throw new CircuitError('INVALID_OPTIONS', 'گره‌های مورد نظر در مدار نیستند.');
  const test: NetElement = { id: '__test__', kind: 'I', a: b, b: a, value: 1 }; // ۱ آمپر وارد گره a می‌شود
  const sol = solveDC([...passive, test], ground);
  return sol.nodeVoltages[a] - sol.nodeVoltages[b];
}

export interface TimeConstant {
  id: string;
  /** ثانیه */
  tau: number;
}

/** ثابت زمانی هر خازن (R·C) و هر سلف (L/R) با R معادل دیده‌شده از دو سر آن قطعه. */
export function timeConstants(elements: NetElement[], ground: NodeId = '0'): TimeConstant[] {
  const out: TimeConstant[] = [];
  for (const e of elements) {
    if (e.kind !== 'C' && e.kind !== 'L') continue;
    let r: number;
    try {
      r = equivalentResistance(elements.filter((x) => x !== e), e.a, e.b, ground);
    } catch (err) {
      if (err instanceof CircuitError) continue; // مسیر مقاومتی وجود ندارد
      throw err;
    }
    const tau = e.kind === 'C' ? r * e.value : e.value / r;
    if (Number.isFinite(tau) && tau > 0) out.push({ id: e.id, tau });
  }
  return out;
}
