import { useState } from 'react';
import { api, ApiError, USERNAME_RE, type Session, type User } from '../auth/api';
import { href } from '../routes';

interface Props {
  user: User | null;
  onSession: (s: Session) => void;
  onLogout: () => void;
}

/** ورود و ثبت‌نام. بدون حساب هم می‌شود بازی کرد؛ حساب برای ذخیره‌ی امتیاز و جدول برترین‌هاست. */
export default function AuthScreen({ user, onSession, onLogout }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    return (
      <div className="page narrow">
        <section className="card center">
          <h1>سلام {user.username} 👋</h1>
          <p className="muted">وارد شده‌ای؛ امتیازها و ستاره‌هایت خودکار ذخیره می‌شوند.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <a className="btn primary" href={href.roadmap}>ادامه‌ی مسابقه</a>
            <button onClick={onLogout}>خروج از حساب</button>
          </div>
        </section>
      </div>
    );
  }

  const submit = async () => {
    const name = username.trim();
    if (!USERNAME_RE.test(name)) return setError('نام کاربری باید ۳ تا ۲۰ حرف، عدد یا _ باشد.');
    if (password.length < 8) return setError('گذرواژه باید حداقل ۸ نویسه باشد.');
    if (mode === 'register' && password !== repeat) return setError('تکرار گذرواژه با گذرواژه یکی نیست.');
    setError('');
    setBusy(true);
    try {
      const session = mode === 'login' ? await api.login(name, password) : await api.register(name, password);
      onSession(session);
      window.location.hash = href.roadmap;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'خطای نامشخص.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <section className="card auth">
        <h1>{mode === 'login' ? 'ورود به حساب' : 'ساخت حساب'}</h1>
        <p className="muted">با حساب، امتیاز و ستاره‌هایت ذخیره می‌شوند و در جدول ۵ نفر برتر دیده می‌شوی. پیشرفت فعلی‌ات (مهمان) به حساب اضافه می‌شود.</p>
        <div className="tabbar" role="tablist" aria-label="نوع فرم">
          <button role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>ورود</button>
          <button role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>ثبت‌نام</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
          <label className="field">نام کاربری
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" dir="ltr" maxLength={20} required />
          </label>
          <label className="field">گذرواژه
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} dir="ltr" maxLength={128} required />
          </label>
          {mode === 'register' && (
            <label className="field">تکرار گذرواژه
              <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" dir="ltr" maxLength={128} required />
            </label>
          )}
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="primary lg-btn" type="submit" disabled={busy}>{busy ? 'کمی صبر کن…' : mode === 'login' ? 'ورود' : 'ساخت حساب'}</button>
        </form>
        <p className="muted small">بدون حساب هم می‌توانی بازی کنی؛ فقط در مرورگر همین دستگاه ذخیره می‌شود.</p>
      </section>
    </div>
  );
}
