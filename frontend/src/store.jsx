import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { fetchTimelineForDate } from './services/timelineService';
import { fetchDailyTarget } from './services/targetService';
import { getSupabaseClient } from './lib/supabaseClient';
import { sumTimelineMacros } from './lib/nutrition';

const StoreContext = createContext(null);

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const formatDateLabel = (d) => `${d.getMonth() + 1}月${d.getDate()}日 · ${weekdays[d.getDay()]}`;
export const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const freshTimeline = () => ([
  { id: `m1-${Date.now()}`, type: 'meal', subtype: 'breakfast', title: '早餐', time: '08:00', fixed: true, foods: [] },
  { id: `m2-${Date.now() + 1}`, type: 'meal', subtype: 'lunch', title: '午餐', time: '12:30', fixed: true, foods: [] },
  { id: `m3-${Date.now() + 2}`, type: 'meal', subtype: 'dinner', title: '晚餐', time: '19:00', fixed: true, foods: [] },
]);

export const StoreProvider = ({ children }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeline, setTimeline] = useState(freshTimeline());
  const [plan, setPlan] = useState(null);
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [todayLoading, setTodayLoading] = useState(false);
  const [todayError, setTodayError] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');

  const dateStr = useMemo(() => toDateStr(currentDate), [currentDate]);

  const getCurrentUser = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    setUser(data?.user || null);
    return data?.user || null;
  }, []);

  const reloadToday = useCallback(async (forDate = currentDate) => {
    const todayStr = toDateStr(forDate);
    setTodayLoading(true);
    setTodayError('');
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setTimeline(freshTimeline());
        setTodayLoading(false);
        return;
      }
      const list = await fetchTimelineForDate({ userId: currentUser.id, dateStr: todayStr });
      setTimeline(list);
    } catch (e) {
      setTimeline(freshTimeline());
      setTodayError(e?.message || '今日数据加载失败');
    } finally {
      setTodayLoading(false);
    }
  }, [currentDate, getCurrentUser]);

  const reloadPlan = useCallback(async (forDate = currentDate) => {
    const todayStr = toDateStr(forDate);
    setPlanLoading(true);
    setPlanError('');
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setPlan(null);
        setPlanLoading(false);
        return;
      }
      const value = await fetchDailyTarget({ userId: currentUser.id, dateStr: todayStr });
      setPlan(value);
    } catch (e) {
      setPlan(null);
      setPlanError(e?.message || '计划加载失败');
    } finally {
      setPlanLoading(false);
    }
  }, [currentDate, getCurrentUser]);

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
    currentDate,
    dateStr,
    dateLabel: formatDateLabel(currentDate),
    timeline,
    setTimeline,
    plan,
    setPlan,
    history,
    user,
    todayLoading,
    todayError,
    planLoading,
    planError,
    getCurrentUser,
    reloadToday,
    reloadPlan,
    setCurrentDate,
    endDay,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};
