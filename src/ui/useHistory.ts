import { useCallback, useState } from 'react';

interface History<T> {
  past: T[];
  present: T;
  future: T[];
  mergeKey: string | null;
}

/**
 * حالت با قابلیت Undo/Redo. تغییرهایی که mergeKey یکسان و پیاپی دارند
 * (مثل کشیدن اسلایدر) در یک گام تاریخچه ادغام می‌شوند.
 */
export function useHistory<T>(initial: T) {
  const [h, setH] = useState<History<T>>({ past: [], present: initial, future: [], mergeKey: null });

  const set = useCallback((next: T | ((prev: T) => T), mergeKey: string | null = null) => {
    setH((s) => {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(s.present) : next;
      if (value === s.present) return s;
      const merge = mergeKey !== null && mergeKey === s.mergeKey;
      return { past: merge ? s.past : [...s.past, s.present].slice(-100), present: value, future: [], mergeKey };
    });
  }, []);
  const undo = useCallback(
    () => setH((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future], mergeKey: null } : s)),
    [],
  );
  const redo = useCallback(
    () => setH((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1), mergeKey: null } : s)),
    [],
  );
  const reset = useCallback((value: T) => setH({ past: [], present: value, future: [], mergeKey: null }), []);

  return { state: h.present, set, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
