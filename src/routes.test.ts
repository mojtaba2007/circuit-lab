import { describe, expect, it } from 'vitest';
import { href, parseRoute } from './routes';

describe('parseRoute', () => {
  it('مسیرهای اصلی', () => {
    expect(parseRoute('').name).toBe('home');
    expect(parseRoute('#/').name).toBe('home');
    expect(parseRoute('#/roadmap').name).toBe('roadmap');
    expect(parseRoute('#/free').name).toBe('free');
    expect(parseRoute('#/login').name).toBe('login');
  });
  it('مرحله با id', () => {
    const r = parseRoute(href.play('ohm-1'));
    expect(r.name).toBe('play');
    expect(r.name === 'play' && r.id).toBe('ohm-1');
  });
  it('مسیر نامعتبر به خانه می‌رود', () => {
    expect(parseRoute('#/play').name).toBe('home');
    expect(parseRoute('#/xyz').name).toBe('home');
  });
});
