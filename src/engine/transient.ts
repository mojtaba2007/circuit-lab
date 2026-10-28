import { CircuitError } from './errors';
import { solveLinear } from './linear';
import { solveDC } from './mna';
import { makeLayout, newSystem, nodeIdx, rowOf, stampBranch, stampConductance, stampCurrent } from './system';
import type { NetElement, NodeId } from './types';

export const MAX_STEPS = 200_000;
export type IntegrationMethod = 'trapezoidal' | 'backward-euler';

export interface TransientOptions {
  /** زمان پایان (ثانیه) */
  stop: number;
  /** گام زمانی ثابت (ثانیه) */
  dt: number;
  ground?: NodeId;
  /** پیش‌فرض: trapezoidal (دقت مرتبه ۲). backward-euler پایدارتر ولی کم‌دقت‌تر است. */
  method?: IntegrationMethod;
  /** 'ic': از شرط‌های اولیه خازن‌ها و سلف‌ها (پیش‌فرض ۰)؛ 'dc': از حالت پایدار DC */
  initial?: 'ic' | 'dc';
}
export interface TransientResult {
  /** نمونه‌های زمانی از 0 تا stop (شامل لحظه 0+) */
  times: number[];
  nodeVoltages: Record<NodeId, number[]>;
  elements: Record<string, { voltage: number[]; current: number[] }>;
}

interface State {
  v: number;
  i: number;
}

/**
 * تحلیل گذرا با مدل‌های هم‌ارز (companion model):
 * - خازن: هدایت g = k·C/dt موازی با منبع جریان (k=1 برای Backward Euler و 2 برای Trapezoidal)
 * - سلف: شاخه با مقاومت معادل k·L/dt و منبع ولتاژ وابسته به گام قبل
 * منابع در لحظه 0+ پله می‌شوند. وضعیت لحظه 0+ از حل DC با جایگزینی خازن ← منبع ولتاژ (ic)
 * و سلف ← منبع جریان (ic) به‌دست می‌آید (رویکرد UIC در SPICE).
 */
export function solveTransient(elements: NetElement[], options: TransientOptions): TransientResult {
  const { stop, dt, ground = '0', method = 'trapezoidal', initial = 'ic' } = options;
  const steps = Math.round(stop / dt);
  if (!(stop > 0) || !(dt > 0) || !Number.isFinite(stop) || !Number.isFinite(dt) || steps < 1 || steps > MAX_STEPS) {
    throw new CircuitError('INVALID_OPTIONS', `زمان پایان و گام زمانی باید مثبت باشند و تعداد گام‌ها بین 1 و ${MAX_STEPS}.`);
  }
  const layout = makeLayout(elements, ground);
  const reactive = elements.filter((e) => e.kind === 'C' || e.kind === 'L');

  const ic = new Map<string, number>(reactive.map((e) => [e.id, e.ic ?? 0] as [string, number]));
  if (initial === 'dc') {
    const dc = solveDC(elements, ground);
    for (const e of reactive) ic.set(e.id, e.kind === 'C' ? dc.elements[e.id].voltage : dc.elements[e.id].current);
  }
  const start = solveDC(
    elements.map((e) =>
      e.kind === 'C' ? { ...e, kind: 'V' as const, value: ic.get(e.id) ?? 0 }
        : e.kind === 'L' ? { ...e, kind: 'I' as const, value: ic.get(e.id) ?? 0 }
        : e,
    ),
    ground,
  );

  const times: number[] = [0];
  const nodeV: Record<NodeId, number[]> = {};
  for (const [node, v] of Object.entries(start.nodeVoltages)) nodeV[node] = [v];
  const elemR: TransientResult['elements'] = {};
  const state = new Map<string, State>();
  for (const e of elements) {
    const r = start.elements[e.id];
    elemR[e.id] = { voltage: [r.voltage], current: [r.current] };
    if (e.kind === 'C' || e.kind === 'L') state.set(e.id, { v: r.voltage, i: r.current });
  }

  const trap = method === 'trapezoidal';
  const k = trap ? 2 : 1;
  for (let step = 1; step <= steps; step++) {
    const s = newSystem(layout.size);
    const companion = new Map<string, { g: number; ieq: number }>();
    for (const e of elements) {
      const a = nodeIdx(layout, e.a);
      const b = nodeIdx(layout, e.b);
      const st = state.get(e.id);
      if (e.kind === 'R') stampConductance(s, a, b, 1 / e.value);
      else if (e.kind === 'I') stampCurrent(s, a, b, e.value);
      else if (e.kind === 'V') stampBranch(s, a, b, rowOf(layout, e.id), e.value);
      else if (e.kind === 'C' && st) {
        const g = (k * e.value) / dt;
        const ieq = g * st.v + (trap ? st.i : 0);
        companion.set(e.id, { g, ieq });
        stampConductance(s, a, b, g);
        stampCurrent(s, a, b, -ieq);
      } else if (e.kind === 'L' && st) {
        const req = (k * e.value) / dt;
        stampBranch(s, a, b, rowOf(layout, e.id), -(req * st.i + (trap ? st.v : 0)), req);
      }
    }
    const x = solveLinear(s.A, s.z);
    const volt = (node: NodeId) => {
      const i = layout.index.get(node);
      return i === undefined ? 0 : x[i];
    };
    times.push(step * dt);
    for (const node of Object.keys(nodeV)) nodeV[node].push(volt(node));
    for (const e of elements) {
      const voltage = volt(e.a) - volt(e.b);
      let current: number;
      if (e.kind === 'R') current = voltage / e.value;
      else if (e.kind === 'I') current = e.value;
      else if (e.kind === 'C') {
        const c = companion.get(e.id);
        current = c ? c.g * voltage - c.ieq : 0;
      } else current = x[rowOf(layout, e.id)];
      elemR[e.id].voltage.push(voltage);
      elemR[e.id].current.push(current);
      if (e.kind === 'C' || e.kind === 'L') state.set(e.id, { v: voltage, i: current });
    }
  }
  return { times, nodeVoltages: nodeV, elements: elemR };
}
