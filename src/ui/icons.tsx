import type { LevelType } from '../levels/types';

export const TYPE_META: Record<LevelType, { label: string; desc: string }> = {
  tune: { label: 'تنظیم مقدار', desc: 'مقدار قطعه‌ها را طوری تنظیم کن که هدف برآورده شود.' },
  design: { label: 'طراحی مدار', desc: 'از صفر با قطعه‌های محدود مداری بساز که شرط را داشته باشد.' },
  complete: { label: 'تکمیل مدار', desc: 'قطعه‌ی گمشده را در جای خالی بگذار و مدار را کامل کن.' },
  repair: { label: 'عیب‌یابی', desc: 'مدار خراب را تعمیر کن: سیم افتاده یا اتصال کوتاه.' },
  truefalse: { label: 'درست یا نادرست', desc: 'یک گزاره را بسنج؛ فقط یک فرصت داری.' },
  predict: { label: 'پیش‌بینی', desc: 'قبل از اندازه‌گیری، مقدار را حدس بزن.' },
  choose: { label: 'کدام مدار؟', desc: 'دو مدار را کنار هم مقایسه کن و مدار درست را انتخاب کن.' },
};

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** نماد هر نوع سؤال در جعبه‌ی 24×24 (برای استفاده داخل svg) */
export function TypeGlyph({ type }: { type: LevelType }) {
  switch (type) {
    case 'tune':
      return <g {...stroke}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></g>;
    case 'design':
      return <g {...stroke}><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><path d="M12 8v8M8 12h8" /></g>;
    case 'complete':
      return <g {...stroke}><rect x="4" y="4" width="16" height="16" rx="3.5" strokeDasharray="3 3" /><path d="M9.8 9.6a2.3 2.3 0 1 1 3.3 2c-.8.4-1.1.9-1.1 1.6M12 16.6v.1" /></g>;
    case 'repair':
      return <g {...stroke}><path d="M14.5 6.5a4 4 0 0 0-5.2 5.2L4 17l3 3 5.3-5.3a4 4 0 0 0 5.2-5.2l-2.6 2.6-2.4-.6-.6-2.4z" /></g>;
    case 'truefalse':
      return <g {...stroke}><path d="M3.5 12.5l3.5 3.5 5-6" /><path d="M15 8l5 5M20 8l-5 5" /></g>;
    case 'choose':
      return <g {...stroke}><rect x="3" y="6" width="8" height="12" rx="2" /><rect x="13" y="6" width="8" height="12" rx="2" /><path d="M5.5 12h3M15.5 12h3M17 10.5v3" /></g>;
    case 'predict':
      return <g {...stroke}><path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></g>;
  }
}

export function TypeIcon({ type, size = 20 }: { type: LevelType; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><TypeGlyph type={type} /></svg>
  );
}

export const DIFFICULTY_LABEL = { 1: 'آسان', 2: 'متوسط', 3: 'سخت' } as const;

/** نشانگر سختی مرحله: سه نقطه که با سختی پر می‌شوند */
export function Difficulty({ level, compact = false }: { level: 1 | 2 | 3; compact?: boolean }) {
  return (
    <span className={`diff d${level}`} title={`سختی: ${DIFFICULTY_LABEL[level]}`} aria-label={`سختی: ${DIFFICULTY_LABEL[level]}`}>
      <i /><i /><i />
      {!compact && <b>{DIFFICULTY_LABEL[level]}</b>}
    </span>
  );
}

export function TypeBadge({ type }: { type: LevelType }) {
  return (
    <span className={`type-badge t-${type}`}><TypeIcon type={type} size={16} />{TYPE_META[type].label}</span>
  );
}

/** نماد شماتیک ابزارهای ویرایشگر (40×20) */
export function ToolIcon({ tool }: { tool: string }) {
  const d: Record<string, string> = {
    R: 'M0 10h8l3-7 5 14 5-14 5 14 3-7h11',
    V: 'M0 10h15M15 3v14M23 6v8M23 10h17',
    I: 'M0 10h13M27 10h13M16 10h8M21 7l3 3-3 3',
    C: 'M0 10h17M17 3v14M23 3v14M23 10h17',
    L: 'M0 10h5a3.5 3.5 0 0 1 7 0a3.5 3.5 0 0 1 7 0a3.5 3.5 0 0 1 7 0a3.5 3.5 0 0 1 7 0h7',
    W: 'M3 10h34',
    G: 'M20 2v7M10 9h20M14 13h12M18 17h4',
    S: 'M14 2v14l4-4 3 6 3-1-3-6h6z',
    X: 'M13 4l14 12M27 4L13 16',
  };
  return (
    <svg className="tool-icon" viewBox="0 0 40 20" width="40" height="20" aria-hidden="true" {...stroke}>
      <path d={d[tool] ?? ''} />
      {tool === 'I' && <circle cx="20" cy="10" r="7" />}
      {tool === 'W' && (<><circle cx="3" cy="10" r="2" fill="currentColor" /><circle cx="37" cy="10" r="2" fill="currentColor" /></>)}
    </svg>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 28 28" width="30" height="30" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#27d3ff" />
          <stop offset="1" stopColor="#7a5cff" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="8" fill="url(#logo-g)" />
      <path d="M15.5 4.5L7.5 15.5h6l-1.2 8 8.2-11.2h-6z" fill="#fff" />
    </svg>
  );
}
