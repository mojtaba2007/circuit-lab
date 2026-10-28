import { solveLinear } from './linear';
import { makeLayout, newSystem, nodeIdx, rowOf, stampBranch, stampConductance, stampCurrent, type Layout } from './system';
import type { NetElement, NodeId, Solution } from './types';

/**
 * تحلیل DC پایدار به روش MNA (Modified Nodal Analysis).
 * مجهول‌ها: ولتاژ گره‌ها (به‌جز زمین) + جریان هر منبع ولتاژ و هر سلف.
 * در DC پایدار خازن مدار باز و سلف اتصال کوتاه (منبع ولتاژ صفر) است.
 */
export function solveDC(elements: NetElement[], ground: NodeId = '0'): Solution {
  const l = makeLayout(elements, ground);
  const s = newSystem(l.size);
  for (const e of elements) {
    const a = nodeIdx(l, e.a);
    const b = nodeIdx(l, e.b);
    if (e.kind === 'R') stampConductance(s, a, b, 1 / e.value);
    else if (e.kind === 'I') stampCurrent(s, a, b, e.value);
    else if (e.kind === 'V') stampBranch(s, a, b, rowOf(l, e.id), e.value);
    else if (e.kind === 'L') stampBranch(s, a, b, rowOf(l, e.id), 0);
    // خازن: مدار باز، چیزی استمپ نمی‌شود
  }
  return readSolution(l, elements, solveLinear(s.A, s.z));
}

function readSolution(l: Layout, elements: NetElement[], x: number[]): Solution {
  const v = (node: NodeId) => {
    const i = l.index.get(node);
    return i === undefined ? 0 : x[i];
  };
  const nodeVoltages: Solution['nodeVoltages'] = { [l.ground]: 0 };
  for (const [node, i] of l.index) nodeVoltages[node] = x[i];

  const result: Solution['elements'] = {};
  for (const e of elements) {
    const voltage = v(e.a) - v(e.b);
    let current: number;
    if (e.kind === 'R') current = voltage / e.value;
    else if (e.kind === 'I') current = e.value;
    else if (e.kind === 'C') current = 0;
    else current = x[rowOf(l, e.id)];
    result[e.id] = { voltage, current, power: voltage * current };
  }
  return { nodeVoltages, elements: result };
}
