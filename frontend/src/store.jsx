import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import { getCurrentUserId } from './lib/authState';
import { sumTimelineMacros } from './mockData';
import { foodService } from './services/foodService';
import { authService } from './services/authService';
import { targetService } from './services/targetService';
import { addDaysToDateString, getSydneyDateString, getSydneyMidnightDelayMs, historyService } from './services/historyService';
import { timelineService } from './services/timelineService';
import { timelineRealtimeService } from './services/timelineRealtimeService';
import { filterMeaningfulTimelineItems } from './lib/dayRecordUtils';
import { mergeRemoteTimelineWithLocalPending } from './lib/timelinePendingMerge';

const StoreContext = createContext(null);

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const formatDateLabel = (d) => `${d.getMonth() + 1}月${d.getDate()}日 · ${weekdays[d.getDay()]}`;
export const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const freshTimeline = () => ([
  { id: `m1-${Date.now()}`, type: 'meal', subtype: 'breakfast', title: '早餐', time: '08:00', fixed: true, foods: [] },
  { id: `m2-${Date.now() + 1}`, type: 'meal', subtype: 'lunch', title: '午餐', time: '12:30', fixed: true, foods: [] },
  { id: `m3-${Date.now() + 2}`, type: 'meal', subtype: 'dinner', title: '晚餐', time: '19:00', fixed: true, foods: [] },
]);

const mergePersistedTimelineWithFixedMeals = (persistedTimeline = []) => {
  const persisted = Array.isArray(persistedTimeline) ? persistedTimeline : [];
  const persistedFixedTypes = new Set(
    persisted
      .filter((item) => item?.type === 'meal' && ['breakfast', 'lunch', 'dinner'].includes(item?.subtype))
      .map((item) => item.subtype)
  );
  const missingFixedMeals = freshTimeline().filter((item) => !persistedFixedTypes.has(item.subtype));

  return [...persisted, ...missingFixedMeals];
};

const cloneTimeline = (items = []) => (items || []).map((item) => ({
  ...item,
  foods: Array.isArray(item?.foods) ? item.foods.map((food) => ({ ...food })) : [],
}));

const normalizePlan = (target) => {
  if (!target) return null;

  const calories = target.calories_target ?? target.calories;
  const protein = target.protein_target ?? target.protein;
  const fat = target.fat_target ?? target.fat;
  const carbs = target.carbs_target ?? target.carbs;

  if (calories == null && protein == null && fat == null && carbs == null) {
    return null;
  }

  return {
    calories: Number(calories) || 0,
    protein: Number(protein) || 0,
    fat: Number(fat) || 0,
    carbs: Number(carbs) || 0,
    calculatedField: String(target.calculated_field || target.calculatedField || 'calories'),
  };
};

const createDateFromString = (dateStr) => new Date(`${dateStr}T00:00:00`);

const DATE_STATE_CACHE_KEYWORDS = [
  'recordingdate',
  'selecteddate',
  'viewingdate',
  'currentdate',
  'completedday',
  'historydetail',
  'endday',
  'zustand',
  'persist',
];

const clearLegacyDateStateCache = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const keysToRemove = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;

    const lowerKey = String(key).toLowerCase();
    if (DATE_STATE_CACHE_KEYWORDS.some((keyword) => lowerKey.includes(keyword))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore localStorage cleanup failures in strict/privacy modes.
    }
  });
};

const isAdminProfile = (profile) => {
  const role = String(profile?.role || '').toLowerCase();
  const accountType = String(profile?.account_type || '').toLowerCase();
  return role === 'admin' || accountType === 'admin' || profile?.is_admin === true;
};

/**
 * Main Store Provider
 */
export const StoreProvider = ({ children, user: initialUser, session: initialSession, profile: initialProfile }) => {
  const [user, setUser] = useState(initialUser || null);
  const [session, setSession] = useState(initialSession || null);
  const [profile, setProfile] = useState(initialProfile || null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [currentDate, setCurrentDate] = useState(() => createDateFromString(getSydneyDateString()));
  const [recordingDateStr, setRecordingDateStr] = useState(() => getSydneyDateString());
  const [timeline, setTimeline] = useState(freshTimeline());
  const [plan, setPlan] = useState(null);
  const [planDate, setPlanDate] = useState(null);
  const [planHistory, setPlanHistory] = useState([]);
  const [history, setHistory] = useState([]);
  const [foods, setFoods] = useState([]);
  const [publicFoods, setPublicFoods] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [dayInitialized, setDayInitialized] = useState(false);
  const requestEpochRef = useRef(0);
  const privateFoodSeenCountRef = useRef(new Map());
  const selectedTodayDateRef = useRef(getSydneyDateString());
  const midnightTimerRef = useRef(null);
  const initializationRequestRef = useRef(0);
  const timelineCacheRef = useRef(new Map());
  const endDaySubmittingRef = useRef(false);
  const logoutCompletedRef = useRef(false);
  const currentDateRef = useRef(currentDate);
  const realtimeReloadTimerRef = useRef(null);

  const wait = useCallback((ms) => new Promise((resolve) => setTimeout(resolve, ms)), []);

  const countPrivateFoods = useCallback((foodList, userId) => {
    if (!userId || !Array.isArray(foodList)) return 0;
    return foodList.filter((item) => item?.user_id === userId && item?.visibility !== 'public').length;
  }, []);

  const isActiveRequest = useCallback((epoch, expectedUserId) => {
    if (requestEpochRef.current !== epoch) return false;
    const currentUserId = getCurrentUserId();
    // During the very first load after sign-in, auth listener userId may not be
    // synchronized yet. Only reject when we can prove it belongs to another user.
    return !currentUserId || currentUserId === expectedUserId;
  }, []);

  const clearPrivateUserData = useCallback(() => {
    requestEpochRef.current += 1;
    initializationRequestRef.current += 1;
    timelineCacheRef.current.clear();
    privateFoodSeenCountRef.current.clear();
    endDaySubmittingRef.current = false;
    logoutCompletedRef.current = true;
    if (realtimeReloadTimerRef.current) {
      window.clearTimeout(realtimeReloadTimerRef.current);
      realtimeReloadTimerRef.current = null;
    }
    void timelineRealtimeService.stop();

    const today = getSydneyDateString();
    selectedTodayDateRef.current = today;
    clearLegacyDateStateCache();

    setUser(null);
    setSession(null);
    setProfile(null);
    setTimeline(freshTimeline());
    setPlan(null);
    setPlanDate(null);
    setPlanHistory([]);
    setHistory([]);
    setFavorites([]);
    setFoods((prev) => (prev || []).filter((item) => item?.visibility === 'public'));
    setPublicFoods((prev) => (prev || []).filter((item) => item?.visibility === 'public'));
    setCurrentDate(createDateFromString(today));
    setRecordingDateStr(today);
    setDayInitialized(false);
    setAuthError(null);
  }, []);

  useEffect(() => {
    currentDateRef.current = currentDate;
  }, [currentDate]);

  /**
   * 清除被删除日期的本地状态。
   * 删除系统真实本日时，恢复首页到一个全新的真实本日记录。
   */
  const resetDeletedDateState = useCallback((deletedDateStr) => {
    if (!deletedDateStr) return;

    const today = getSydneyDateString();
    timelineCacheRef.current.delete(deletedDateStr);
    setHistory((prev) => prev.filter((item) => item?.dateStr !== deletedDateStr));

    const shouldResetToToday = deletedDateStr === today || deletedDateStr === selectedTodayDateRef.current;
    if (!shouldResetToToday) return;

    // 忽略删除前发起、可能仍携带旧“已结束”状态的初始化结果。
    initializationRequestRef.current += 1;
    clearLegacyDateStateCache();

    timelineCacheRef.current.delete(today);
    timelineCacheRef.current.delete(recordingDateStr);

    const nextFreshTimeline = freshTimeline();
    selectedTodayDateRef.current = today;
    setRecordingDateStr(today);
    setCurrentDate(createDateFromString(today));
    setTimeline(nextFreshTimeline);
    timelineCacheRef.current.set(today, cloneTimeline(nextFreshTimeline));
    setDayInitialized(true);
  }, [recordingDateStr]);

  const resolveHomeTargetDate = useCallback(async (userId) => {
    if (!userId) {
      return { success: false, error: '缺少用户 ID' };
    }

    const today = getSydneyDateString();
    const { data: completion, error } = await historyService.getDayCompletion(userId, today);
    if (error) {
      return { success: false, error };
    }

    return {
      success: true,
      today,
      selectedDate: completion?.is_completed ? addDaysToDateString(today, 1) : today,
      isTodayCompleted: completion?.is_completed === true,
    };
  }, []);

  const initializeSelectedDate = useCallback(async (userId) => {
    if (!userId) return { success: false, error: '缺少用户 ID' };

    const requestId = ++initializationRequestRef.current;
    setDayInitialized(false);

    try {
      const resolved = await resolveHomeTargetDate(userId);
      if (!resolved.success) {
        return resolved;
      }

      if (requestId !== initializationRequestRef.current) {
        return { success: false, ignored: true };
      }

      selectedTodayDateRef.current = resolved.today;
      setRecordingDateStr(resolved.selectedDate);
      setCurrentDate(createDateFromString(resolved.selectedDate));
      setTimeline(freshTimeline());
      setDayInitialized(true);

      return {
        success: true,
        selectedDate: resolved.selectedDate,
        today: resolved.today,
        isTodayCompleted: resolved.isTodayCompleted,
      };
    } catch (err) {
      return { success: false, error: err };
    } finally {
      if (requestId === initializationRequestRef.current) {
        setDayInitialized(true);
      }
    }
  }, [resolveHomeTargetDate]);

  const refreshFoods = useCallback(async (userId) => {
    if (!userId) {
      setFoods((prev) => (prev || []).filter((item) => item?.visibility === 'public'));
      setPublicFoods((prev) => (prev || []).filter((item) => item?.visibility === 'public'));
      return { data: [], error: null };
    }

    const epoch = requestEpochRef.current;

    const { data, error } = await foodService.getAllFoods(userId);
    if (error) {
      console.error('Failed to load foods:', error);
      return { data: [], error };
    }

    if (!isActiveRequest(epoch, userId)) {
      return { data: [], error: new Error('用户已切换，忽略旧请求结果') };
    }

    const nextFoods = data || [];
    const privateCount = countPrivateFoods(nextFoods, userId);
    if (privateCount > 0) {
      privateFoodSeenCountRef.current.set(userId, privateCount);
    }

    setFoods(nextFoods);
    setPublicFoods(nextFoods.filter((item) => item?.visibility === 'public'));
    return { data: nextFoods, error: null };
  }, [countPrivateFoods, isActiveRequest]);

  const loadPublicFoods = useCallback(async (userId) => {
    if (!userId) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await foodService.loadPublicFoods(userId);
      if (error) {
        return { data: [], error };
      }

      const nextFoods = data || [];
      setPublicFoods(nextFoods);
      return { data: nextFoods, error: null };
    } catch (err) {
      return { data: [], error: err };
    }
  }, []);

  useEffect(() => {
    refreshFoods(user?.id).catch(console.error);
  }, [user?.id, refreshFoods]);

  useEffect(() => {
    let disposed = false;

    const reloadFoodsWithRetry = async () => {
      const userId = user?.id;
      if (!userId || !session?.access_token) return;

      const transientPattern = /(jwt|token|session|auth|network|fetch|timed out|temporar|permission|401|403)/i;
      const expectedPrivateCount = privateFoodSeenCountRef.current.get(userId) || 0;
      const maxAttempts = 6;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (disposed) return;

        const { data, error } = await refreshFoods(userId);
        const privateCount = countPrivateFoods(data, userId);
        const missingKnownPrivateFoods = expectedPrivateCount > 0 && privateCount === 0;
        const likelyNotReadyYet = privateCount === 0;

        if (!error && !missingKnownPrivateFoods && !likelyNotReadyYet) return;

        if (!error && (missingKnownPrivateFoods || likelyNotReadyYet) && attempt < maxAttempts - 1) {
          await wait(220 * (attempt + 1));
          continue;
        }

        if (!transientPattern.test(String(error?.message || '')) || attempt === maxAttempts - 1) {
          return;
        }

        await wait(220 * (attempt + 1));
      }
    };

    reloadFoodsWithRetry().catch(console.error);

    return () => {
      disposed = true;
    };
  }, [countPrivateFoods, session?.access_token, user?.id, refreshFoods, wait]);

  useEffect(() => {
    if (!logoutCompletedRef.current) {
      requestEpochRef.current += 1;
      setUser(initialUser || null);
    }
  }, [initialUser]);

  useEffect(() => {
    if (!logoutCompletedRef.current) {
      setSession(initialSession || null);
    }
  }, [initialSession]);

  useEffect(() => {
    if (!logoutCompletedRef.current) {
      setProfile(initialProfile || null);
    }
  }, [initialProfile]);

  const updateAuthState = useCallback((newUser, newSession, newProfile) => {
    requestEpochRef.current += 1;
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
      const epoch = requestEpochRef.current;
      const currentUserId = getCurrentUserId();
      if (currentUserId && currentUserId !== userId) {
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

      let legacyAdmin = false;
      try {
        const direct = await supabase
          .from('app_admins')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!direct.error && direct.data) {
          legacyAdmin = true;
        } else {
          const fallback = await supabase
            .from('app_admins')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
          legacyAdmin = Boolean(!fallback.error && fallback.data);
        }
      } catch {
        legacyAdmin = false;
      }

      const row = data || { id: userId };
      const admin = isAdminProfile(row) || legacyAdmin;
      const normalizedProfile = {
        ...row,
        role: admin ? 'admin' : String(row.role || 'user').toLowerCase(),
        is_admin: admin,
      };

      const finalUserId = getCurrentUserId();
      if ((!finalUserId || finalUserId === userId) && isActiveRequest(epoch, userId)) {
        setProfile(normalizedProfile);
        return { success: true, data: normalizedProfile };
      }

      return { success: false, error: '用户已切换，忽略旧请求结果' };
    } catch (err) {
      setProfile(null);
      return { success: false, error: convertErrorToMessage(err) };
    }
  }, [isActiveRequest]);

  const updatePersonalInfo = useCallback(async (userId, nextFields = {}) => {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!userId) {
      return { success: false, error: '缺少用户 ID' };
    }

    const allowedKeys = ['gender', 'birth_date', 'height_cm', 'weight_kg'];
    const payload = {};
    allowedKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(nextFields, key)) {
        payload[key] = nextFields[key];
      }
    });

    if (Object.keys(payload).length === 0) {
      return { success: true, data: profile };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select('*')
        .maybeSingle();

      if (error) {
        return { success: false, error: convertErrorToMessage(error) };
      }

      if (!data) {
        return { success: false, error: '个人信息保存失败，请稍后重试' };
      }

      const normalizedProfile = {
        ...data,
        role: String(data.role || 'user').toLowerCase(),
        is_admin: isAdminProfile(data),
      };

      setProfile(normalizedProfile);
      return { success: true, data: normalizedProfile };
    } catch (err) {
      return { success: false, error: convertErrorToMessage(err) };
    }
  }, [profile]);

  const loadPlan = useCallback(async (userId) => {
    if (!userId) {
      setPlan(null);
      return { success: false, error: '缺少用户 ID' };
    }

    const epoch = requestEpochRef.current;
    try {
      const { data, error } = await targetService.getLatestTarget(userId);

      if (error) {
        console.error('Failed to load plan:', error);
        if (isActiveRequest(epoch, userId)) {
          setPlan(null);
        }
        return { success: false, error };
      }

      if (!isActiveRequest(epoch, userId)) {
        return { success: false, ignored: true, error: '用户已切换，忽略旧请求结果' };
      }

      setPlan(normalizePlan(data));
      setPlanDate(data?.target_date || null);
      return { success: true, data: normalizePlan(data) };
    } catch (err) {
      console.error('Failed to load plan:', err);
      if (isActiveRequest(epoch, userId)) {
        setPlan(null);
      }
      return { success: false, error: err };
    }
  }, [isActiveRequest]);

  const loadPlanHistory = useCallback(async (userId) => {
    if (!userId) {
      setPlanHistory([]);
      return { success: false, error: '缺少用户 ID' };
    }

    const epoch = requestEpochRef.current;
    try {
      const { data, error } = await targetService.getTargetHistory(userId);

      if (error) {
        console.error('Failed to load plan history:', error);
        if (isActiveRequest(epoch, userId)) {
          setPlanHistory([]);
        }
        return { success: false, error };
      }

      if (!isActiveRequest(epoch, userId)) {
        return { success: false, ignored: true, error: '用户已切换，忽略旧请求结果' };
      }

      setPlanHistory((data || []).map((item) => ({
        id: item.id,
        dateStr: item.target_date,
        plan: normalizePlan(item),
        raw: item,
      })));
      return { success: true, data };
    } catch (err) {
      console.error('Failed to load plan history:', err);
      if (isActiveRequest(epoch, userId)) {
        setPlanHistory([]);
      }
      return { success: false, error: err };
    }
  }, [isActiveRequest]);

  const loadHistory = useCallback(async (userId) => {
    if (!userId) {
      setHistory([]);
      return { success: false, error: '缺少用户 ID' };
    }

    const epoch = requestEpochRef.current;
    try {
      const { data: dates, error } = await historyService.getHistoryDates(userId, 60);

      if (error) {
        console.error('Failed to load history dates:', error);
        if (isActiveRequest(epoch, userId)) {
          setHistory([]);
        }
        return { success: false, error };
      }

      // 并行加载所有历史记录详情，而不是逐个等待
      const detailPromises = (dates || []).map(dateStr =>
        historyService.getHistoryDetail(userId, dateStr).then(detail => ({
          dateStr,
          detail,
        }))
      );

      const results = await Promise.all(detailPromises);

      if (!isActiveRequest(epoch, userId)) {
        return { success: false, ignored: true, error: '用户已切换，忽略旧请求结果' };
      }

      const entries = results
        .filter(({ detail }) => !detail?.error)
        .map(({ dateStr, detail }) => ({
          dateStr,
          dateLabel: detail.dateLabel || formatDateLabel(new Date(`${dateStr}T00:00:00`)),
          timeline: detail.timeline || [],
          totals: detail.nutrition || sumTimelineMacros(detail.timeline || []),
          isEmptyDay: detail.isEmptyDay === true,
          isCompleted: detail.isCompleted === true,
        }));

      setHistory(entries);
      return { success: true, data: entries };
    } catch (err) {
      console.error('Failed to load history:', err);
      if (isActiveRequest(epoch, userId)) {
        setHistory([]);
      }
      return { success: false, error: err };
    }
  }, [isActiveRequest]);

  const loadDayData = useCallback(async (dateStr, userId = user?.id) => {
    if (!userId || !dateStr) return { success: false, error: '缺少必要参数' };

    setCurrentDate(createDateFromString(dateStr));

    const epoch = requestEpochRef.current;
    const [profileResult, foodsResult, planResult, planHistoryResult, historyResult, runningResult, timelineResult] = await Promise.allSettled([
      loadProfile(userId),
      refreshFoods(userId),
      loadPlan(userId),
      loadPlanHistory(userId),
      loadHistory(userId),
      timelineService.getRunningTimelineItems(userId),
      timelineService.getTimelineByDate?.(userId, dateStr) || Promise.resolve({ data: [], error: null }),
    ]);

    if (isActiveRequest(epoch, userId) && timelineResult.status === 'fulfilled' && !timelineResult.value?.error) {
      setTimeline((currentTimeline) => mergeRemoteTimelineWithLocalPending(
        mergePersistedTimelineWithFixedMeals(timelineResult.value?.data),
        currentTimeline
      ));
    }

    return {
      success: true,
      profileResult,
      foodsResult,
      planResult,
      planHistoryResult,
      historyResult,
      runningResult,
      timelineResult,
    };
  }, [isActiveRequest, loadHistory, loadPlan, loadPlanHistory, loadProfile, refreshFoods, user?.id]);

  const syncSelectedDate = useCallback(async (userId, force = false) => {
    if (!userId) return { success: false, error: '缺少用户 ID' };

    const today = getSydneyDateString();
    if (!force && selectedTodayDateRef.current === today) {
      return { success: true, skipped: true };
    }

    const result = await initializeSelectedDate(userId);
    if (result?.success && result.selectedDate) {
      await loadDayData(result.selectedDate, userId);
    }
    return result;
  }, [initializeSelectedDate, loadDayData]);

  const scheduleMidnightSync = useCallback((userId) => {
    if (midnightTimerRef.current) {
      window.clearTimeout(midnightTimerRef.current);
      midnightTimerRef.current = null;
    }

    if (!userId) return;

    const timeout = getSydneyMidnightDelayMs(new Date());

    midnightTimerRef.current = window.setTimeout(async () => {
      await syncSelectedDate(userId, true);
      scheduleMidnightSync(userId);
    }, timeout);
  }, [syncSelectedDate]);

  useEffect(() => () => {
    if (midnightTimerRef.current) {
      window.clearTimeout(midnightTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const userId = user?.id;
      if (!userId) return;

      void syncSelectedDate(userId);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [syncSelectedDate, user?.id]);

  const loadCurrentUserData = useCallback(async (userId) => {
    if (!userId) return;

    const result = await initializeSelectedDate(userId);
    const selectedDate = result?.selectedDate || getSydneyDateString();
    await loadDayData(selectedDate, userId);
    await loadPublicFoods(userId);
    scheduleMidnightSync(userId);
  }, [initializeSelectedDate, loadDayData, loadPublicFoods, scheduleMidnightSync]);

  const resolveTimelineForDate = useCallback((dateStr) => {
    const cached = timelineCacheRef.current.get(dateStr);
    if (cached) {
      return cloneTimeline(cached);
    }

    const entry = history.find((item) => item.dateStr === dateStr);
    if (entry?.timeline?.length) {
      timelineCacheRef.current.set(dateStr, cloneTimeline(entry.timeline));
      return cloneTimeline(entry.timeline);
    }

    return freshTimeline();
  }, [history]);

  const setSelectedDate = useCallback((nextDate) => {
    const nextDateStr = typeof nextDate === 'string' ? nextDate : getSydneyDateString(nextDate);
    if (!nextDateStr) return;

    const activeDateStr = getSydneyDateString(currentDate);
    timelineCacheRef.current.set(activeDateStr, cloneTimeline(timeline));

    setCurrentDate(createDateFromString(nextDateStr));
    setTimeline(resolveTimelineForDate(nextDateStr));
  }, [currentDate, resolveTimelineForDate, timeline]);

  const goHome = useCallback(async (userId = user?.id) => {
    if (!userId) {
      return { success: false, error: '缺少用户 ID' };
    }

    const result = await initializeSelectedDate(userId);
    if (!result?.success || !result.selectedDate) return result;

    const loaded = await loadDayData(result.selectedDate, userId);
    return {
      ...result,
      loadSuccess: loaded?.success === true,
      loadError: loaded?.timelineResult?.value?.error || null,
    };
  }, [initializeSelectedDate, loadDayData, user?.id]);

  const requireAdmin = useCallback(() => {
    if (!user?.id) {
      return { success: false, error: '请先登录' };
    }

    if (!profile) {
      return { success: false, error: '管理员身份尚未加载完成，请稍后重试。' };
    }

    const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
    if (!isAdmin) {
      return { success: false, error: '你没有权限修改公共食品。' };
    }

    return { success: true };
  }, [profile, user?.id]);

  const reloadFoodLibrary = useCallback(async (userId) => {
    await Promise.allSettled([
      refreshFoods(userId),
      loadPublicFoods(userId),
    ]);
  }, [loadPublicFoods, refreshFoods]);

  const createPublicFood = useCallback(async (food) => {
    const adminCheck = requireAdmin();
    if (!adminCheck.success) return adminCheck;

    try {
      const { data, error } = await foodService.createPublicFood(user.id, food);
      if (error) {
        return { success: false, error };
      }

      await reloadFoodLibrary(user.id);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err };
    }
  }, [reloadFoodLibrary, requireAdmin, user?.id]);

  const updatePublicFood = useCallback(async (foodId, food) => {
    const adminCheck = requireAdmin();
    if (!adminCheck.success) return adminCheck;

    try {
      const { data, error } = await foodService.updatePublicFood(user.id, foodId, food);
      if (error) {
        return { success: false, error };
      }

      await reloadFoodLibrary(user.id);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err };
    }
  }, [reloadFoodLibrary, requireAdmin, user?.id]);

  const setPublicFoodActive = useCallback(async (foodId, isActive) => {
    const adminCheck = requireAdmin();
    if (!adminCheck.success) return adminCheck;

    try {
      const { data, error } = await foodService.setPublicFoodActive(user.id, foodId, isActive);
      if (error) {
        return { success: false, error };
      }

      await reloadFoodLibrary(user.id);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err };
    }
  }, [reloadFoodLibrary, requireAdmin, user?.id]);

  const savePlan = useCallback(async (
    userId,
    nextPlan,
    targetDate = toDateStr(new Date()),
    calculatedField = 'calories'
  ) => {
    if (!userId) {
      return { success: false, error: '请先登录后再保存计划' };
    }

    try {
      const payload = {
        calories_target: Number(nextPlan?.calories) || 0,
        protein_target: Number(nextPlan?.protein) || 0,
        fat_target: Number(nextPlan?.fat) || 0,
        carbs_target: Number(nextPlan?.carbs) || 0,
        calculated_field: String(calculatedField || 'calories'),
        target_date: targetDate,
      };

      const { data, error } = await targetService.saveIntakePlanWithHistory(userId, payload);

      if (error) {
        return { success: false, error };
      }

      const normalized = normalizePlan(data) || normalizePlan({ ...payload });
      setPlan(normalized);
      setPlanDate(targetDate);
      await loadPlanHistory(userId);
      return { success: true, data: normalized };
    } catch (err) {
      return { success: false, error: err };
    }
  }, [loadPlanHistory]);

  const deletePlan = useCallback(async (userId, targetDate) => {
    if (!userId || !targetDate) {
      return { success: false, error: '缺少必要参数' };
    }

    try {
      const { error } = await targetService.deleteTarget(userId, targetDate);

      if (error) {
        return { success: false, error };
      }

      await loadPlanHistory(userId);
      const latest = await targetService.getLatestTarget(userId);
      setPlan(normalizePlan(latest.data));
      setPlanDate(latest.data?.target_date || null);
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  }, [loadPlanHistory]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    void initializeSelectedDate(userId).then((result) => {
      if (result?.success && result.selectedDate) {
        void loadDayData(result.selectedDate, userId);
        scheduleMidnightSync(userId);
      }
    });
  }, [initializeSelectedDate, loadDayData, scheduleMidnightSync, user?.id]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      void timelineRealtimeService.stop();
      return undefined;
    }

    let disposed = false;
    const onInvalidate = (message) => {
      if (disposed || message?.user_id !== userId) return;
      const activeDate = getSydneyDateString(currentDateRef.current);
      if (message?.record_date && message.record_date !== activeDate) {
        timelineCacheRef.current.delete(message.record_date);
        return;
      }

      if (realtimeReloadTimerRef.current) window.clearTimeout(realtimeReloadTimerRef.current);
      realtimeReloadTimerRef.current = window.setTimeout(async () => {
        const dateToReload = getSydneyDateString(currentDateRef.current);
        const { data, error } = await timelineService.getTimelineByDate(userId, dateToReload);
        if (!disposed && !error && getSydneyDateString(currentDateRef.current) === dateToReload) {
          setTimeline((currentTimeline) => {
            const nextTimeline = mergeRemoteTimelineWithLocalPending(
              mergePersistedTimelineWithFixedMeals(data),
              currentTimeline
            );
            timelineCacheRef.current.set(dateToReload, cloneTimeline(nextTimeline));
            return nextTimeline;
          });
        }
      }, 40);
    };

    void timelineRealtimeService.start({ userId, onInvalidate });
    return () => {
      disposed = true;
      if (realtimeReloadTimerRef.current) {
        window.clearTimeout(realtimeReloadTimerRef.current);
        realtimeReloadTimerRef.current = null;
      }
      void timelineRealtimeService.stop();
    };
  }, [user?.id]);

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
        requestEpochRef.current += 1;

        const initResult = await initializeSelectedDate(signedInUser.id);
        await loadDayData(initResult?.selectedDate || getSydneyDateString(), signedInUser.id);
        scheduleMidnightSync(signedInUser.id);

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
  }, [initializeSelectedDate, loadDayData, scheduleMidnightSync]);

  const signOutAndClear = useCallback(async (failureMessage) => {
    setAuthLoading(true);
    setAuthError(null);

    if (!supabase) {
      const errorMsg = 'Supabase 尚未配置';
      setAuthError(errorMsg);
      setAuthLoading(false);
      return { success: false, error: errorMsg };
    }

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        const finalMessage = failureMessage || convertErrorToMessage(error);
        setAuthError(finalMessage);
        return { success: false, error: finalMessage };
      }

      clearPrivateUserData();
      return { success: true };
    } catch (err) {
      const finalMessage = failureMessage || convertErrorToMessage(err);
      setAuthError(finalMessage);
      return { success: false, error: finalMessage };
    } finally {
      setAuthLoading(false);
    }
  }, [clearPrivateUserData]);

  const logout = useCallback(async () => {
    return signOutAndClear('退出登录失败，请检查网络后重试。');
  }, [signOutAndClear]);

  const signOut = useCallback(async () => {
    return logout();
  }, [logout]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const endDay = useCallback(() => {
    const userId = user?.id;
    if (!userId) {
      return Promise.resolve({ success: false, error: '请先登录' });
    }

    if (endDaySubmittingRef.current) {
      return Promise.resolve({ success: false, duplicate: true });
    }

    endDaySubmittingRef.current = true;

    const dateStr = toDateStr(currentDate);
    const timelineToArchive = filterMeaningfulTimelineItems(timeline);
    const totals = sumTimelineMacros(timelineToArchive);

    // 关键操作：保存当日归档
    return historyService.saveDayArchive(userId, dateStr, timelineToArchive, totals)
      .then(async ({ error }) => {
        if (error) {
          throw error;
        }

        // 关键操作：立即推进日期、清空timeline、返回成功
        const nextDateStr = addDaysToDateString(toDateStr(currentDate), 1);
        setRecordingDateStr(nextDateStr);
        setCurrentDate(createDateFromString(nextDateStr));
        setTimeline(freshTimeline());

        // 非关键操作：异步加载历史记录（不阻塞返回）
        loadHistory(userId).catch((err) => {
          console.error('Failed to load history in background:', err);
        });

        return { success: true };
      })
      .catch((err) => ({ success: false, error: err }))
      .finally(() => {
        endDaySubmittingRef.current = false;
      });
  }, [currentDate, loadHistory, timeline, user?.id]);

  useEffect(() => {
    const dateKey = getSydneyDateString(currentDate);
    timelineCacheRef.current.set(dateKey, cloneTimeline(timeline));
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
    logout,
    clearPrivateUserData,
    clearAuthError,
    loadProfile,
    updatePersonalInfo,
    loadCurrentUserData,
    loadPlan,
    loadPlanHistory,
    loadHistory,
    savePlan,
    deletePlan,

    currentDate,
    recordingDateStr,
    setSelectedDate,
    dateLabel: formatDateLabel(currentDate),
    timeline,
    setTimeline,
    plan,
    setPlan,
    planDate,
    setPlanDate,
    planHistory,
    setPlanHistory,
    history,
    setHistory,
    dayInitialized,
    foods,
    setFoods,
    refreshFoods,
    publicFoods,
    setPublicFoods,
    loadPublicFoods,
    createPublicFood,
    updatePublicFood,
    setPublicFoodActive,
    favorites,
    setFavorites,
    endDay,
    goHome,
    resetDeletedDateState,
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
