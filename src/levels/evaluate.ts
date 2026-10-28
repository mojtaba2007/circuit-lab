import { CircuitError, formatValue, solveDC, solveTransient } from '../engine';
import { key, type Circuit } from '../editor/model';
import { buildNetlist } from '../editor/netlist';
import type { Goal, SimpleGoal } from './types';

/** نتیجه‌ی یکی از هدف‌های یک مرحله‌ی چندهدفی */
export interface GoalPart {
  label: string;
  target: number;
  unit: string;
  actual: number;
  met: boolean;
}
export type GoalResult =
  | {
      ok: true;
      met: boolean;
      actual: number;
      target: number;
      unit: string;
      label: string;
      /** |actual − target| نسبت به حد مجاز؛ ≤ 1 یعنی هدف محقق شده و 0 یعنی دقیق (برای چندهدفی: بدترین) */
      closeness: number;
      /** فقط برای هدف `all` */
      parts?: GoalPart[];
    }
  | { ok: false; message: string };

type Ok = Extract<GoalResult, { ok: true }>;

/** تعداد گام‌های تحلیل گذرا برای سنجش هدف‌های زمانی (خطای Trapezoidal در این گام ناچیز است) */
const TRANSIENT_STEPS = 1000;

function evaluateSimple(goal: SimpleGoal, circuit: Circuit): GoalResult {
  try {
    const net = buildNetlist(circuit);
    let actual: number;
    let label: string;
    let unit: string;
    if (goal.kind === 'transient' || goal.kind === 'peak') {
      const stop = goal.kind === 'transient' ? goal.at : goal.within;
      const res = solveTransient(net.elements, { stop, dt: stop / TRANSIENT_STEPS, ground: net.ground, initial: goal.initial });
      const r = res.elements[goal.id];
      if (!r) return { ok: false, message: `قطعه ${goal.id} در مدار نیست.` };
      const series = goal.quantity === 'voltage' ? r.voltage : r.current;
      const what = goal.quantity === 'voltage' ? 'ولتاژ' : 'جریان';
      if (goal.kind === 'transient') {
        actual = Math.abs(series[series.length - 1]);
        label = `${what} ${goal.id} در ${formatValue(stop, 's')}`;
      } else {
        actual = series.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        label = `بیشینه‌ی ${what} ${goal.id} تا ${formatValue(stop, 's')}`;
      }
      unit = goal.quantity === 'voltage' ? 'V' : 'A';
    } else {
      const sol = solveDC(net.elements, net.ground);
      if (goal.kind === 'node') {
        const node = net.nodeByPoint.get(key(goal.at));
        if (node === undefined) return { ok: false, message: 'نقطه هدف به هیچ قطعه‌ای وصل نیست.' };
        actual = sol.nodeVoltages[node];
        label = 'ولتاژ گره هدف';
        unit = 'V';
      } else {
        const r = sol.elements[goal.id];
        if (!r) return { ok: false, message: `قطعه ${goal.id} در مدار نیست.` };
        if (goal.kind === 'current') [actual, label, unit] = [Math.abs(r.current), `جریان ${goal.id}`, 'A'];
        else if (goal.kind === 'voltage') [actual, label, unit] = [Math.abs(r.voltage), `ولتاژ ${goal.id}`, 'V'];
        else [actual, label, unit] = [Math.abs(r.power), `توان ${goal.id}`, 'W'];
      }
    }
    const limit = Math.max((goal.tol ?? 0.01) * Math.abs(goal.target), goal.abs ?? 1e-9);
    const closeness = Math.abs(actual - goal.target) / limit;
    return { ok: true, met: closeness <= 1, actual, target: goal.target, unit, label, closeness };
  } catch (e) {
    if (e instanceof CircuitError) return { ok: false, message: e.message };
    throw e;
  }
}

/** بررسی هدف مرحله روی مدار فعلی. تلورانس نسبی پیش‌فرض ۱٪ و تلورانس مطلق پیش‌فرض 1e-9 است. */
export function evaluateGoal(goal: Goal, circuit: Circuit): GoalResult {
  if (goal.kind !== 'all') return evaluateSimple(goal, circuit);
  const results: Ok[] = [];
  for (const g of goal.goals) {
    const r = evaluateSimple(g, circuit);
    if (!r.ok) return r;
    results.push(r);
  }
  const first = results[0];
  return {
    ok: true,
    met: results.every((r) => r.met),
    actual: first.actual,
    target: first.target,
    unit: first.unit,
    label: results.map((r) => r.label).join(' و '),
    closeness: Math.max(...results.map((r) => r.closeness)),
    parts: results.map((r) => ({ label: r.label, target: r.target, unit: r.unit, actual: r.actual, met: r.met })),
  };
}

/** پیام بعد از ثبت اشتباه: فقط جهت خطا (بیشتر/کمتر)، نه مقدار؛ برای چندهدفی فقط هدف‌های برآورده‌نشده. */
export function feedbackFor(r: Ok): string {
  const dir = (a: number, t: number) => (a > t ? 'بیشتر' : 'کمتر');
  if (r.parts) {
    const bad = r.parts.filter((p) => !p.met);
    return bad.map((p) => `${p.label} ${dir(p.actual, p.target)} از مقدار هدف است`).join('؛ ') + '.';
  }
  return `${r.label} ${dir(r.actual, r.target)} از مقدار هدف است.`;
}
