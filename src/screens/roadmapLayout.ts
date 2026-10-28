/**
 * چینش نقشه‌ی مراحل به شکل یک مدار واقعی: از باتری شروع می‌شود، سیم اصلی از میان هر «جهان»
 * عبور می‌کند و هر جهان یک نقش مدار دارد (قطعه‌ی سری، دو شاخه‌ی موازی، پل با آشکارساز، خازن و سلف)
 * و در انتها لامپ هدف نهایی است. مرحله‌ها روی سیم‌ها نشسته‌اند.
 *
 * هر سیم/قطعه یک `dep` دارد: اندیس مرحله‌ای که باید حل شده باشد تا آن بخش «برق‌دار» شود (−1 = همیشه).
 */
export type SymbolKind = 'battery' | 'R' | 'C' | 'L' | 'lamp';
export interface MapNode { level: number; x: number; y: number; side: 'l' | 'r' }
export interface MapWire { d: string; dep: number }
export interface MapSymbol { kind: SymbolKind; x: number; y: number; dep: number; rot?: number }
export interface MapBanner { section: number; world: string; x: number; y: number; first: number; count: number }
export interface MapJunction { x: number; y: number; dep: number }
export interface MapLayout {
  width: number;
  height: number;
  nodes: MapNode[];
  wires: MapWire[];
  symbols: MapSymbol[];
  banners: MapBanner[];
  junctions: MapJunction[];
}

export type SectionSpec =
  /** سیم اصلی با یک قطعه‌ی سری؛ pre مرحله قبل از قطعه و post بعد از آن */
  | { world: string; kind: 'series'; pre: number; post: number; symbol: SymbolKind }
  /** مرحله‌های روی سیم اصلی (pre)، سپس دو شاخه‌ی موازی (left و right)، بعد دوباره سیم اصلی (post) */
  | { world: string; kind: 'parallel'; pre: number; left: number; right: number; post: number; symbolL: SymbolKind; symbolR: SymbolKind; detector?: boolean };

/** هر عنصر یک جهان است و مجموع مرحله‌هایش باید با LEVELS هم‌خوان باشد (تست این را تضمین می‌کند). */
export const SECTIONS: SectionSpec[] = [
  { world: 'مبانی', kind: 'series', pre: 2, post: 4, symbol: 'R' },
  { world: 'کیرشهف', kind: 'parallel', pre: 0, left: 2, right: 2, post: 0, symbolL: 'R', symbolR: 'R' },
  { world: 'معادل', kind: 'parallel', pre: 1, left: 1, right: 1, post: 2, symbolL: 'R', symbolR: 'R' },
  { world: 'تحلیل', kind: 'parallel', pre: 2, left: 1, right: 1, post: 2, symbolL: 'R', symbolR: 'R' },
  { world: 'پیشرفته', kind: 'parallel', pre: 1, left: 1, right: 1, post: 1, symbolL: 'R', symbolR: 'R', detector: true },
  { world: 'خازن و سلف', kind: 'parallel', pre: 0, left: 3, right: 1, post: 2, symbolL: 'C', symbolR: 'L' },
];

export const MAP_W = 640;
export const MX = 320; // سیم اصلی
export const LX = 170; // شاخه‌ی چپ
export const RX = 470; // شاخه‌ی راست
export const STEP = 80;
export const HALF = 22; // نیم‌طول نماد قطعه

export function buildLayout(sections: SectionSpec[] = SECTIONS): MapLayout {
  const out: MapLayout = { width: MAP_W, height: 0, nodes: [], wires: [], symbols: [], banners: [], junctions: [] };
  let level = 0;
  let y = 124;
  let dep = -1;
  const wire = (d: string, wireDep: number) => out.wires.push({ d, dep: wireDep });
  out.symbols.push({ kind: 'battery', x: MX, y: 60, dep: -1 });

  const mainNode = () => {
    const ny = y + STEP;
    wire(`M${MX} ${y}V${ny}`, dep);
    out.nodes.push({ level, x: MX, y: ny, side: 'r' });
    dep = level;
    level += 1;
    y = ny;
  };
  const mainSymbol = (kind: SymbolKind) => {
    const cy = y + 54;
    wire(`M${MX} ${y}V${cy - HALF}`, dep);
    out.symbols.push({ kind, x: MX, y: cy, dep });
    y = cy + HALF;
  };

  sections.forEach((spec, si) => {
    const first = level;
    const y0 = y;
    y += 66; // فضای نام جهان
    wire(`M${MX} ${y0}V${y}`, dep);
    out.banners.push({ section: si, world: spec.world, x: 24, y: y0 + 30, first, count: 0 });

    if (spec.kind === 'series') {
      for (let i = 0; i < spec.pre; i++) mainNode();
      mainSymbol(spec.symbol);
      for (let i = 0; i < spec.post; i++) mainNode();
    } else {
      for (let i = 0; i < spec.pre; i++) mainNode();
      const yS = y + 52;
      wire(`M${MX} ${y}V${yS}`, dep);
      out.junctions.push({ x: MX, y: yS, dep });
      const dep0 = dep;
      const branch = (x: number, count: number, symbol: SymbolKind, startDep: number) => {
        let by = yS;
        let bdep = startDep;
        wire(`M${MX} ${yS}H${x}`, startDep);
        for (let i = 0; i < count; i++) {
          const ny = by + (i === 0 ? 60 : STEP);
          wire(`M${x} ${by}V${ny}`, bdep);
          out.nodes.push({ level, x, y: ny, side: x < MX ? 'l' : 'r' });
          bdep = level;
          level += 1;
          by = ny;
        }
        const cy = by + 54;
        wire(`M${x} ${by}V${cy - HALF}`, bdep);
        out.symbols.push({ kind: symbol, x, y: cy, dep: bdep });
        return { endY: cy + HALF, lastDep: bdep };
      };
      const left = branch(LX, spec.left, spec.symbolL, dep0);
      const right = branch(RX, spec.right, spec.symbolR, spec.left > 0 ? left.lastDep : dep0);
      const yM = Math.max(left.endY, right.endY) + 40;
      wire(`M${LX} ${left.endY}V${yM}H${MX}`, left.lastDep);
      wire(`M${RX} ${right.endY}V${yM}H${MX}`, right.lastDep);
      out.junctions.push({ x: MX, y: yM, dep: right.lastDep });
      if (spec.detector) {
        const dy = yS + 90; // آشکارساز پل بین دو شاخه
        wire(`M${LX} ${dy}H${MX - HALF}`, right.lastDep);
        wire(`M${MX + HALF} ${dy}H${RX}`, right.lastDep);
        out.symbols.push({ kind: 'R', x: MX, y: dy, dep: right.lastDep, rot: 90 });
        out.junctions.push({ x: LX, y: dy, dep: right.lastDep }, { x: RX, y: dy, dep: right.lastDep });
      }
      dep = spec.right > 0 ? right.lastDep : left.lastDep;
      y = yM;
      for (let i = 0; i < spec.post; i++) mainNode();
    }
    out.banners[si].count = level - first;
  });

  const lampY = y + 82;
  wire(`M${MX} ${y}V${lampY - 24}`, dep);
  out.symbols.push({ kind: 'lamp', x: MX, y: lampY, dep: level - 1 });
  out.height = lampY + 96;
  return out;
}
