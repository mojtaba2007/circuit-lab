import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, getToken, setToken, type Session, type SyncState, type User } from './auth/api';
import AuthScreen from './screens/AuthScreen';
import Home from './screens/Home';
import QuizWorkspace from './screens/QuizWorkspace';
import Roadmap from './screens/Roadmap';
import Workspace, { type Actions } from './screens/Workspace';
import { LEVELS } from './levels/data';
import {
  emptyProgress, isUnlocked, loadProgress, mergeProgress, recordFail, recordHint, recordSuccess, saveProgress, startNewRound, type Progress,
} from './levels/progress';
import { isQuiz } from './levels/types';
import { href } from './routes';
import { Shell } from './ui/Shell';
import { useRoute } from './useRoute';

export default function App() {
  const route = useRoute();
  const [user, setUser] = useState<User | null>(null);
  const [progress, setProgress] = useState<Progress>(() => loadProgress('guest'));
  /** true یعنی پیشرفت سرور با محلی ادغام شده و ذخیره‌ی خودکار مجاز است */
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<SyncState>('idle');
  const [savedAt, setSavedAt] = useState(0);

  // بازیابی نشست با توکن ذخیره‌شده
  useEffect(() => {
    if (!getToken()) return;
    api.me().then(
      ({ user: u, progress: server }) => {
        setUser(u);
        setProgress(mergeProgress(server, loadProgress(u.username)));
        setReady(true);
      },
      (e: unknown) => { if (e instanceof ApiError && e.status === 401) setToken(null); },
    );
  }, []);

  // نسخه‌ی محلی (هر کاربر جدا) و ذخیره‌ی خودکار روی سرور با کمی تأخیر
  useEffect(() => saveProgress(progress, user?.username ?? 'guest'), [progress, user]);
  useEffect(() => {
    if (!user || !ready) return;
    setSync('saving');
    const id = window.setTimeout(() => {
      api.saveProgress(progress).then(
        () => { setSync('ok'); setSavedAt(Date.now()); },
        () => setSync('error'),
      );
    }, 800);
    return () => window.clearTimeout(id);
  }, [progress, user, ready]);

  const onSession = (s: Session) => {
    setToken(s.token);
    // پیشرفت مهمان به حساب اضافه می‌شود و نسخه‌ی مهمان خالی می‌شود تا برای حساب بعدی تکرار نشود
    const merged = mergeProgress(s.progress, mergeProgress(loadProgress(s.user.username), loadProgress('guest')));
    saveProgress(emptyProgress(), 'guest');
    setUser(s.user);
    setProgress(merged);
    setReady(true);
  };
  const logout = () => {
    setToken(null);
    setUser(null);
    setReady(false);
    setSync('idle');
    setProgress(loadProgress('guest'));
  };

  const actions = useMemo<Actions>(
    () => ({
      success: (id, result) => setProgress((p) => recordSuccess(p, id, result)),
      fail: (id) => setProgress((p) => recordFail(p, id)),
      hint: (id, max) => setProgress((p) => recordHint(p, id, max)),
      newRound: (id) => setProgress((p) => startNewRound(p, id)),
    }),
    [],
  );

  const content = (() => {
    if (route.name === 'login') return <AuthScreen user={user} onSession={onSession} onLogout={logout} />;
    if (route.name === 'roadmap') return <Roadmap progress={progress} user={user} savedAt={savedAt} />;
    if (route.name === 'free')
      return <Workspace key="free" level={null} nextLabel="" onNext={() => undefined} progress={progress} actions={actions} />;
    if (route.name === 'play') {
      const i = LEVELS.findIndex((l) => l.id === route.id);
      if (i < 0 || !isUnlocked(LEVELS, progress, i))
        return (
          <div className="page narrow">
            <section className="card center">
              <h1>🔒 این مرحله هنوز قفل است</h1>
              <p className="muted">برای باز شدنش، مرحله‌های قبلی را حل کن.</p>
              <a className="btn primary" href={href.roadmap}>بازگشت به نقشه مراحل</a>
            </section>
          </div>
        );
      const level = LEVELS[i];
      const hasNext = i < LEVELS.length - 1;
      const nextLabel = hasNext ? 'مرحله بعد' : 'بازگشت به نقشه';
      const onNext = () => { window.location.hash = hasNext ? href.play(LEVELS[i + 1].id) : href.roadmap; };
      return isQuiz(level)
        ? <QuizWorkspace key={level.id} level={level} nextLabel={nextLabel} onNext={onNext} progress={progress} actions={actions} />
        : <Workspace key={level.id} level={level} nextLabel={nextLabel} onNext={onNext} progress={progress} actions={actions} />;
    }
    return <Home progress={progress} user={user} savedAt={savedAt} />;
  })();

  return <Shell route={route} progress={progress} user={user} sync={sync} onLogout={logout}>{content}</Shell>;
}
