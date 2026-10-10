import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMeta, listUsers, setMeta } from '../db/local';
import type { Division, User } from '../domain/types';
import { isDemoMode, supabase } from '../sync/supabase';
import { syncNow } from '../sync/sync';

interface SessionState {
  user: User | null;
  division: Division | null;
  ready: boolean;
  setDivision: (d: Division) => void;
  signInDemo: (userId: string) => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * The signed-in user is kept on the device, so inspectors stay signed in with no signal.
 * Their profile (role, divisions) comes from the last sync.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [division, setDivisionState] = useState<Division | null>(null);
  const [ready, setReady] = useState(false);

  const loadUser = useCallback((id: string | null) => {
    const u = id ? listUsers().find((x) => x.id === id) ?? null : null;
    setUser(u);
    const saved = getMeta('division') as Division | null;
    setDivisionState(u ? (saved && u.divisions.includes(saved) ? saved : u.divisions[0] ?? null) : null);
  }, []);

  useEffect(() => {
    loadUser(getMeta('userId'));
    setReady(true);
  }, [loadUser]);

  const value: SessionState = {
    user,
    division,
    ready,
    setDivision: (d) => {
      setMeta('division', d);
      setDivisionState(d);
    },
    signInDemo: (userId) => {
      setMeta('userId', userId);
      loadUser(userId);
    },
    signIn: async (email, password) => {
      if (!supabase) return 'Backend is not configured';
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      const result = await syncNow();
      if (result.error) return `Signed in, but could not download data: ${result.error}`;
      setMeta('userId', data.user.id);
      loadUser(data.user.id);
      if (!listUsers().some((u) => u.id === data.user.id)) return 'Your account has no active profile. Ask an administrator.';
      return null;
    },
    signOut: async () => {
      if (!isDemoMode) await supabase?.auth.signOut();
      setMeta('userId', '');
      loadUser(null);
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}
