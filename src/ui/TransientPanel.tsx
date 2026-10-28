import { useMemo, useState } from 'react';
import {
  CircuitError, formatValue, parseValue, solveTransient, timeConstants,
  type NetElement, type TimeConstant, type TransientResult,
} from '../engine';
import type { Circuit } from '../editor/model';
import type { Goal } from '../levels/types';
import { buildNetlist } from '../editor/netlist';

interface Signal {
  id: string;
  label: string;
  unit: string;
  data: number[];
}
type Model = { ok: true; elements: NetElement[]; ground: string; taus: TimeConstant[]; auto: number } | { ok: false; message: string };
type Sim = { ok: true; stop: number; result: TransientResult } | { ok: false; message: string };

/** تیک‌های «گرد» برای محور: گام ۱، ۲ یا ۵ ضرب در توان ۱۰ */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}

const W = 560, H = 260, ML = 66, MR = 14, MT = 14, MB = 34;

function LineChart({ times, values, unit, mark }: { times: number[]; values: number[]; unit: string; mark?: { t: number; v: number } }) {
  const [hover, setHover] = useState<number | null>(null);
  const tmax = times[times.length - 1];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 1e-9 * Math.max(1, Math.abs(hi))) {
    const pad = Math.max(Math.abs(hi) * 0.1, 1e-12);
    lo -= pad;
    hi += pad;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const x = (t: number) => ML + (t / tmax) * (W - ML - MR);
  const y = (v: number) => MT + (1 - (v - lo) / (hi - lo)) * (H - MT - MB);
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const h = hover === null ? null : Math.min(hover, values.length - 1);
  return (
    <svg
      className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="نمودار شبیه‌سازی گذرا"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        const frac = Math.max(0, Math.min(1, (px - ML) / (W - ML - MR)));
        setHover(Math.round(frac * (values.length - 1)));
      }}
      onPointerLeave={() => setHover(null)}
    >
      {niceTicks(lo, hi).map((v) => (
        <g key={`y${v}`}>
          <line className="gridline" x1={ML} x2={W - MR} y1={y(v)} y2={y(v)} />
          <text className="tick" x={ML - 6} y={y(v) + 3} textAnchor="end">{formatValue(v, unit)}</text>
        </g>
      ))}
      {niceTicks(0, tmax).map((t) => (
        <g key={`x${t}`}>
          <line className="gridline" x1={x(t)} x2={x(t)} y1={MT} y2={H - MB} />
          <text className="tick" x={x(t)} y={H - MB + 14} textAnchor="middle">{formatValue(t, 's')}</text>
        </g>
      ))}
      <line className="axis" x1={ML} x2={ML} y1={MT} y2={H - MB} />
      <line className="axis" x1={ML} x2={W - MR} y1={H - MB} y2={H - MB} />
      {mark && mark.t <= tmax && (
        <>
          <line className="goalline" x1={x(mark.t)} x2={x(mark.t)} y1={MT} y2={H - MB} />
          {mark.v >= lo && mark.v <= hi && <line className="goalline" x1={ML} x2={W - MR} y1={y(mark.v)} y2={y(mark.v)} />}
          {mark.v >= lo && mark.v <= hi && <circle className="goalpt" cx={x(mark.t)} cy={y(mark.v)} r={5} />}
        </>
      )}
      <path className="curve" d={path} />
      {h !== null && (
        <>
          <line className="cross" x1={x(times[h])} x2={x(times[h])} y1={MT} y2={H - MB} />
          <circle className="cursor" cx={x(times[h])} cy={y(values[h])} r={4} />
          <text className="readout" x={W - MR} y={MT + 10} textAnchor="end">t = {formatValue(times[h], 's')} · {formatValue(values[h], unit)}</text>
        </>
      )}
    </svg>
  );
}

function buildSignals(result: TransientResult, ground: string): Signal[] {
  const out: Signal[] = [];
  for (const [node, data] of Object.entries(result.nodeVoltages)) {
    if (node !== ground) out.push({ id: `n:${node}`, label: `V${node} (ولتاژ گره)`, unit: 'V', data });
  }
  for (const [id, r] of Object.entries(result.elements)) {
    out.push({ id: `v:${id}`, label: `V(${id})`, unit: 'V', data: r.voltage });
    out.push({ id: `i:${id}`, label: `I(${id})`, unit: 'A', data: r.current });
  }
  return out;
}

export function TransientPanel({ circuit, goal }: { circuit: Circuit; goal: Goal | null }) {
  // هدف‌های زمانی (در لحظه‌ی مشخص یا بیشینه تا یک لحظه) روی نمودار نشانه‌گذاری می‌شوند
  const tgoal = goal && (goal.kind === 'transient' || goal.kind === 'peak') ? goal : null;
  const goalTime = tgoal ? (tgoal.kind === 'transient' ? tgoal.at : tgoal.within) : 0;
  const [stopText, setStopText] = useState('');
  const [points, setPoints] = useState(500);
  const [initial, setInitial] = useState<'ic' | 'dc'>('ic');
  const [signalId, setSignalId] = useState<string | null>(null);

  const model = useMemo<Model>(() => {
    try {
      const net = buildNetlist(circuit);
      const taus = timeConstants(net.elements, net.ground);
      return { ok: true, elements: net.elements, ground: net.ground, taus, auto: Math.max(taus.length ? 5 * Math.max(...taus.map((t) => t.tau)) : 1e-3, goalTime * 1.5) };
    } catch (e) {
      if (e instanceof CircuitError) return { ok: false, message: e.message };
      throw e;
    }
  }, [circuit, goal]);

  const parsed = parseValue(stopText.trim().replace(/s$/i, ''));
  const stop = parsed > 0 ? parsed : model.ok ? model.auto : 0;
  const sim = useMemo<Sim | null>(() => {
    if (!model.ok) return null;
    try {
      return { ok: true, stop, result: solveTransient(model.elements, { stop, dt: stop / points, ground: model.ground, initial }) };
    } catch (e) {
      if (e instanceof CircuitError) return { ok: false, message: e.message };
      throw e;
    }
  }, [model, stop, points, initial]);

  const signals = useMemo(() => (sim && sim.ok && model.ok ? buildSignals(sim.result, model.ground) : []), [sim, model]);
  const firstC = circuit.parts.find((p) => p.kind === 'C');
  const firstL = circuit.parts.find((p) => p.kind === 'L');
  const goalSignal = tgoal ? `${tgoal.quantity === 'voltage' ? 'v' : 'i'}:${tgoal.id}` : null;
  const defaultId = goalSignal ?? (firstC ? `v:${firstC.id}` : firstL ? `i:${firstL.id}` : signals[0]?.id);
  const signal = signals.find((s) => s.id === signalId) ?? signals.find((s) => s.id === defaultId) ?? signals[0];

  return (
    <section className="card">
      <h2>شبیه‌سازی گذرا</h2>
      {!model.ok && <p className="muted">{model.message}</p>}
      {sim && !sim.ok && <p className="alert" role="alert">{sim.message}</p>}
      {model.ok && (
        <>
          <div className="tcontrols">
            <label>زمان کل
              <input dir="ltr" size={8} value={stopText} placeholder={formatValue(model.auto, 's')} aria-label="زمان کل شبیه‌سازی" onChange={(e) => setStopText(e.target.value)} />
            </label>
            <label>تعداد نقطه
              <select value={points} onChange={(e) => setPoints(+e.target.value)}>
                {[200, 500, 1000, 2000].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label>شروع از
              <select value={initial} onChange={(e) => setInitial(e.target.value as 'ic' | 'dc')}>
                <option value="ic">شرط‌های اولیه</option>
                <option value="dc">حالت پایدار DC</option>
              </select>
            </label>
            <label>نمودار
              <select value={signal?.id ?? ''} onChange={(e) => setSignalId(e.target.value)}>
                {signals.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>
          {sim && sim.ok && signal && <LineChart times={sim.result.times} values={signal.data} unit={signal.unit} mark={tgoal && signal.id === goalSignal ? { t: goalTime, v: tgoal.target } : undefined} />}
          {model.taus.length > 0 && (
            <p className="muted small" dir="ltr">
              {model.taus.map((t) => `τ(${t.id}) = ${formatValue(t.tau, 's')}`).join('   ·   ')}
            </p>
          )}
          <p className="muted small">با حرکت ماوس روی نمودار مقدار هر لحظه را ببین. زمان کل خالی = ۵ برابر بزرگ‌ترین ثابت زمانی.</p>
        </>
      )}
    </section>
  );
}
