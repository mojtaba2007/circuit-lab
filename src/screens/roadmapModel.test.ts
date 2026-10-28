import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels/data';
import { buildZones, pairRows, ZONE_SPECS } from './roadmapModel';

const none = LEVELS.map(() => false);
const unlockedFor = (done: boolean[]) => (i: number) => i === 0 || done[i - 1];

describe('مدل نقشه‌ی مراحل', () => {
  it('هر جهان بازی یک طرح و رنگ دارد و جهان‌ها با ترتیب مرحله‌ها یکی است', () => {
    const zones = buildZones(LEVELS, none, unlockedFor(none));
    expect(zones.every((z) => ZONE_SPECS.some((s) => s.world === z.spec.world))).toBe(true);
    expect(zones.reduce((a, z) => a + z.count, 0)).toBe(LEVELS.length);
    expect(new Set(zones.map((z) => z.spec.world)).size).toBe(zones.length);
    expect(zones.map((z) => z.spec.world).join()).toBe(ZONE_SPECS.map((s) => s.world).join());
  });
  it('قطعه‌های روی سیم داخل بازه‌ی جهان‌اند و تکراری نیستند', () => {
    for (const z of buildZones(LEVELS, none, unlockedFor(none))) {
      const idx = z.spec.parts.map((p) => p.after);
      expect(idx.every((a) => a >= 0 && a < z.count)).toBe(true);
      expect(new Set(idx).size).toBe(idx.length);
    }
  });
  it('وضعیت جهان‌ها: ابتدا فقط جهان اول جاری است و بقیه قفل', () => {
    const z = buildZones(LEVELS, none, unlockedFor(none));
    expect(z[0].state).toBe('current');
    expect(z[0].energized).toBe(true);
    expect(z.slice(1).every((x) => x.state === 'locked' && !x.energized)).toBe(true);
  });
  it('با حل مرحله‌ها جهان تمام می‌شود و جهان بعدی برق می‌گیرد', () => {
    const first = buildZones(LEVELS, none, unlockedFor(none))[0];
    const done = LEVELS.map((_, i) => i < first.count);
    const z = buildZones(LEVELS, done, unlockedFor(done));
    expect(z[0].state).toBe('done');
    expect(z[0].done).toBe(first.count);
    expect(z[1].state).toBe('current');
    expect(z[1].energized).toBe(true);
    expect(z[2].energized).toBe(false);
  });
  it('وقتی همه حل شده‌اند همه جهان‌ها done هستند', () => {
    const all = LEVELS.map(() => true);
    expect(buildZones(LEVELS, all, unlockedFor(all)).every((z) => z.state === 'done')).toBe(true);
  });
  it('pairRows ناحیه‌ها را دو‌به‌دو ردیف می‌کند', () => {
    expect(pairRows([1, 2, 3, 4, 5])).toEqual([[1, 2], [3, 4], [5, undefined]]);
    expect(pairRows([]).length).toBe(0);
  });
});
