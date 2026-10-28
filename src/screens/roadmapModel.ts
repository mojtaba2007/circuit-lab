import type { Level } from '../levels/types';

/**
 * مدل نقشه‌ی مراحل: هر «جهان» یک ناحیه‌ی مدار است (با طرح شماتیک و رنگ خودش) و ناحیه‌ها دو‌به‌دو
 * کنار هم، به‌عنوان شاخه‌های موازی دو طرف یک سیم اصلی، چیده می‌شوند. فقط داده و منطق، بدون رابط.
 */
export type ArtKind = 'series' | 'kirchhoff' | 'equiv' | 'divider' | 'bridge' | 'rc';
export type RailKind = 'R' | 'C' | 'L';

export interface ZoneSpec {
  world: string;
  art: ArtKind;
  color: string;
  /** قطعه‌هایی که روی سیم جهان، بعد از مرحله‌ی شماره‌ی `after` (از صفر، داخل جهان) قرار می‌گیرند */
  parts: { after: number; kind: RailKind }[];
}

export const ZONE_SPECS: ZoneSpec[] = [
  { world: 'مبانی', art: 'series', color: '#27d3ff', parts: [{ after: 2, kind: 'R' }, { after: 5, kind: 'R' }] },
  { world: 'کیرشهف', art: 'kirchhoff', color: '#8b7bff', parts: [{ after: 1, kind: 'R' }] },
  { world: 'معادل', art: 'equiv', color: '#34e3a0', parts: [{ after: 1, kind: 'R' }, { after: 3, kind: 'R' }, { after: 4, kind: 'R' }] },
  { world: 'تحلیل', art: 'divider', color: '#ffb020', parts: [{ after: 2, kind: 'R' }, { after: 4, kind: 'R' }, { after: 7, kind: 'R' }] },
  { world: 'پیشرفته', art: 'bridge', color: '#ff6fae', parts: [{ after: 1, kind: 'R' }, { after: 5, kind: 'R' }] },
  { world: 'خازن و سلف', art: 'rc', color: '#5aa9ff', parts: [{ after: 2, kind: 'C' }, { after: 4, kind: 'L' }, { after: 7, kind: 'C' }] },
];
const FALLBACK: Omit<ZoneSpec, 'world'> = { art: 'series', color: '#27d3ff', parts: [] };

export type ZoneState = 'done' | 'current' | 'open' | 'locked';
export interface ZoneModel {
  index: number;
  spec: ZoneSpec;
  first: number;
  count: number;
  done: number;
  /** برق وارد این جهان شده: مرحله‌ی قبل از اولین مرحله‌ی آن حل شده (یا اولین جهان است) */
  energized: boolean;
  state: ZoneState;
}

/** جهان‌ها را از ترتیب مرحله‌ها می‌سازد (مرحله‌های پشت‌سرهم با world یکسان = یک جهان). */
export function buildZones(levels: Pick<Level, 'world'>[], done: boolean[], unlocked: (i: number) => boolean): ZoneModel[] {
  const current = done.findIndex((d) => !d);
  const zones: ZoneModel[] = [];
  levels.forEach((l, i) => {
    const last = zones[zones.length - 1];
    if (last && last.spec.world === l.world) {
      last.count += 1;
      return;
    }
    const spec = ZONE_SPECS.find((s) => s.world === l.world) ?? { world: l.world, ...FALLBACK };
    zones.push({ index: zones.length, spec, first: i, count: 1, done: 0, energized: false, state: 'locked' });
  });
  for (const z of zones) {
    z.done = done.slice(z.first, z.first + z.count).filter(Boolean).length;
    z.energized = z.first === 0 || done[z.first - 1];
    z.state = z.done === z.count ? 'done' : current >= z.first && current < z.first + z.count ? 'current' : unlocked(z.first) ? 'open' : 'locked';
  }
  return zones;
}

/** ناحیه‌ها را دو‌به‌دو ردیف می‌کند (آخرین ردیف ممکن است یک ناحیه داشته باشد). */
export function pairRows<T>(items: T[]): [T, T | undefined][] {
  const rows: [T, T | undefined][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push([items[i], items[i + 1]]);
  return rows;
}
