import { CircuitError, solveDC } from '../engine';
import { key, type Circuit } from '../editor/model';
import { buildNetlist } from '../editor/netlist';
import type { ChooseCriterion, Claim, Quantity } from './types';

export const quantityUnit = (q: Quantity): string => (q.quantity === 'current' ? 'A' : q.quantity === 'power' ? 'W' : 'V');

/** مقدار مطلق کمیت در حالت DC پایدار (برای گره: ولتاژ نسبت به زمین) */
function measure(q: Quantity, circuit: Circuit): number {
  const net = buildNetlist(circuit);
  const sol = solveDC(net.elements, net.ground);
  if (q.quantity === 'node') {
    const node = net.nodeByPoint.get(key(q.at));
    if (node === undefined) throw new CircuitError('INVALID_OPTIONS', 'نقطه مورد نظر به هیچ قطعه‌ای وصل نیست.');
    return sol.nodeVoltages[node];
  }
  const r = sol.elements[q.id];
  if (!r) throw new CircuitError('INVALID_OPTIONS', `قطعه ${q.id} در مدار نیست.`);
  return Math.abs(q.quantity === 'current' ? r.current : q.quantity === 'voltage' ? r.voltage : r.power);
}

export type Verdict = { ok: true; truth: boolean } | { ok: false; message: string };

/** درستی یک گزاره را با موتور می‌سنجد. */
export function evaluateClaim(claim: Claim, circuit: Circuit): Verdict {
  if (claim.kind === 'fixed') return { ok: true, truth: claim.value };
  try {
    if (claim.kind === 'value') {
      const actual = measure(claim.a, circuit);
      const limit = Math.max((claim.tol ?? 0.01) * Math.abs(claim.target), claim.abs ?? 1e-9);
      return { ok: true, truth: Math.abs(actual - claim.target) <= limit };
    }
    const a = measure(claim.a, circuit);
    const b = measure(claim.b, circuit);
    const eps = (claim.tol ?? 0.01) * Math.max(Math.abs(a), Math.abs(b), 1e-12);
    const truth = claim.op === '>' ? a - b > eps : claim.op === '<' ? b - a > eps : Math.abs(a - b) <= eps;
    return { ok: true, truth };
  } catch (e) {
    if (e instanceof CircuitError) return { ok: false, message: e.message };
    throw e;
  }
}

export type Prediction = { ok: true; index: number; actual: number; unit: string } | { ok: false; message: string };

/** نزدیک‌ترین گزینه به مقدار واقعی، گزینه‌ی درست است. */
export function correctOption(ask: Quantity, options: number[], circuit: Circuit): Prediction {
  try {
    const actual = measure(ask, circuit);
    let index = 0;
    let best = Infinity;
    options.forEach((o, i) => {
      const err = Math.abs(o - actual);
      if (err < best) {
        best = err;
        index = i;
      }
    });
    return { ok: true, index, actual, unit: quantityUnit(ask) };
  } catch (e) {
    if (e instanceof CircuitError) return { ok: false, message: e.message };
    throw e;
  }
}

export type Choice = { ok: true; index: 0 | 1 } | { ok: false; message: string };

/** مدار درست در سؤال «کدام مدار؟» (۰ = A و ۱ = B). اگر معیار مبهم باشد خطا برمی‌گرداند. */
export function correctCircuit(criterion: ChooseCriterion, a: Circuit, b: Circuit): Choice {
  if (criterion.kind === 'claim') {
    const ta = evaluateClaim(criterion.claim, a);
    const tb = evaluateClaim(criterion.claim, b);
    if (!ta.ok) return { ok: false, message: `مدار A: ${ta.message}` };
    if (!tb.ok) return { ok: false, message: `مدار B: ${tb.message}` };
    if (ta.truth === tb.truth) return { ok: false, message: 'معیار سؤال بین دو مدار تفاوتی نمی‌گذارد.' };
    return { ok: true, index: ta.truth ? 0 : 1 };
  }
  try {
    const va = measure(criterion.quantity, a);
    const vb = measure(criterion.quantity, b);
    if (Math.abs(va - vb) <= 1e-9 * Math.max(Math.abs(va), Math.abs(vb), 1)) return { ok: false, message: 'مقدار دو مدار برابر است.' };
    return { ok: true, index: (criterion.pick === 'max' ? va > vb : va < vb) ? 0 : 1 };
  } catch (e) {
    if (e instanceof CircuitError) return { ok: false, message: e.message };
    throw e;
  }
}
