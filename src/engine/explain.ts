import { formatValue } from './format';
import type { NetElement, NodeId, Solution } from './types';

export interface ExplainStep {
  title: string;
  lines: string[];
}
const num = (x: number) => +x.toPrecision(4);

/** منطق حل مدار به‌صورت مرحله‌به‌مرحله با اعداد واقعی (برای نمایش به کاربر). */
export function explainDC(elements: NetElement[], sol: Solution, ground: NodeId = '0'): ExplainStep[] {
  const vn = (n: NodeId) => (n === ground ? '0' : `V${n}`);
  const volt = (n: NodeId) => sol.nodeVoltages[n] ?? 0;
  const nodes = Object.keys(sol.nodeVoltages).filter((n) => n !== ground);

  const kcl = nodes.map((k) => {
    const terms: { neg: boolean; text: string }[] = [];
    for (const e of elements) {
      if (e.kind === 'C' || e.a === e.b || (e.a !== k && e.b !== k)) continue; // خازن در DC مدار باز است
      const leaving = e.a === k;
      const other = leaving ? e.b : e.a;
      if (e.kind === 'R') {
        const r = num(e.value);
        terms.push({ neg: false, text: other === ground ? `${vn(k)}/${r}` : `(${vn(k)} − ${vn(other)})/${r}` });
      } else if (e.kind === 'I') terms.push({ neg: !leaving, text: String(num(e.value)) });
      else terms.push({ neg: !leaving, text: `I(${e.id})` });
    }
    const body = terms.map((t, i) => (i === 0 ? (t.neg ? '−' : '') : t.neg ? ' − ' : ' + ') + t.text).join('');
    return `گره ${vn(k)}:  ${body} = 0`;
  });
  const steps: ExplainStep[] = [
    { title: '۱) قانون جریان کیرشهف (KCL): مجموع جریان‌های خارج‌شده از هر گره صفر است', lines: kcl },
  ];

  const sources = elements.filter((e) => e.kind === 'V');
  steps.push({
    title: '۲) حل دستگاه معادلات',
    lines: [
      ...nodes.map((n) => `${vn(n)} = ${formatValue(volt(n), 'V')}`),
      ...elements.filter((e) => e.kind === 'V' || e.kind === 'L').map((e) => `I(${e.id}) = ${formatValue(sol.elements[e.id].current, 'A')}   (جریان از a به b درون منبع؛ منفی یعنی منبع جریان می‌دهد)`),
    ],
  });

  const resistors = elements.filter((e) => e.kind === 'R');
  if (resistors.length)
    steps.push({
      title: '۳) قانون اهم برای هر مقاومت:  I = (Va − Vb) / R',
      lines: resistors.map(
        (e) => `${e.id}: (${num(volt(e.a))} − ${num(volt(e.b))}) / ${num(e.value)} = ${formatValue(sol.elements[e.id].current, 'A')}`,
      ),
    });

  const src = sources.find((e) => Math.abs(sol.elements[e.id].current) > 1e-12);
  if (src) {
    const i = Math.abs(sol.elements[src.id].current);
    steps.push({
      title: '۴) مقاومت معادل دیده‌شده از باتری:  Req = E / I',
      lines: [`${src.id}: ${num(src.value)} / ${num(i)} = ${formatValue(src.value / i, 'Ω')}`],
    });
  }
  const reactive = elements.filter((e) => e.kind === 'C' || e.kind === 'L');
  if (reactive.length)
    steps.unshift({
      title: 'حالت پایدار DC: خازن مدار باز و سلف اتصال کوتاه است',
      lines: reactive.map((e) => (e.kind === 'C' ? `${e.id}: مدار باز (I = 0)` : `${e.id}: اتصال کوتاه (V = 0)`)),
    });
  return steps;
}
