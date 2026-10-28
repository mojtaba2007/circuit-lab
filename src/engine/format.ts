const PREFIX: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };
const SCALES: [number, string][] = [
  [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'],
];

/** تبدیل متن مهندسی مثل "4.7k" یا "10m" به عدد؛ در صورت نامعتبر بودن NaN. */
export function parseValue(text: string): number {
  const m = text.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+))\s*([pnuµmkMG]?)$/);
  return m ? parseFloat(m[1]) * (PREFIX[m[2]] ?? 1) : NaN;
}

/** نمایش مهندسی: 0.05 A → "50 mA" */
export function formatValue(x: number, unit: string): string {
  if (!Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  if (a < 1e-12) return `0 ${unit}`;
  for (const [f, s] of SCALES) if (a >= f * 0.9995) return `${+(x / f).toPrecision(4)} ${s}${unit}`;
  return `${x.toExponential(2)} ${unit}`;
}

/** نمایش مقدار برای کادر ورودی با پیشوند ساده‌ی قابل‌تایپ: 1e-6 → "1u" ، 4700 → "4.7k" */
export function toInputText(x: number): string {
  if (!Number.isFinite(x) || x === 0) return String(x);
  const a = Math.abs(x);
  const scales: [number, string][] = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'], [1e-12, 'p']];
  for (const [f, s] of scales) if (a >= f * 0.9995) return `${+(x / f).toPrecision(4)}${s}`;
  return String(x);
}
