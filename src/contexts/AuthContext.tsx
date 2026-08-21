import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/types/permissions';

export type Profile = {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  roles: Role[];
  employment_type: string;
  is_active: boolean;
  profile_completed: boolean;
  start_date: string | null;
  position: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_account_name: string | null;
  qr_code_url: string | null;
  active_branch_id: string | null;
  created_at: string;
  updated_at: string;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setActiveBranch: (branchId: string | null) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileFetchId = useRef(0);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('[Auth] Error fetching profile:', error);
      return null;
    }
    return data as Profile | null;
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const fetchId = ++profileFetchId.current;
    const p = await fetchProfile(userId);
    if (fetchId === profileFetchId.current) {
      setProfile(p);
      setLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    let mounted = true;
    let initialSessionHandled = false;
    let profileLoaded = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      initialSessionHandled = true;
      setSession(session);
      if (session?.user) {
        profileLoaded = true;
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        // Only show the loading screen on the very first session init or an
        // explicit sign-in. Supabase fires INITIAL_SESSION and TOKEN_REFRESHED
        // again when returning to a backgrounded tab — setting loading=true
        // those times unmounts the entire app and destroys all in-progress
        // form state (calculator inputs, product forms, import drafts, etc.).
        if (!initialSessionHandled && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          setLoading(true);
        }
        if (event === 'SIGNED_IN' && !profileLoaded) {
          setLoading(true);
        }
        initialSessionHandled = true;
        // Only refetch the profile on actual sign-in or the very first
        // session init. Token refreshes (which fire when returning to a
        // backgrounded tab) don't change the profile — refetching creates a
        // new object reference that cascades into re-renders and can trigger
        // a module redirect, unmounting the current page and destroying all
        // in-progress form state. Using a local boolean instead of reading
        // the `profile` state (which would be stale in this closure since
        // it's not in the effect deps).
        if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && !profileLoaded)) {
          profileLoaded = true;
          (async () => {
            await loadProfile(session.user.id);
          })();
        }
      } else {
        profileLoaded = false;
        profileFetchId.current++;
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    if (data.user) {
      await loadProfile(data.user.id);
    }
    return { error: null };
  }, [loadProfile]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'ไม่สามารถสร้างบัญชีได้' };

    // Check if this is the first user (no profiles exist yet)
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const isFirstUser = !countError && (count ?? 0) === 0;
    const assignedRoles: Role[] = isFirstUser ? ['super_admin'] : [];

    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: data.user.id,
      email,
      display_name: displayName,
      roles: assignedRoles,
      employment_type: 'daily',
      is_active: true,
      profile_completed: false,
    });
    if (profileError) {
      console.error('[Auth] Profile insert error:', profileError);
      return { error: profileError.message };
    }

    // Load the profile immediately so the user enters the app
    await loadProfile(data.user.id);
    return { error: null };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    profileFetchId.current++;
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  }, [session, loadProfile]);

  const setActiveBranch = useCallback(async (branchId: string | null) => {
    if (!session?.user || !profile) return;
    const { error } = await supabase.from('profiles').update({ active_branch_id: branchId }).eq('id', profile.id);
    if (error) { console.error('[Auth] Error setting active branch:', error); return; }
    setProfile({ ...profile, active_branch_id: branchId });
  }, [session, profile]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, refreshProfile, setActiveBranch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
