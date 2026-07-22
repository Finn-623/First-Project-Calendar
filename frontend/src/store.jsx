import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { getCurrentUserId } from './lib/authState';
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
 * 
 * Authentication state is initialized in App.js only
 * Store receives user/session/profile as props and stores them
 */
export const StoreProvider = ({ children, user: initialUser, session: initialSession, profile: initialProfile }) => {
  // ============================================================================
  // Auth State - Receives from App.js, never modifies directly
  // ============================================================================
  const [user, setUser] = useState(initialUser || null);
  const [session, setSession] = useState(initialSession || null);
  const [profile, setProfile] = useState(initialProfile || null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // ============================================================================
  // Diet Tracking State (Original)
  // ============================================================================
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeline, setTimeline] = useState(TODAY_TIMELINE_INIT);
  const [plan, setPlan] = useState(DAILY_PLAN);
  const [history, setHistory] = useState(SEED_HISTORY);

  // ============================================================================
  // Auth Methods - Store-only operations
  // ============================================================================

  /**
   * Update user auth state from App.js
   * Called from App.js when auth state changes
   */
  const updateAuthState = useCallback((newUser, newSession, newProfile) => {
    setUser(newUser);
    setSession(newSession);
    setProfile(newProfile);
  }, []);

  /**
   * Load profile from profiles table
   * Safely fetches profile only if user ID matches current authenticated user
   * NOT called from onAuthStateChange callback - called after state update completes
   */
  const loadProfile = useCallback(async (userId) => {
    if (!supabase) {
      const errorMsg = 'Supabase 尚未配置';
      setAuthError(errorMsg);
      setProfile(null);
      return { success: false, error: errorMsg };
    }

    if (!userId) {
      setProfile(null);
      return { success: false, error: '缺少用户 ID' };
    }

    try {
      // Verify user ID matches current authenticated user
      const currentUserId = getCurrentUserId();
      if (currentUserId !== userId) {
        console.warn('User ID mismatch, skipping profile load');
        return { success: false, error: '用户状态不匹配' };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load profile:', error);
        setProfile(null);
        return { success: false, error: convertErrorToMessage(error) };
      }

      // Final check: ensure we're still loading for the same user
      const finalUserId = getCurrentUserId();
      if (finalUserId === userId) {
        setProfile(data);
        return { success: true, data };
      }

      return { success: false, error: '用户已切换，忽略旧请求结果' };
    } catch (err) {
      console.error('Error loading profile:', err);
      setProfile(null);
      return { success: false, error: convertErrorToMessage(err) };
    }
  }, []);

  /**
   * Sign in with email and password
   * App.js should use authService.signIn instead - this is for Store-only operations
   */
  const signIn = useCallback(async (email, password) => {
    setAuthLoading(true);
    setAuthError(null);

    if (!supabase) {
      const errorMsg = 'Supabase 尚未配置';
      setAuthError(errorMsg);
      setAuthLoading(false);
      return { success: false, error: errorMsg };
    }

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
        setUser(data.user);
        setSession(data.session);
        // Load profile asynchronously without blocking
        loadProfile(data.user.id).catch(console.error);
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
   * Sign out and clear all user data
   * App.js should call supabase.auth.signOut() first
   */
  const signOut = useCallback(async () => {
    setAuthLoading(true);

    if (!supabase) {
      const errorMsg = 'Supabase 尚未配置';
      setAuthError(errorMsg);
      setAuthLoading(false);
      return { success: false, error: errorMsg };
    }

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Sign out error:', error);
        setAuthError(convertErrorToMessage(error));
        return { success: false, error: convertErrorToMessage(error) };
      }

      // Clear user auth state
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
  // Prepare context value
  // ============================================================================

  const value = {
    // Auth state (from App.js)
    user,
    session,
    profile,
    authLoading,
    authError,

    // Auth methods
    updateAuthState,
    signIn,
    signOut,
    clearAuthError,
    loadProfile,

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
