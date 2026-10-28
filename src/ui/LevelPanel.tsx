import type { ReactNode } from 'react';
import { formatValue } from '../engine';
import type { GoalResult } from '../levels/evaluate';
import type { LevelResult } from '../levels/progress';
import { quantityUnit } from '../levels/quiz';
import { MAX_SCORE, roundMultiplier, type ScoreBreakdown } from '../levels/scoring';
import type { InteractiveLevel, Lesson, QuizLevel } from '../levels/types';

export function LessonCard({ lesson, open }: { lesson?: Lesson; open: boolean }) {
  if (!lesson) return null;
  return (
    <details className="card lesson" open={open}>
      <summary>📘 درس‌نامه کوتاه: {lesson.title}</summary>
      <p>{lesson.body}</p>
      {lesson.formula && <pre className="formula">{lesson.formula}</pre>}
      {lesson.steps && <ol>{lesson.steps.map((s) => <li key={s}>{s}</li>)}</ol>}
    </details>
  );
}

function Attempts({ left, max, rounds }: { left: number; max: number; rounds: number }) {
  if (!Number.isFinite(max)) {
    return <div className="attempts"><span className="muted small">تلاش نامحدود است؛ هر پاسخ اشتباه ۴۰ امتیاز از «تلاش کم» کم می‌کند.</span></div>;
  }
  return (
    <div className="attempts" role="img" aria-label={`${left} تلاش از ${max} باقی مانده`}>
      <span>تلاش‌ها</span>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < max - left ? 'used' : ''} />)}
      <span className="muted small">حداکثر امتیاز پایه: {Math.round(MAX_SCORE * roundMultiplier(rounds))}{rounds > 0 ? ` (دور ${rounds + 1})` : ''}</span>
    </div>
  );
}

function ScoreList({ result }: { result: ScoreBreakdown }) {
  return (
    <>
      <ul className="score">
        {result.items.map((it) => <li key={it.label}><span>{it.label}</span><b>{it.points} / {it.max}</b></li>)}
        {result.multiplier < 1 && <li><span>ضریب دور جدید</span><b>×{result.multiplier}</b></li>}
        {result.bonuses.map((b) => <li key={b.label} className="bonus"><span>⚡ {b.label}</span><b>+{b.points} / {b.max}</b></li>)}
        <li className="total"><span>جمع امتیاز</span><b>{result.total}</b></li>
      </ul>
      <div className="stars big" aria-label={`${result.stars} ستاره از ۳`}>{'★'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</div>
    </>
  );
}

function Hints({ hints, used }: { hints: string[]; used: number }) {
  return used > 0 ? <ol className="hints">{hints.slice(0, used).map((h) => <li key={h}>{h}</li>)}</ol> : null;
}

/** مقایسه‌ی تعداد قطعه‌ی بازیکن با راه‌حل موتور */
function Duel({ parts, engine, met }: { parts: number; engine: number; met: boolean }) {
  const st = !met ? { cls: '', text: 'مرحله را حل کن تا نتیجه‌ی مقابله مشخص شود' }
    : parts < engine ? { cls: 'win', text: '🏆 جلوتر از موتور (+۱۰۰)' }
    : parts === engine ? { cls: 'tie', text: '🤝 مساوی با موتور (+۵۰)' }
    : { cls: 'lose', text: 'موتور جلوتر است' };
  return (
    <div className={`duel ${st.cls}`} aria-live="polite">
      <span>🤖 موتور: <b>{engine}</b> قطعه</span>
      <span>👤 تو: <b>{parts}</b> قطعه</span>
      <span className="duel-status">{st.text}</span>
    </div>
  );
}

interface GoalCardProps {
  level: InteractiveLevel;
  result: GoalResult;
  maxAttempts: number;
  attemptsLeft: number;
  rounds: number;
  hintsUsed: number;
  partCount: number;
  timer: ReactNode;
  best: LevelResult | undefined;
  solved: ScoreBreakdown | null;
  feedback: string;
  nextLabel: string;
  onSubmit: () => void;
  onHint: () => void;
  onResetCircuit: () => void;
  onReplay: () => void;
  onNewRound: () => void;
  onNext: () => void;
}

export function GoalCard(p: GoalCardProps) {
  const { level, result } = p;
  const exhausted = p.attemptsLeft <= 0 && !p.solved;
  return (
    <section className={`card goal${p.solved ? ' solved' : ''}`} aria-live="polite">
      <div className="goal-head">
        <h2>هدف مرحله</h2>
        {p.timer}
        {p.best && <span className="chip">بهترین: {p.best.score} · {'★'.repeat(p.best.stars)}</span>}
      </div>
      <p>{level.story}</p>
      <div className="goalbars">
        {result.ok ? (
          (result.parts ?? [result]).map((g) => (
            <div className="goalbar" key={g.label}>
              <span>{g.label}</span>
              <b dir="ltr">هدف: {formatValue(g.target, g.unit)}</b>
            </div>
          ))
        ) : (
          <div className="goalbar"><span className="bad">{result.message}</span></div>
        )}
      </div>
      {level.engineParts !== undefined && <Duel parts={p.partCount} engine={level.engineParts} met={!!p.solved} />}
      {!p.solved && <Attempts left={p.attemptsLeft} max={p.maxAttempts} rounds={p.rounds} />}
      {p.feedback && !p.solved && <p className="alert" role="alert">{p.feedback}</p>}
      {exhausted && (
        <div className="alert warn">
          <p>تلاش‌های این دور تمام شد. با شروع دور جدید، سقف امتیاز پایه به {Math.round(MAX_SCORE * roundMultiplier(p.rounds + 1))} کاهش می‌یابد.</p>
          <button className="primary" onClick={p.onNewRound}>دور جدید (امتیاز ×{roundMultiplier(p.rounds + 1)})</button>
        </div>
      )}
      {p.solved && (
        <div className="win">
          <strong>آفرین! مرحله حل شد</strong>
          <ScoreList result={p.solved} />
          <div className="row">
            <button className="primary" onClick={p.onNext}>{p.nextLabel}</button>
            <button onClick={p.onReplay}>بازی دوباره برای امتیاز بهتر</button>
          </div>
        </div>
      )}
      <Hints hints={level.hints} used={p.hintsUsed} />
      {!p.solved && (
        <div className="row">
          <button className="primary" onClick={p.onSubmit} disabled={!result.ok || p.attemptsLeft <= 0}>ثبت پاسخ</button>
          <button onClick={p.onHint} disabled={p.hintsUsed >= level.hints.length}>راهنما ({p.hintsUsed}/{level.hints.length}) · −۳۵</button>
          <button onClick={p.onResetCircuit} title="فقط مدار برمی‌گردد؛ زمان‌سنج و تلاش‌ها ادامه دارند">مدار اولیه</button>
        </div>
      )}
      <p className="muted small">امتیاز: حل ۵۰۰ + دقت ۱۵۰ + کمترین قطعه ({level.maxParts}) ۱۵۰ + بدون راهنما ۱۰۰ + تلاش کم ۱۰۰؛ به‌علاوه‌ی پاداش سرعت تا ۱۰۰{level.engineParts !== undefined ? ' و پاداش مقابله با موتور تا ۱۰۰' : ''}</p>
    </section>
  );
}

interface QuizCardProps {
  level: QuizLevel;
  maxAttempts: number;
  attemptsLeft: number;
  rounds: number;
  hintsUsed: number;
  timer: ReactNode;
  best: LevelResult | undefined;
  solved: ScoreBreakdown | null;
  feedback: string;
  /** پاسخ‌های اشتباهی که تا حالا داده شده */
  wrong: (boolean | number)[];
  /** درستی گزاره (درست/نادرست) */
  truth: boolean | null;
  /** اندیس گزینه‌ی درست (پیش‌بینی) یا مدار درست (۰ = A و ۱ = B) */
  correctIndex: number | null;
  error: string | null;
  nextLabel: string;
  onAnswer: (choice: boolean | number) => void;
  onHint: () => void;
  onNewRound: () => void;
  onNext: () => void;
}

const QUIZ_TITLE = { truefalse: 'درست یا نادرست؟', predict: 'پیش‌بینی کن', choose: 'کدام مدار؟' } as const;

export function QuizCard(p: QuizCardProps) {
  const { level } = p;
  const reveal = !!p.solved || p.attemptsLeft <= 0;
  const isCorrect = (choice: boolean | number) => (level.type === 'truefalse' ? choice === p.truth : choice === p.correctIndex);
  const cls = (choice: boolean | number) => `answer${reveal && isCorrect(choice) ? ' right' : ''}${p.wrong.includes(choice) ? ' wrong' : ''}`;
  const off = (choice: boolean | number) => reveal || p.wrong.includes(choice) || p.error !== null;
  return (
    <section className={`card quiz${p.solved ? ' solved' : ''}`} aria-live="polite">
      <div className="goal-head">
        <h2>{QUIZ_TITLE[level.type]}</h2>
        {p.timer}
        {p.best && <span className="chip">بهترین: {p.best.score} · {'★'.repeat(p.best.stars)}</span>}
      </div>
      <p>{level.story}</p>
      <blockquote className="statement">{level.type === 'truefalse' ? level.statement : level.question}</blockquote>
      {p.error && <p className="alert" role="alert">{p.error}</p>}
      {level.type === 'truefalse' && (
        <div className="answers tf">
          <button className={cls(true)} disabled={off(true)} onClick={() => p.onAnswer(true)}>✓ درست</button>
          <button className={cls(false)} disabled={off(false)} onClick={() => p.onAnswer(false)}>✗ نادرست</button>
        </div>
      )}
      {level.type === 'choose' && (
        <div className="answers tf">
          <button className={cls(0)} disabled={off(0)} onClick={() => p.onAnswer(0)}>مدار A</button>
          <button className={cls(1)} disabled={off(1)} onClick={() => p.onAnswer(1)}>مدار B</button>
        </div>
      )}
      {level.type === 'predict' && (
        <div className="answers opts">
          {level.options.map((o, i) => (
            <button key={o} className={cls(i)} disabled={off(i)} onClick={() => p.onAnswer(i)}><span dir="ltr">{formatValue(o, quantityUnit(level.ask))}</span></button>
          ))}
        </div>
      )}
      {!reveal && <Attempts left={p.attemptsLeft} max={p.maxAttempts} rounds={p.rounds} />}
      {p.feedback && !reveal && <p className="alert" role="alert">{p.feedback}</p>}
      {reveal && <p className="explain"><b>توضیح: </b>{level.explanation}</p>}
      {p.attemptsLeft <= 0 && !p.solved && (
        <div className="alert warn">
          <p>پاسخ درست نبود. با دور جدید، سقف امتیاز پایه به {Math.round(MAX_SCORE * roundMultiplier(p.rounds + 1))} کاهش می‌یابد.</p>
          <button className="primary" onClick={p.onNewRound}>دور جدید (امتیاز ×{roundMultiplier(p.rounds + 1)})</button>
        </div>
      )}
      {p.solved && (
        <div className="win">
          <strong>آفرین! پاسخ درست بود</strong>
          <ScoreList result={p.solved} />
          <div className="row"><button className="primary" onClick={p.onNext}>{p.nextLabel}</button></div>
        </div>
      )}
      <Hints hints={level.hints} used={p.hintsUsed} />
      {!reveal && (
        <div className="row">
          <button onClick={p.onHint} disabled={p.hintsUsed >= level.hints.length}>راهنما ({p.hintsUsed}/{level.hints.length}) · −۳۵</button>
        </div>
      )}
    </section>
  );
}
