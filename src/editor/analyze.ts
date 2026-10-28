import { CircuitError, explainDC, formatValue, solveDC, type ExplainStep, type Solution } from '../engine';
import { key, type Circuit, type Point } from './model';
import { buildNetlist } from './netlist';

export interface NodeLabel {
  at: Point;
  text: string;
}
export type Analysis =
  | { ok: true; solution: Solution; steps: ExplainStep[]; labels: NodeLabel[] }
  | { ok: false; message: string };

/** تحلیل DC مدار برای نمایش: جواب، مراحل حل و برچسب ولتاژ گره‌ها. */
export function analyze(c: Circuit): Analysis {
  try {
    const net = buildNetlist(c);
    const solution = solveDC(net.elements, net.ground);
    const labels: NodeLabel[] = [];
    const seen = new Set<string>();
    for (const p of c.parts)
      for (const pt of [p.a, p.b]) {
        const n = net.nodeByPoint.get(key(pt));
        if (n && n !== net.ground && !seen.has(n)) {
          seen.add(n);
          labels.push({ at: pt, text: `V${n} = ${formatValue(solution.nodeVoltages[n], 'V')}` });
        }
      }
    return { ok: true, solution, steps: explainDC(net.elements, solution, net.ground), labels };
  } catch (e) {
    if (e instanceof CircuitError) return { ok: false, message: e.message };
    throw e;
  }
}
