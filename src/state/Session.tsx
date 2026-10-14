import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Profile, SignUpInput, SignUpResult } from '../auth/types';
import { useApp } from './AppContext';

interface SessionState {
  /** True until the first session check has finished. */
  loading: boolean;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<Profile>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { auth, ready } = useApp();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    setLoading(true);
    void auth.current().then((p) => {
      if (!live) return;
      setProfile(p);
      setLoading(false);
    });
    const off = auth.onChange((p) => {
      if (live) setProfile(p);
    });
    return () => {
      live = false;
      off();
    };
  }, [auth, ready]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const p = await auth.signIn(email, password);
      setProfile(p);
      return p;
    },
    [auth],
  );
  const signUp = useCallback(
    async (input: SignUpInput) => {
      const r = await auth.signUp(input);
      if (r.status === 'signed-in') setProfile(r.profile);
      return r;
    },
    [auth],
  );
  const signOut = useCallback(async () => {
    await auth.signOut();
    setProfile(null);
  }, [auth]);

  const value = useMemo(() => ({ loading, profile, signIn, signUp, signOut }), [loading, profile, signIn, signUp, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
