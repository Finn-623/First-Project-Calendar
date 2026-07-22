import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import { TODAY_TIMELINE_INIT, DAILY_PLAN, SEED_HISTORY, sumTimelineMacros } from './mockData';

const StoreContext = createContext(null);

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const formatDateLabel = (d) => `${d.getMonth() + 1}月${d.getDate()}日 · ${weekdays[d.getDay()]}`;
export const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const freshTimeline = () => ([
  { id: `m1-${Date.now()}`, type: 'meal', subtype: 'breakfast', title: '早餐', time: '08:00', fixed: true, foods: [] },
  { id: `m2-${Date.now() + 1}`, type: 'meal', subtype: 'lunch', title: '午餐', time: '12:30', fixed: true, foods: [] },
  { id: `m3-${Date.now() + 2}`, type: 'meal', subtype: 'dinner', title: '晚餐', time: '19:00', fixed: true, foods: [] },
]);

/**
 * Main Store Provider
 * Manages both diet tracking state and Supabase authentication state
 */
export const StoreProvider = ({ children, user: initialUser }) => {
  // ============================================================================
  // Auth State
  // ============================================================================
  const [user, setUser] = useState(initialUser || null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Track if auth listener is registered to prevent duplicates
  const authListenerRef = useRef(null);
  const initializingRef = useRef(false);

  // ============================================================================
  // Diet Tracking State (Original)
  // ============================================================================
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeline, setTimeline] = useState(TODAY_TIMELINE_INIT);
  const [plan, setPlan] = useState(DAILY_PLAN);
  const [history, setHistory] = useState(SEED_HISTORY);

  // ============================================================================
  // Auth Methods
  // ============================================================================

  /**
   * Load current user profile from profiles table
   */
  const loadProfile = useCallback(async (userId) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load profile:', error);
        setProfile(null);
        return;
      }

      setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
      setProfile(null);
    }
  }, []);

  /**
   * Initialize authentication on app startup
   * Checks current session and registers listener for future changes
   */
  const initializeAuth = useCallback(async () => {
    // Prevent multiple simultaneous initializations
    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;
    setAuthLoading(true);

    try {
      // Check if we already have a Supabase session
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session check error:', sessionError);
        setAuthError(convertErrorToMessage(sessionError));
        setUser(null);
        setSession(null);
        setProfile(null);
      } else if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        // Load user profile if exists
        await loadProfile(currentSession.user.id);
        setAuthError(null);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
      setAuthError(convertErrorToMessage(err));
    } finally {
      setAuthLoading(false);
      setAuthInitialized(true);

      // Register auth state change listener (only once)
      if (!authListenerRef.current) {
        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            if (newSession?.user) {
              setSession(newSession);
              setUser(newSession.user);
              await loadProfile(newSession.user.id);
              setAuthError(null);
            } else {
              setSession(null);
              setUser(null);
              setProfile(null);
            }
          }
        );

        authListenerRef.current = authListener;
      }

      initializingRef.current = false;
    }
  }, [loadProfile]);

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (email, password) => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const errorMsg = convertErrorToMessage(error);
        setAuthError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (data.user && data.session) {
        setSession(data.session);
        setUser(data.user);
        await loadProfile(data.user.id);
        setAuthError(null);
        return { success: true, user: data.user, session: data.session };
      }

      setAuthError('登录失败，请稍后重试');
      return { success: false, error: '登录失败，请稍后重试' };
    } catch (err) {
      const errorMsg = convertErrorToMessage(err);
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setAuthLoading(false);
    }
  }, [loadProfile]);

  /**
   * Sign out current user
   * Clears user data from both Store and Supabase
   */
  const signOut = useCallback(async () => {
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Sign out error:', error);
        setAuthError(convertErrorToMessage(error));
        return { success: false, error: convertErrorToMessage(error) };
      }

      // Clear user-related state
      setUser(null);
      setSession(null);
      setProfile(null);
      setAuthError(null);

      // Clear user-related diet tracking data
      setTimeline(freshTimeline());
      setPlan(DAILY_PLAN);
      setHistory(SEED_HISTORY);
      setCurrentDate(new Date());

      return { success: true };
    } catch (err) {
      console.error('Sign out exception:', err);
      const errorMsg = convertErrorToMessage(err);
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  /**
   * Clear auth error message
   */
  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  /**
   * Cleanup auth listener when component unmounts
   */
  const cleanupAuthListener = useCallback(() => {
    if (authListenerRef.current) {
      authListenerRef.current.unsubscribe?.();
      authListenerRef.current = null;
    }
  }, []);

  // ============================================================================
  // Diet Tracking Methods (Original)
  // ============================================================================

  const endDay = useCallback(() => {
    const totals = sumTimelineMacros(timeline);
    const entry = {
      dateStr: toDateStr(currentDate),
      dateLabel: formatDateLabel(currentDate),
      timeline,
      totals,
    };
    setHistory((prev) => [entry, ...prev.filter((h) => h.dateStr !== entry.dateStr)]);
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
    setTimeline(freshTimeline());
  }, [currentDate, timeline]);

  // ============================================================================
  // Cleanup on unmount
  // ============================================================================

  useEffect(() => {
    return () => {
      cleanupAuthListener();
    };
  }, [cleanupAuthListener]);

  // ============================================================================
  // Prepare context value
  // ============================================================================

  const value = {
    // Auth state
    user,
    session,
    profile,
    authLoading,
    authInitialized,
    authError,

    // Auth methods
    initializeAuth,
    signIn,
    signOut,
    clearAuthError,
    loadProfile,
    cleanupAuthListener,

    // Diet tracking state
    currentDate,
    dateLabel: formatDateLabel(currentDate),
    timeline,
    setTimeline,
    plan,
    setPlan,
    history,
    endDay,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

/**
 * Hook to use the Store
 */
export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};

/**
 * Convert Supabase errors to user-friendly messages
 */
function convertErrorToMessage(error) {
  if (!error) return '未知错误';

  if (error.message) {
    // Common Supabase error messages
    if (error.message.includes('Invalid login credentials')) {
      return '邮箱或密码错误';
    }
    if (error.message.includes('Email not confirmed')) {
      return '邮箱未验证';
    }
    if (error.message.includes('User already registered')) {
      return '该邮箱已注册';
    }
    if (error.message.includes('Network')) {
      return '网络连接错误';
    }
    return error.message;
  }

  return '发生错误，请稍后重试';
}
