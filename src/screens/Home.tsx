import { LEVELS } from '../levels/data';
import { isCompleted, nextLevelIndex, totalScore, totalStars, type Progress } from '../levels/progress';
import type { LevelType } from '../levels/types';
import type { User } from '../auth/api';
import { href } from '../routes';
import { TYPE_META, TypeIcon } from '../ui/icons';
import { Leaderboard } from '../ui/Leaderboard';

/** تصویر تزئینی: حلقه‌ی باتری، مقاومت و لامپ روشن با جریان متحرک */
function HeroCircuit() {
  const loop = 'M70 150V70H170M250 70H390V134M390 186V250H70V162';
  return (
    <svg className="hero-art" viewBox="0 0 460 320" role="img" aria-label="مدار ساده با باتری، مقاومت و لامپ روشن">
      <defs>
        <filter id="hglow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path className="h-trace" d={loop} />
      <path className="h-flow" d={loop} />
      <path className="h-comp" d="M170 70h12l8-18 14 36 14-36 14 36 8-18h10" />
      <path className="h-comp" d="M54 150h32M62 162h16" />
      <circle className="h-lamp" cx="390" cy="160" r="26" filter="url(#hglow)" />
      <path className="h-comp" d="M372 142l36 36M408 142l-36 36" />
      <text className="h-label" x="210" y="36" textAnchor="middle">R</text>
      <text className="h-label" x="34" y="160" textAnchor="middle">E</text>
    </svg>
  );
}

export default function Home({ progress, user, savedAt }: { progress: Progress; user: User | null; savedAt: number }) {
  const total = LEVELS.length;
  const done = LEVELS.filter((l) => isCompleted(progress, l.id)).length;
  const next = nextLevelIndex(LEVELS, progress);
  const pct = Math.round((done / total) * 100);
  const types = Object.keys(TYPE_META) as LevelType[];
  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-copy">
          {/* <span className="eyebrow">مدارهای الکتریکی</span> */}
          <h1>مدار بساز،<br /><span className="grad">قانون‌ها را کشف کن.</span></h1>
          <p>شبیه‌ساز زنده‌ی مدار با موتور تحلیل واقعی، و بازی {total} مرحله‌ای در {types.length} نوع چالش: از قانون اهم تا خازن و سلف.</p>
          <div className="cta-row">
            <a className="btn primary lg" href={href.roadmap}>{done === 0 ? 'ورود به مسابقه' : 'ادامه مسابقه'}</a>
            <a className="btn lg" href={href.free}>حالت آزاد</a>
            {next >= 0 && done > 0 && <a className="btn ghost lg" href={href.play(LEVELS[next].id)}>مرحله {next + 1}: {LEVELS[next].title}</a>}
          </div>
          <dl className="statstrip">
            <div><dt>مرحله‌ی حل‌شده</dt><dd>{done} / {total}</dd></div>
            <div><dt>ستاره</dt><dd>★ {totalStars(progress)}</dd></div>
            <div><dt>امتیاز</dt><dd>{totalScore(progress)}</dd></div>
          </dl>
          <div className="progressbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت مسابقه"><span style={{ width: `${pct}%` }} /></div>
        </div>
        <HeroCircuit />
      </section>

      <section aria-labelledby="types-title">
        <h2 id="types-title" className="section-title">{types.length} نوع چالش</h2>
        <div className="types-grid">
          {types.map((t) => (
            <article key={t} className={`type-card t-${t}`}>
              <span className="type-ic"><TypeIcon type={t} size={26} /></span>
              <h3>{TYPE_META[t].label}</h3>
              <p>{TYPE_META[t].desc}</p>
              <span className="muted small">{LEVELS.filter((l) => l.type === t).length} مرحله</span>
            </article>
          ))}
        </div>
      </section>

      <section className="home-board" aria-label="جدول برترین‌ها">
        <Leaderboard user={user} refreshKey={savedAt} />
      </section>

      <section className="modes" aria-label="انتخاب حالت">
        <a className="mode" href={href.roadmap}>
          <h2>حالت مسابقه</h2>
          <p>مرحله‌ها را به‌ترتیب حل کن؛ هر برد جریان را یک قدم جلوتر می‌برد، امتیاز و ستاره می‌دهد و مرحله‌ی بعد را باز می‌کند.</p>
          <span className="cta">نقشه مراحل ←</span>
        </a>
        <a className="mode free" href={href.free}>
          <h2>حالت آزاد</h2>
          <p>هر مداری می‌خواهی بساز؛ مقدارها را زنده تغییر بده و نتیجه، مراحل محاسبه و نمودار گذرا را ببین.</p>
          <span className="cta">شروع ساخت ←</span>
        </a>
      </section>
    </div>
  );
}
