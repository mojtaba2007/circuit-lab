import type { ReactNode } from 'react';
import type { ArtKind, RailKind } from '../screens/roadmapModel';

/** مسیرهای طرح شماتیک هر جهان در جعبه‌ی 120×56 */
const ART: Record<ArtKind, string[]> = {
  series: ['M4 28H34', 'M34 28L40 17L48 39L56 17L64 39L72 17L78 28', 'M78 28H116'],
  kirchhoff: ['M60 4H32V16M32 40V52H88V40M88 16V4H60', 'M26 16h12v24H26z', 'M82 16h12v24H82z'],
  equiv: ['M8 28H22V13H40M80 13H98V28H112M22 28V43H40M80 43H98', 'M40 7h40v12H40z', 'M40 37h40v12H40z'],
  divider: ['M46 2V9M46 25V29H104M46 29V33M46 47V54', 'M40 9h12v16H40z', 'M40 33h12v14H40z'],
  bridge: ['M60 4L18 28L60 52L102 28Z', 'M18 28H102', 'M52 22h16v12H52z'],
  rc: ['M4 28H24', 'M24 22h26v12H24z', 'M50 28H74M74 28V36M64 36H84M64 43H84M74 43V54', 'M74 28H84a5 5 0 0 1 10 0a5 5 0 0 1 10 0H116'],
};

/** طرح شماتیک جهان؛ با پیشرفت، سیم‌های آن به‌تدریج روشن می‌شوند (pct از 0 تا 100). */
export function ZoneArt({ kind, pct }: { kind: ArtKind; pct: number }) {
  return (
    <svg className="z-art" viewBox="0 0 120 56" aria-hidden="true">
      <g className="art-base">{ART[kind].map((d) => <path key={d} d={d} />)}</g>
      <g className="art-lit">{ART[kind].map((d) => <path key={d} d={d} pathLength={100} strokeDasharray={100} strokeDashoffset={100 - pct} />)}</g>
    </svg>
  );
}

export function Ring({ pct, size = 52, stroke = 5, children }: { pct: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="ring" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(pct)} درصد`}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="ring-fg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="ring-label">{children}</span>
    </span>
  );
}

export function BatteryArt() {
  return (
    <svg className="cap-art battery" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="10" y="14" width="44" height="38" rx="11" className="cap-body" />
      <path d="M32 6V14" />
      <path d="M20 28H44M25 38H39" />
      <text x="46" y="26" className="cap-plus">+</text>
    </svg>
  );
}

export function LampArt({ on }: { on: boolean }) {
  return (
    <svg className={`cap-art lamp${on ? ' on' : ''}`} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="28" r="19" className="bulb" />
      <path d="M24 28L28 36L32 24L36 36L40 28" className="filament" />
      <path d="M25 49H39M27 55H37" />
    </svg>
  );
}

/** قطعه‌ی روی سیم هر جهان (عمودی، در جعبه‌ی 46×44) */
export function RailSymbol({ kind }: { kind: RailKind }) {
  const d = {
    R: 'M23 0V8L14 13 32 21 14 29 32 37 23 42V44',
    C: 'M23 0V17M10 17H36M10 27H36M23 27V44',
    L: 'M23 0V6a6 6 0 0 1 0 12a6 6 0 0 1 0 12a6 6 0 0 1 0 12V44',
  }[kind];
  return <svg className="rail-sym" viewBox="0 0 46 44" aria-hidden="true"><path d={d} /></svg>;
}
