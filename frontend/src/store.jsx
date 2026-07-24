import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { getCurrentUserId } from './lib/authState';
import { sumTimelineMacros } from './mockData';
import { foodService } from './services/foodService';
import { authService } from './services/authService';

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
 */
export const StoreProvider = ({ children, user: initialUser, session: initialSession, profile: initialProfile }) => {
  const [user, setUser] = useState(initialUser || null);
  const [session, setSession] = useState(initialSession || null);
  const [profile, setProfile] = useState(initialProfile || null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeline, setTimeline] = useState(freshTimeline());
  const [plan, setPlan] = useState(null);
  const [history, setHistory] = useState([]);
  const [foods, setFoods] = useState([]);
  const [favorites, setFavorites] = useState([]);

  const refreshFoods = useCallback(async (userId) => {
    if (!userId) {
      setFoods([]);
      return;
    }

    const { data, error } = await foodService.getAllFoods(userId);
    if (error) {
      console.error('Failed to load foods:', error);
      return;
    }

    setFoods(data || []);
  }, []);

  useEffect(() => {
    refreshFoods(initialUser?.id || user?.id).catch(console.error);
  }, [initialUser?.id, user?.id, refreshFoods]);

  useEffect(() => {
    setUser(initialUser || null);
  }, [initialUser]);

  useEffect(() => {
    setSession(initialSession || null);
  }, [initialSession]);

  useEffect(() => {
    setProfile(initialProfile || null);
  }, [initialProfile]);

  const updateAuthState = useCallback((newUser, newSession, newProfile) => {
    setUser(newUser);
    setSession(newSession);
    setProfile(newProfile);
  }, []);

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
      const currentUserId = getCurrentUserId();
      if (currentUserId !== userId) {
        return { success: false, error: '用户状态不匹配' };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        setProfile(null);
        return { success: false, error: convertErrorToMessage(error) };
      }

      const finalUserId = getCurrentUserId();
      if (finalUserId === userId) {
        setProfile(data);
        return { success: true, data };
      }

      return { success: false, error: '用户已切换，忽略旧请求结果' };
    } catch (err) {
      setProfile(null);
      return { success: false, error: convertErrorToMessage(err) };
    }
  }, []);

  const signIn = useCallback(async (username, password) => {
    setAuthLoading(true);
    setAuthError(null);

    if (!supabase) {
      const errorMsg = 'Supabase 尚未配置';
      setAuthError(errorMsg);
      setAuthLoading(false);
      return { success: false, error: errorMsg };
    }

    try {
      const { user: signedInUser, session: signedInSession, error } = await authService.signInWithUsername(username, password);

      if (error) {
        const errorMsg = convertErrorToMessage(error);
        setAuthError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (signedInUser && signedInSession) {
        setUser(signedInUser);
        setSession(signedInSession);
        loadProfile(signedInUser.id).catch(console.error);
        setAuthError(null);
        return { success: true, user: signedInUser, session: signedInSession };
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
        setAuthError(convertErrorToMessage(error));
        return { success: false, error: convertErrorToMessage(error) };
      }

      setUser(null);
      setSession(null);
      setProfile(null);
      setAuthError(null);

      setTimeline(freshTimeline());
      setPlan(null);
      setHistory([]);
      setFoods([]);
      setFavorites([]);
      setCurrentDate(new Date());

      return { success: true };
    } catch (err) {
      const errorMsg = convertErrorToMessage(err);
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

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

  const value = {
    user,
    session,
    profile,
    authLoading,
    authError,

    updateAuthState,
    signIn,
    signOut,
    clearAuthError,
    loadProfile,

    currentDate,
    dateLabel: formatDateLabel(currentDate),
    timeline,
    setTimeline,
    plan,
    setPlan,
    history,
    setHistory,
    foods,
    setFoods,
    refreshFoods,
    favorites,
    setFavorites,
    endDay,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};

function convertErrorToMessage(error) {
  if (!error) return '未知错误';

  if (error.message) {
    if (error.message.includes('用户名只能包含3至30位小写字母、数字或下划线') || error.message.includes('用户名格式不正确')) {
      return '用户名只能包含3至30位小写字母、数字或下划线。';
    }
    if (error.message.includes('用户名或密码错误') || error.message.includes('Invalid login credentials')) return '用户名或密码错误';
    if (error.message.includes('登录服务暂时不可用') || error.message.includes('Supabase 尚未配置')) {
      return '登录服务暂时不可用，请稍后重试';
    }
    if (error.message.includes('Email not confirmed')) return '邮箱未验证';
    if (error.message.includes('User already registered')) return '该邮箱已注册';
    if (error.message.includes('Network')) return '网络连接错误';
    return error.message;
  }

  return '发生错误，请稍后重试';
}
