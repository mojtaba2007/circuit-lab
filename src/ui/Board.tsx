import { memo, useRef, type PointerEvent } from 'react';
import { formatValue, type Solution } from '../engine';
import type { NodeLabel } from '../editor/analyze';
import { GRID, UNIT, samePoint, type Circuit, type Part, type PartKind, type Point } from '../editor/model';
import { goalFocus, type Goal, type Slot } from '../levels/types';

const { cols, rows, size: S } = GRID;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
/** نیم‌طول بدنه هر قطعه؛ سیم از دو سر تا لبه‌ی بدنه کشیده می‌شود */
const HALF: Record<PartKind, number> = { R: 22, L: 22, V: 5, C: 5, I: 15, W: 0 };

interface Props {
  circuit: Circuit;
  solution: Solution | null;
  labels: NodeLabel[];
  pending: Point | null;
  hover: Point | null;
  selected: string | null;
  tool: string;
  goal: Goal | null;
  slots?: Slot[];
  readOnly?: boolean;
  locked: ReadonlySet<string>;
  onPoint: (p: Point, partId: string | null) => void;
  onHover: (p: Point | null) => void;
}

const Grid = memo(function Grid() {
  return (
    <>
      {Array.from({ length: (cols + 1) * (rows + 1) }, (_, i) => (
        <circle key={i} className="dot" cx={(i % (cols + 1)) * S} cy={Math.floor(i / (cols + 1)) * S} r={1.6} />
      ))}
    </>
  );
});

interface PartProps {
  part: Part;
  current: number | null;
  selected: boolean;
  locked: boolean;
  target: boolean;
}
function PartView({ part, current, selected, locked, target }: PartProps) {
  const x1 = part.a[0] * S, y1 = part.a[1] * S, x2 = part.b[0] * S, y2 = part.b[1] * S;
  const L = Math.hypot(x2 - x1, y2 - y1);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const wire = part.kind === 'W';
  const h = wire ? 0 : Math.min(HALF[part.kind], L / 2);
  const flowing = current !== null && Math.abs(current) > 1e-9;
  const cls = 'wire' + (flowing ? ((current ?? 0) < 0 ? ' flow rev' : ' flow') : '');
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  const title = `${part.id} = ${formatValue(part.value, UNIT[part.kind])}${locked ? ' 🔒' : ''}`;
  const sub = current === null ? '' : `I = ${formatValue(Math.abs(current), 'A')}`;
  const tx = horizontal ? mx : mx + 26;
  const anchor = horizontal ? 'middle' : 'start';
  return (
    <g data-part-id={part.id}>
      {target && <circle className="goalmark" cx={mx} cy={my} r={34} />}
      {selected && <circle className="sel" cx={mx} cy={my} r={30} />}
      <g transform={`translate(${mx} ${my}) rotate(${ang})`}>
        {wire ? (
          <line className={cls} x1={-L / 2} x2={L / 2} />
        ) : (
          <>
            <line className={cls} x1={-L / 2} x2={-h} />
            <line className={cls} x1={h} x2={L / 2} />
          </>
        )}
        {part.kind === 'R' && <rect className="wire body" x={-h} y={-9} width={2 * h} height={18} />}
        {part.kind === 'V' && (
          <>
            <line className="wire" x1={-5} y1={-15} x2={-5} y2={15} />
            <line className="wire" x1={5} y1={-8} x2={5} y2={8} />
            <text className="lbl" x={-h - 2} y={-8}>+</text>
          </>
        )}
        {part.kind === 'I' && (
          <>
            <circle className="wire body" r={15} />
            <path className="wire" d="M-8 0H8M3-5L8 0L3 5" />
          </>
        )}
        {part.kind === 'C' && (
          <>
            <line className="wire" x1={-5} y1={-14} x2={-5} y2={14} />
            <line className="wire" x1={5} y1={-14} x2={5} y2={14} />
          </>
        )}
        {part.kind === 'L' && (
          <path className="wire" transform={`scale(${h / 22} 1)`} d="M-22 0a5.5 5.5 0 0 1 11 0a5.5 5.5 0 0 1 11 0a5.5 5.5 0 0 1 11 0a5.5 5.5 0 0 1 11 0" />
        )}
        <circle className="pin" cx={-L / 2} r={3.5} />
        <circle className="pin" cx={L / 2} r={3.5} />
        <line className="hit" x1={-L / 2} x2={L / 2} />
      </g>
      {!wire && (
        <>
          <text className="lbl" x={tx} y={horizontal ? my - 24 : my - 2} textAnchor={anchor}>{title}</text>
          <text className="lbl sub" x={tx} y={horizontal ? my + 34 : my + 14} textAnchor={anchor}>{sub}</text>
        </>
      )}
    </g>
  );
}

function SlotView({ slot }: { slot: Slot }) {
  const x1 = slot.a[0] * S, y1 = slot.a[1] * S, x2 = slot.b[0] * S, y2 = slot.b[1] * S;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return (
    <g className="slot" aria-hidden="true">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <circle cx={x1} cy={y1} r={6} />
      <circle cx={x2} cy={y2} r={6} />
      <rect x={mx - 16} y={my - 16} width={32} height={32} rx={9} />
      <text x={mx} y={my + 6} textAnchor="middle">؟</text>
    </g>
  );
}
const sameEnds = (p: Part, s: Slot) => (samePoint(p.a, s.a) && samePoint(p.b, s.b)) || (samePoint(p.a, s.b) && samePoint(p.b, s.a));

export function Board({ circuit, solution, labels, pending, hover, selected, tool, goal, slots, readOnly, locked, onPoint, onHover }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const toPoint = (e: PointerEvent): Point => {
    const r = ref.current!.getBoundingClientRect();
    const x = -10 + ((e.clientX - r.left) * 820) / r.width;
    const y = -10 + ((e.clientY - r.top) * 500) / r.height;
    return [clamp(Math.round(x / S), 0, cols), clamp(Math.round(y / S), 0, rows)];
  };
  const g = circuit.ground;
  const focus = goalFocus(goal);
  return (
    <div className="board-wrap">
      <svg
        ref={ref}
        className={`board tool-${readOnly ? 'ro' : tool}`}
        viewBox="-10 -10 820 500"
        aria-label="برد مدار"
        onPointerDown={(e) => {
          if (readOnly) return;
          const hit = (e.target as Element).closest('[data-part-id]');
          onPoint(toPoint(e), hit?.getAttribute('data-part-id') ?? null);
        }}
        onPointerMove={(e) => onHover(toPoint(e))}
        onPointerLeave={() => onHover(null)}
      >
        <Grid />
        {slots?.filter((s) => !circuit.parts.some((p) => p.kind !== 'W' && sameEnds(p, s))).map((s) => <SlotView key={`${s.a}-${s.b}`} slot={s} />)}
        {circuit.parts.map((p) => (
          <PartView
            key={p.id} part={p} current={solution?.elements[p.id]?.current ?? null}
            selected={p.id === selected} locked={locked.has(p.id)} target={focus.ids.includes(p.id)}
          />
        ))}
        {g && <path className="wire" d={`M${g[0] * S} ${g[1] * S}v10M${g[0] * S - 12} ${g[1] * S + 10}h24M${g[0] * S - 8} ${g[1] * S + 15}h16M${g[0] * S - 4} ${g[1] * S + 20}h8`} />}
        {focus.points.map((pt) => <circle key={`${pt[0]},${pt[1]}`} className="goalmark" cx={pt[0] * S} cy={pt[1] * S} r={12} />)}
        {labels.map((l) => (
          <text key={l.text} className="lbl nodev" x={l.at[0] * S + 8} y={l.at[1] * S - 8}>{l.text}</text>
        ))}
        {hover && <circle className="snap" cx={hover[0] * S} cy={hover[1] * S} r={8} />}
        {pending && <circle className="pending" cx={pending[0] * S} cy={pending[1] * S} r={6} />}
        {pending && hover && <line className="rubber" x1={pending[0] * S} y1={pending[1] * S} x2={hover[0] * S} y2={hover[1] * S} />}
      </svg>
    </div>
  );
}
