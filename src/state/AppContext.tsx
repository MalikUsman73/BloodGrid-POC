import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthService } from '../auth/types';
import type { Repository } from '../data';
import { createBackend, createLocalBackend, type Backend } from './backend';

interface AppState {
  repo: Repository;
  auth: AuthService;
  mode: Backend['mode'];
  /** Set when the database could not be reached and the in-browser demo backend is in use. */
  offlineReason: string | null;
  ready: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend>(() => createBackend());
  const [offlineReason, setOfflineReason] = useState<string | null>(null);
  const [ready, setReady] = useState(backend.mode === 'local');

  useEffect(() => {
    if (backend.mode !== 'supabase' || !backend.client) return;
    // One cheap public read tells us whether the database is reachable before anyone signs in.
    void (async () => {
      try {
        const { error } = await backend.client!.from('sectors').select('id').limit(1);
        if (error) throw new Error(error.message);
      } catch (e) {
        setOfflineReason(e instanceof Error ? e.message : 'The database could not be reached.');
        setBackend(createLocalBackend());
      } finally {
        setReady(true);
      }
    })();
    // Probe once at start-up only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ repo: backend.repo, auth: backend.auth, mode: backend.mode, offlineReason, ready }),
    [backend, offlineReason, ready],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
