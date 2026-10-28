import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels/data';
import { buildLayout, MAP_W, SECTIONS } from './roadmapLayout';

const layout = buildLayout();

describe('چینش نقشه‌ی مراحل', () => {
  it('هر مرحله دقیقاً یک گره دارد', () => {
    expect(layout.nodes.length).toBe(LEVELS.length);
    const levels = layout.nodes.map((n) => n.level).sort((a, b) => a - b);
    expect(levels.every((l, i) => l === i)).toBe(true);
  });
  it('جهان‌ها و تعداد مرحله‌هایشان با LEVELS هم‌خوان است', () => {
    const groups: { world: string; count: number }[] = [];
    for (const l of LEVELS) {
      const g = groups[groups.length - 1];
      if (g && g.world === l.world) g.count += 1;
      else groups.push({ world: l.world, count: 1 });
    }
    expect(layout.banners.length).toBe(SECTIONS.length);
    expect(layout.banners.map((b) => `${b.world}:${b.count}`).join()).toBe(groups.map((g) => `${g.world}:${g.count}`).join());
  });
  it('گره‌ها داخل بوم‌اند و روی هم نمی‌افتند', () => {
    for (const n of layout.nodes) {
      expect(n.x >= 100 && n.x <= MAP_W - 100).toBe(true);
      expect(n.y > 0 && n.y < layout.height).toBe(true);
    }
    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        const d = Math.hypot(layout.nodes[i].x - layout.nodes[j].x, layout.nodes[i].y - layout.nodes[j].y);
        expect(d >= 60).toBe(true);
      }
    }
  });
  it('وابستگی سیم‌ها به مرحله‌های موجود اشاره می‌کند و برق از مرحله‌ی قبلی می‌آید', () => {
    const n = LEVELS.length;
    expect(layout.wires.every((w) => w.dep >= -1 && w.dep < n)).toBe(true);
    expect(layout.symbols.every((s) => s.dep >= -1 && s.dep < n)).toBe(true);
    const lamp = layout.symbols.find((s) => s.kind === 'lamp');
    expect(lamp !== undefined && lamp.dep === n - 1).toBe(true);
    expect(layout.symbols.filter((s) => s.kind === 'battery').length).toBe(1);
  });
});
