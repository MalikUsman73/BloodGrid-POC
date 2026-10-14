import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { IconAlert, IconCheck } from './icons';

interface ToastItem {
  id: number;
  tone: 'ok' | 'bad';
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((tone: ToastItem['tone'], text: string) => {
    seq += 1;
    const id = seq;
    setItems((cur) => [...cur, { id, tone, text }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4500);
  }, []);
  const api = useMemo<ToastApi>(() => ({ success: (t) => push('ok', t), error: (t) => push('bad', t) }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.tone === 'ok' ? <IconCheck /> : <IconAlert />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside ToastProvider');
  return v;
}
