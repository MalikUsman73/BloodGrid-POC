import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRepository, type Repository } from '../data';
import { LocalRepository } from '../data/localRepository';

interface AppState {
  repo: Repository;
  /** Set when the database could not be reached and the in-memory data is in use. */
  offlineReason: string | null;
  ready: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repository>(() => createRepository());
  const [offlineReason, setOfflineReason] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const probe = useCallback(async (candidate: Repository) => {
    try {
      await candidate.getPool('G-8');
    } catch (e) {
      setOfflineReason(e instanceof Error ? e.message : 'The database could not be reached.');
      setRepo(new LocalRepository());
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void probe(repo);
    // Probe once at start-up only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ repo, offlineReason, ready }), [repo, offlineReason, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
