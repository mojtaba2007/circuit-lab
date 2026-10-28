/** گره‌ها با نام رشته‌ای مشخص می‌شوند. نام پیش‌فرض زمین '0' است. */
export type NodeId = string;
export type ElementKind = 'R' | 'V' | 'I' | 'C' | 'L';

/**
 * قطعه در قالب netlist؛ مستقل از موقعیت روی صفحه.
 * قرارداد جهت: جریان از پایه a به پایه b «از درون قطعه» عبور می‌کند.
 * - R: value بر حسب اهم
 * - V: value بر حسب ولت، a پایه مثبت است
 * - I: value بر حسب آمپر، جریان از a به b از درون منبع می‌گذرد (از گره a خارج و به گره b وارد می‌شود)
 * - C: value بر حسب فاراد. در DC پایدار مدار باز است.
 * - L: value بر حسب هانری. در DC پایدار اتصال کوتاه است.
 */
export interface NetElement {
  id: string;
  kind: ElementKind;
  a: NodeId;
  b: NodeId;
  value: number;
  /** شرط اولیه (فقط تحلیل گذرا): برای C ولتاژ V(a)−V(b) و برای L جریان a→b. پیش‌فرض ۰ */
  ic?: number;
}

export interface ElementResult {
  /** V(a) − V(b) */
  voltage: number;
  /** جریان از a به b از درون قطعه (قرارداد علامت غیرفعال) */
  current: number;
  /** توان دریافتی = voltage × current. منفی یعنی قطعه توان تولید می‌کند. */
  power: number;
}

export interface Solution {
  /** ولتاژ همه گره‌ها نسبت به زمین (خود زمین ۰ است) */
  nodeVoltages: Record<NodeId, number>;
  elements: Record<string, ElementResult>;
}
