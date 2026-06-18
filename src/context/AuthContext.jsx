import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getAppConfig, isDemoMode } from '../lib/config.js';
import { getSupabase } from '../lib/supabase.js';
import { useDemoAuthScope } from './DemoAuthScope.jsx';
import { edgeFunctions } from '../utils/gameApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const demoScope = useDemoAuthScope();
  const [username, setUsername] = useState(null);
  const [userId, setUserId] = useState(null);
  const [ready, setReady] = useState(false);

  const applySession = useCallback(async (session) => {
    const supabase = getSupabase();
    if (!session || !supabase) {
      setUsername(null);
      setUserId(null);
      return;
    }

    setUserId(session.user.id);

    const metaUsername = session.user.user_metadata?.username;
    if (metaUsername) {
      setUsername(metaUsername);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .single();

    setUsername(data?.username ?? null);
  }, []);

  useEffect(() => {
    if (isDemoMode()) {
      if (demoScope) {
        setUsername(demoScope.username);
        setUserId(demoScope.userId);
      } else {
        setUsername(null);
        setUserId(null);
      }
      setReady(true);
      return;
    }

    const supabase = getSupabase();
    if (!getAppConfig().isConfigured || !supabase) {
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => sub.subscription.unsubscribe();
  }, [applySession, demoScope]);

  const signUp = useCallback(async (userUsername, password, turnstileToken) => {
    if (isDemoMode()) {
      setUsername(userUsername);
      setUserId(`demo-${String(userUsername).toLowerCase()}`);
      return { ok: true, username: userUsername };
    }

    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: 'App is not configured.' };

    const result = await edgeFunctions.signUp(userUsername, password, turnstileToken);
    if (!result.ok) return result;

    const { error } = await supabase.auth.setSession(result.session);
    if (error) return { ok: false, error: error.message };

    setUsername(result.username);
    setUserId(result.session.user.id);
    return { ok: true, username: result.username };
  }, []);

  const logIn = useCallback(async (userUsername, password, turnstileToken) => {
    if (isDemoMode()) {
      setUsername(userUsername);
      setUserId(`demo-${String(userUsername).toLowerCase()}`);
      return { ok: true, username: userUsername };
    }

    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: 'App is not configured.' };

    const result = await edgeFunctions.logIn(userUsername, password, turnstileToken);
    if (!result.ok) return result;

    const { error } = await supabase.auth.setSession(result.session);
    if (error) return { ok: false, error: error.message };

    setUsername(result.username);
    setUserId(result.session.user.id);
    return { ok: true, username: result.username };
  }, []);

  const logOut = useCallback(async () => {
    if (isDemoMode()) {
      setUsername(null);
      setUserId(null);
      return;
    }

    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setUsername(null);
    setUserId(null);
  }, []);

  return (
    <AuthContext.Provider value={{ username, userId, ready, signUp, logIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
