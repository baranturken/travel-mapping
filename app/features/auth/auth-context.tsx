import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/features/social/types';
import {
  clearAttempts,
  formatLockMessage,
  getLockRemainingMs,
  recordFailedAttempt,
} from '@/features/auth/login-throttle';
import { getMfaStatus } from '@/features/auth/mfa';

export type { Profile } from '@/features/social/types';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  needsProfileSetup: boolean;
  // Session is AAL1 but the account has a verified TOTP factor — the user
  // must pass the 2FA challenge before using the app.
  mfaPending: boolean;
  refreshMfaPending(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  saveProfile(data: {
    username: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
  }): Promise<void>;
  refreshProfile(): Promise<void>;
};

function mapProfileRow(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    bannerUrl: (row.banner_url as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);
  const mountedRef = useRef(true);

  const refreshMfaPending = useCallback(async () => {
    try {
      const status = await getMfaStatus();
      if (mountedRef.current) setMfaPending(status.verificationNeeded);
    } catch {
      // Fail open only for reads; the challenge screen re-checks on verify.
      if (mountedRef.current) setMfaPending(false);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    const p = data ? mapProfileRow(data as Record<string, unknown>) : null;
    if (mountedRef.current) setProfile(p);
    return p;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    void supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (!mountedRef.current) return;
      setSession(initial);
      if (initial?.user) {
        void refreshMfaPending();
        void loadProfile(initial.user.id).finally(() => {
          if (mountedRef.current) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mountedRef.current) return;
      setSession(next);
      if (next?.user) {
        void refreshMfaPending();
        void loadProfile(next.user.id);
      } else {
        setMfaPending(false);
        setProfile(null);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, refreshMfaPending]);

  const signIn = async (email: string, password: string) => {
    const locked = await getLockRemainingMs(email);
    if (locked) throw new Error(formatLockMessage(locked));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await recordFailedAttempt(email);
      throw error;
    }
    await clearAttempts(email);
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const saveProfile = async (data: {
    username: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
  }) => {
    if (!session?.user) throw new Error('Not authenticated');
    const row: Record<string, unknown> = {
      id: session.user.id,
      username: data.username.trim().toLowerCase(),
      display_name: data.displayName.trim(),
      bio: data.bio?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    // Only touch avatar/banner when explicitly provided, so editing other
    // fields never clears an existing image.
    if (data.avatarUrl !== undefined) row.avatar_url = data.avatarUrl;
    if (data.bannerUrl !== undefined) row.banner_url = data.bannerUrl;
    const { error } = await supabase.from('profiles').upsert(row);
    if (error) throw error;
    await loadProfile(session.user.id);
  };

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const needsProfileSetup = !loading && session !== null && profile === null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        needsProfileSetup,
        mfaPending,
        refreshMfaPending,
        signIn,
        signUp,
        signOut,
        saveProfile,
        refreshProfile,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
