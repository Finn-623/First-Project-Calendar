import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NutritionSummary } from '../components/NutritionSummary';
import { TimelineItem } from '../components/TimelineItem';
import { LiveClock } from '../components/LiveClock';
import { AddFoodSheet } from '../modals/AddFoodSheet';
import { AddSnackSheet } from '../modals/AddSnackSheet';
import { AddTrainingSheet } from '../modals/AddTrainingSheet';
import { AddEventSheet } from '../modals/AddEventSheet';
import { EditTimeSheet } from '../modals/EditTimeSheet';
import { EditActivitySheet } from '../modals/EditActivitySheet';
import { sumTimelineMacros } from '../mockData';
import { Plus, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { showSuccess } from '../lib/notifications';
import { useStore } from '../store';
import { timelineService } from '../services/timelineService';
import { addDaysToDateString, getSydneyDateString } from '../services/historyService';
import { combineLocalDateAndTime, diffSecondsBetween, getLocalDateKey, getLocalTimeInputValue, secondsToDurationMinutes } from '../lib/localDateTime';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { beginCreatePerfFlow, markCreatePerf, summarizeCreatePerfFlow } from '../lib/timelineCreatePerf';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

const timeToMinutes = (t) => {
  if (!t) return 24 * 60;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const getNowMinuteValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return (date.getHours() * 60) + date.getMinutes();
};

const buildTimelineDisplayItems = (sortedItems, nowMinuteValue, shouldShowNowMarker) => {
  if (!shouldShowNowMarker || nowMinuteValue == null) {
    return sortedItems.map((item) => ({ kind: 'item', item }));
  }

  // Put "now" before the first item later than current minute.
  // Same-minute items stay above the marker to keep order stable.
  let insertIndex = sortedItems.length;
  for (let index = 0; index < sortedItems.length; index += 1) {
    const item = sortedItems[index];
    if (timeToMinutes(item?.time) > nowMinuteValue) {
      insertIndex = index;
      break;
    }
  }

  const displayItems = [];
  sortedItems.forEach((item, index) => {
    if (index === insertIndex) {
      displayItems.push({ kind: 'now-marker' });
    }
    displayItems.push({ kind: 'item', item });
  });

  if (insertIndex === sortedItems.length) {
    displayItems.push({ kind: 'now-marker' });
  }

  return displayItems;
};

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const getWeekDateStrings = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = utcDate.getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  const mondayDateStr = addDaysToDateString(dateStr, -mondayOffset);
  return Array.from({ length: 7 }, (_, idx) => addDaysToDateString(mondayDateStr, idx));
};

export const formatNonTodayNoticeDate = (dateStr, deviceTodayStr) => {
  const [year, month, day] = String(dateStr || '').split('-').map(Number);
  const todayYear = Number(String(deviceTodayStr || '').split('-')[0]);
  if (!year || !month || !day) return '';
  return year === todayYear ? `${month}月${day}日` : `${year}年${month}月${day}日`;
};

const AddPickerMenu = ({ onSnack, onTraining, onEvent, testIdPrefix = 'picker' }) => (
  <div className="w-56 rounded-2xl bg-white border border-[#E5E5E0] shadow-lg overflow-hidden" data-testid="add-picker">
    {[
      { label: '加餐', onClick: onSnack, testId: `${testIdPrefix}-snack` },
      { label: '训练', onClick: onTraining, testId: `${testIdPrefix}-training` },
      { label: '其他事件', onClick: onEvent, testId: `${testIdPrefix}-event` },
    ].map((it) => (
      <button
        key={it.label}
        onClick={it.onClick}
        data-testid={it.testId}
        className="w-full px-4 py-3 text-left text-[13.5px] text-[#2C332F] hover:bg-[#F7F7F5] border-b border-[#F0EFE9] last:border-none"
      >
        {it.label}
      </button>
    ))}
  </div>
);

export const TodayPage = () => {
  const { timeline, setTimeline, plan, dateLabel, endDay, dayInitialized, currentDate, recordingDateStr, setSelectedDate, goHome, user, loadHistory } = useStore();
  const [foodSheet, setFoodSheet] = useState({ open: false, target: null });
  const [snackSheetOpen, setSnackSheetOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [timeSheet, setTimeSheet] = useState({ open: false, item: null });
  const [fabOpen, setFabOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogKind, setDeleteDialogKind] = useState('timeline-item');
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [pendingDeleteFood, setPendingDeleteFood] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [deletingFoodEntryKey, setDeletingFoodEntryKey] = useState(null);
  const [endingItemId, setEndingItemId] = useState(null);
  const [savingEditItemId, setSavingEditItemId] = useState(null);
  const [endDayLoading, setEndDayLoading] = useState(false);
  const [editActivitySheet, setEditActivitySheet] = useState({ open: false, item: null });
  const fabButtonRef = useRef(null);
  const addMenuRef = useRef(null);
  const pendingOpenPerfRef = useRef(null);
  const deletingFoodGuardRef = useRef(false);
  const addingFoodGuardRef = useRef(false);
  const now = useCurrentTime();

  useEffect(() => {
    if (!fabOpen) {
      if (pendingOpenPerfRef.current?.flowId) {
        markCreatePerf(pendingOpenPerfRef.current.flowId, 'menu_closed');
      }
      return undefined;
    }

    const handlePointerDownOutside = (event) => {
      const target = event.target;

      if (addMenuRef.current?.contains(target)) return;
      if (fabButtonRef.current?.contains(target)) return;

      setFabOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [fabOpen]);

  const sorted = useMemo(
    () => [...timeline].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)),
    [timeline]
  );

  const currentDateStr = useMemo(() => getSydneyDateString(currentDate), [currentDate]);
  const todaySydneyStr = useMemo(() => getSydneyDateString(now), [now]);
  const selectedLocalDateStr = useMemo(() => getLocalDateKey(currentDate), [currentDate]);
  const deviceTodayStr = useMemo(() => getLocalDateKey(now), [now]);
  const isViewingDeviceToday = selectedLocalDateStr === deviceTodayStr;
  const nonTodayNoticeDate = useMemo(
    () => formatNonTodayNoticeDate(selectedLocalDateStr, deviceTodayStr),
    [deviceTodayStr, selectedLocalDateStr]
  );
  const isViewingToday = currentDateStr === todaySydneyStr;
  const isViewingRecordingDate = currentDateStr === recordingDateStr;
  const dateSectionTitle = isViewingToday ? 'TODAY' : '历史记录';
  const weekDateStrings = useMemo(() => getWeekDateStrings(currentDateStr), [currentDateStr]);
  const [currentYear, currentMonth] = currentDateStr.split('-').map(Number);
  const showBackToToday = currentDateStr !== todaySydneyStr;

  const totals = useMemo(() => sumTimelineMacros(timeline), [timeline]);
  const hasRunningTimelineItem = timeline.some((item) => item.status === 'running');
  const nowMinuteValue = useMemo(() => getNowMinuteValue(now), [now]);
  const nowTimeLabel = useMemo(() => getLocalTimeInputValue(now), [now]);

  const displayTimelineItems = useMemo(
    () => buildTimelineDisplayItems(sorted, nowMinuteValue, isViewingToday),
    [isViewingToday, nowMinuteValue, sorted]
  );

  const refreshDayState = async () => {
    if (user?.id) {
      await loadHistory(user.id);
    }
  };

  const appendTimelineItem = (item, flowId = null) => {
    setTimeline((prev) => {
      const existingIndex = prev.findIndex((currentItem) => currentItem.id === item.id);

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = item;
        return next;
      }

      return [...prev, item];
    });

    if (flowId) {
      markCreatePerf(flowId, 'timeline_state_updated', { itemId: item?.id || null });
    }
  };

  const updateTimelineItemInState = (itemId, updater) => {
    setTimeline((prev) => prev.map((item) => (item.id === itemId ? updater(item) : item)));
  };

  const buildBaseSessionItem = ({ item_type, title, time, notes, details, status = 'completed', started_at, ended_at, duration_minutes, subtype, bodyParts }) => ({
    id: `t${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    item_type,
    title,
    event_date: currentDateStr,
    event_time: time,
    notes: notes || null,
    details: {
      ...(details || {}),
      bodyParts,
    },
    status,
    started_at,
    ended_at,
    duration_minutes,
    subtype,
  });

  const createSessionTime = (dateStr, timeStr) => combineLocalDateAndTime(dateStr, timeStr);

  const isLikelySupabaseUuid = (value) => typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const buildFoodEntryKey = (food, index) => {
    if (food?.entryId) return String(food.entryId);
    if (food?.id) return String(food.id);
    if (food?.foodEntryId) return String(food.foodEntryId);
    return `legacy-${index}-${food?.foodId || food?.name || 'food'}`;
  };

  const runningSessionConflictMessage = '请先结束当前正在进行的记录';
  const createHandledError = (message) => {
    const error = new Error(message);
    error.alreadyToasted = true;
    return error;
  };

  const handlePickDate = (dateStr) => {
    if (dateStr === currentDateStr) return;
    setSelectedDate(dateStr);
  };

  const handleShiftWeek = (deltaDays) => {
    setSelectedDate(addDaysToDateString(currentDateStr, deltaDays));
  };

  const handleBackToToday = () => {
    if (!showBackToToday) return;
    void goHome();
  };

  const handleAddFood = (mealItem) => setFoodSheet({ open: true, target: mealItem });

  const handleFoodConfirm = async (food) => {
    const targetMeal = foodSheet.target;
    if (!user?.id || !targetMeal || addingFoodGuardRef.current) return false;

    addingFoodGuardRef.current = true;
    try {
      const { data, error } = await timelineService.createFoodEntryForMeal({
        userId: user.id,
        dateStr: currentDateStr,
        meal: targetMeal,
        food,
      });
      if (error || !data?.meal?.id || !data?.foodEntry?.entryId) {
        throw error || new Error('食品记录保存失败');
      }

      setTimeline((currentTimeline) => currentTimeline.map((item) => (
        item.id === targetMeal.id
          ? {
            ...item,
            ...data.meal,
            fixed: item.fixed,
            foods: [...(item.foods || []), data.foodEntry],
          }
          : item
      )));
      setFoodSheet({ open: false, target: null });
      showSuccess(`已添加 ${food.name} 到 ${targetMeal.title}`);
      return true;
    } catch (error) {
      toast.error(error?.message || '食品记录保存失败，请稍后重试');
      return false;
    } finally {
      addingFoodGuardRef.current = false;
    }
  };

  const handleOpenSnackSheet = () => {
    setSnackSheetOpen(true);
    setFabOpen(false);
  };

  const handleAddSnack = ({ time, snackType }) => {
    const id = `s${Date.now()}`;
    setTimeline([
      ...timeline,
      {
        id,
        type: 'meal',
        subtype: 'snack',
        snackType,
        title: '加餐',
        time,
        fixed: false,
        foods: [],
      },
    ]);
    showSuccess('已添加加餐');
  };

  const openTraining = () => {
    const flowId = beginCreatePerfFlow('open-training-sheet');
    pendingOpenPerfRef.current = { flowId, type: 'training' };
    markCreatePerf(flowId, 'menu_item_click');

    setFabOpen(false);
    markCreatePerf(flowId, 'sheet_open_state_set');
    setTrainingOpen(true);
  };
  const openEvent = () => {
    const flowId = beginCreatePerfFlow('open-event-sheet');
    pendingOpenPerfRef.current = { flowId, type: 'event' };
    markCreatePerf(flowId, 'menu_item_click');

    setFabOpen(false);
    markCreatePerf(flowId, 'sheet_open_state_set');
    setEventOpen(true);
  };

  const startLiveSession = async ({ item_type, title, notes, details, bodyParts, perfFlowId = null }) => {
    if (perfFlowId) {
      markCreatePerf(perfFlowId, 'submit_validation_finished', { mode: 'live', item_type });
    }

    if (!isViewingToday) {
      toast.error('只能在今天开始实时记录');
      throw createHandledError('只能在今天开始实时记录');
    }

    if (hasRunningTimelineItem) {
      toast.error(runningSessionConflictMessage);
      throw createHandledError(runningSessionConflictMessage);
    }

    if (!user?.id) {
      toast.error('请先登录');
      throw createHandledError('请先登录');
    }

    const now = new Date();
    const time = getLocalTimeInputValue(now);
    const startedAt = now.toISOString();
    const payload = {
      event_date: currentDateStr,
      event_time: time,
      item_type,
      title,
      notes: notes || null,
      details: {
        ...(details || {}),
        bodyParts: bodyParts || [],
      },
      status: 'running',
      started_at: startedAt,
      ended_at: null,
      duration_minutes: null,
      sort_order: timeline.length + 1,
    };

    try {
      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'insert_request_sent');
      }
      const { data, error } = await timelineService.createTimelineItem(user.id, payload);
      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'insert_request_returned', { hasError: Boolean(error) });
      }

      if (error) {
        if (String(error.message || '').includes('timeline_items_one_running_per_user')) {
          toast.error(runningSessionConflictMessage);
          throw createHandledError(runningSessionConflictMessage);
        }
        throw error;
      }

      if (data) {
        appendTimelineItem(data, perfFlowId);
      }

      showSuccess(`已开始${title}`);

      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'create_success');
      }

      Promise.resolve(refreshDayState()).catch(() => null);
    } catch (error) {
      if (!error?.alreadyToasted) {
        toast.error(error?.message || '开始失败，请稍后重试');
      }
      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'create_failed', { message: String(error?.message || '') });
      }
      throw error;
    }
  };

  const handleAddEvent = async (payload) => {
    const perfFlowId = payload?.perfFlowId || null;

    if (!user?.id) {
      toast.error('请先登录');
      throw new Error('请先登录');
    }

    const eventDate = currentDateStr;

    if (payload.mode === 'live') {
      await startLiveSession({
        item_type: 'other',
        title: payload.title,
        notes: payload.detail,
        details: { mode: 'live' },
        perfFlowId,
      });
      return;
    }

    if (perfFlowId) {
      markCreatePerf(perfFlowId, 'submit_validation_finished', { mode: 'manual', item_type: 'other' });
    }

    const startedAt = createSessionTime(eventDate, payload.time);
    const payloadToSave = {
      event_date: eventDate,
      event_time: payload.time,
      item_type: 'other',
      title: payload.title,
      notes: payload.detail || null,
      details: { mode: 'manual' },
      status: 'completed',
      started_at: startedAt ? startedAt.toISOString() : null,
      ended_at: null,
      duration_minutes: null,
      sort_order: timeline.length + 1,
    };

    try {
      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'insert_request_sent');
      }
      const { data, error } = await timelineService.createTimelineItem(user.id, payloadToSave);
      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'insert_request_returned', { hasError: Boolean(error) });
      }
      if (error) throw error;
      if (data) {
        appendTimelineItem(data, perfFlowId);
      }

      Promise.resolve(refreshDayState()).catch(() => null);

      showSuccess(`已添加 ${payload.title}`);

      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'create_success');
      }
    } catch (error) {
      toast.error(error?.message || '添加失败，请稍后重试');
      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'create_failed', { message: String(error?.message || '') });
      }
      throw error;
    }
  };

  const handleAddTraining = async (payload) => {
    const perfFlowId = payload?.perfFlowId || null;

    if (!user?.id) {
      toast.error('请先登录');
      throw new Error('请先登录');
    }

    const itemType = payload.tab === 'anaerobic' ? 'anaerobic_training' : 'aerobic_training';
    const aerobicProjectName = payload.tab === 'aerobic' ? String(payload.name || '').trim() : '';
    const title = payload.tab === 'anaerobic' ? '无氧训练' : aerobicProjectName;

    if (payload.mode === 'live') {
      await startLiveSession({
        item_type: itemType,
        title,
        notes: null,
        details: { mode: 'live', name: aerobicProjectName, tab: payload.tab },
        bodyParts: payload.bodyParts || [],
        perfFlowId,
      });
      return;
    }

    if (perfFlowId) {
      markCreatePerf(perfFlowId, 'submit_validation_finished', { mode: 'manual', item_type: itemType });
    }

    const startedAt = createSessionTime(currentDateStr, payload.time);
    const durationMinutes = Number(payload.duration) || 0;
    const endedAt = startedAt && durationMinutes > 0
      ? new Date(startedAt.getTime() + durationMinutes * 60000)
      : null;
    const payloadToSave = {
      event_date: currentDateStr,
      event_time: payload.time,
      item_type: itemType,
      title,
      notes: null,
      details: {
        mode: 'manual',
        name: aerobicProjectName,
        tab: payload.tab,
        bodyParts: payload.bodyParts || [],
      },
      status: 'completed',
      started_at: startedAt ? startedAt.toISOString() : null,
      ended_at: endedAt ? endedAt.toISOString() : null,
      duration_minutes: durationMinutes || null,
      sort_order: timeline.length + 1,
    };

    try {
      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'insert_request_sent');
      }
      const { data, error } = await timelineService.createTimelineItem(user.id, payloadToSave);
      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'insert_request_returned', { hasError: Boolean(error) });
      }
      if (error) throw error;
      if (data) {
        appendTimelineItem(data, perfFlowId);
      }

      Promise.resolve(refreshDayState()).catch(() => null);

      showSuccess(`已添加 ${title}`);

      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'create_success');
      }
    } catch (error) {
      toast.error(error?.message || '添加失败，请稍后重试');
      if (perfFlowId) {
        markCreatePerf(perfFlowId, 'create_failed', { message: String(error?.message || '') });
      }
      throw error;
    }
  };

  const handleEndTimelineItem = async (item) => {
    if (!user?.id || !item?.id || endingItemId) return;
    if (item.status !== 'running') return;

    setEndingItemId(item.id);
    const endedAt = new Date();
    const durationSeconds = item.started_at ? diffSecondsBetween(new Date(item.started_at), endedAt) : null;
    const durationMinutes = secondsToDurationMinutes(durationSeconds);

    try {
      const { data, error } = await timelineService.completeRunningTimelineItem(item.id, user.id, {
        status: 'completed',
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMinutes,
      });

      if (error) {
        throw error;
      }

      if (data) {
        updateTimelineItemInState(item.id, () => data);
        await refreshDayState();
      }

      showSuccess('记录已结束');
    } catch (error) {
      toast.error(error?.message || '结束失败，请稍后重试');
    } finally {
      setEndingItemId(null);
    }
  };

  const prepareActivityUpdates = (item, updates) => {
    const next = {
      ...updates,
    };

    const startedAt = Object.prototype.hasOwnProperty.call(next, 'started_at') ? next.started_at : item?.started_at;
    const endedAt = Object.prototype.hasOwnProperty.call(next, 'ended_at') ? next.ended_at : item?.ended_at;

    const touchedTime = Object.prototype.hasOwnProperty.call(next, 'started_at') || Object.prototype.hasOwnProperty.call(next, 'ended_at');

    if (touchedTime) {
      if (!endedAt) {
        next.duration_minutes = null;
      } else {
        const seconds = diffSecondsBetween(new Date(startedAt), new Date(endedAt));
        next.duration_minutes = secondsToDurationMinutes(seconds);
      }
    }

    return next;
  };

  const handleEditActivityConfirm = async (item, updates) => {
    if (!user?.id || !item?.id) {
      toast.error('请先登录');
      return;
    }

    if (savingEditItemId === item.id) {
      return;
    }

    setSavingEditItemId(item.id);

    const payload = prepareActivityUpdates(item, updates);

    try {
      const { data, error } = await timelineService.updateTimelineItem(item.id, payload);
      if (error) {
        throw error;
      }

      if (data) {
        updateTimelineItemInState(item.id, () => data);

        // Event edits should not block on full-history refresh.
        // Keep non-event edits consistent via background sync only.
        if (item.type !== 'event') {
          Promise.resolve(refreshDayState()).catch(() => null);
        }
      }

      showSuccess('记录已更新');
    } catch (error) {
      toast.error(error?.message || '更新失败，请稍后重试');
      throw error;
    } finally {
      setSavingEditItemId(null);
    }
  };

  const handleTimeConfirm = async (newTime) => {
    const item = timeSheet.item;
    if (!user?.id || !item?.id) {
      const error = new Error('请先登录');
      toast.error(error.message);
      throw error;
    }
    if (!['breakfast', 'lunch', 'dinner'].includes(item.subtype)) {
      const error = new Error('只能修改固定三餐时间');
      toast.error(error.message);
      throw error;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime)) {
      const error = new Error('请输入有效的 24 小时时间');
      toast.error(error.message);
      throw error;
    }
    if (savingEditItemId === item.id || newTime === item.time) return;

    setSavingEditItemId(item.id);
    try {
      const result = isLikelySupabaseUuid(item.id)
        ? await timelineService.updateTimelineItemByUser(item.id, user.id, { event_time: newTime })
        : await timelineService.createTimelineItem(user.id, {
          event_date: currentDateStr,
          event_time: newTime,
          item_type: item.subtype,
          title: item.title,
          notes: null,
          details: {},
          sort_order: ['breakfast', 'lunch', 'dinner'].indexOf(item.subtype) + 1,
        });

      if (result.error) throw result.error;

      setTimeline((prev) => prev.map((entry) => (
        entry.id === item.id
          ? { ...entry, ...(result.data || {}), foods: entry.foods || [], time: newTime, fixed: true }
          : entry
      )));
      showSuccess('时间已更新');
    } catch (error) {
      toast.error(error?.message || '时间保存失败，请稍后重试');
      throw error;
    } finally {
      setSavingEditItemId(null);
    }
  };

  const handleDeleteClick = (item) => {
    if (deletingFoodEntryKey || deletingItemId) return;
    setDeleteDialogKind('timeline-item');
    setPendingDeleteItem(item);
    setPendingDeleteFood(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteFood = (mealItem, food, foodIndex) => {
    if (!mealItem || deletingFoodEntryKey || deletingItemId) return;

    setDeleteDialogKind('food-entry');
    setPendingDeleteItem(mealItem);

    setPendingDeleteFood({
      mealItemId: mealItem.id,
      foodIndex,
      foodEntryKey: buildFoodEntryKey(food, foodIndex),
      foodName: food?.name || '该食物',
      mealTitle: mealItem?.title || '该餐次',
    });

    setDeleteDialogOpen(true);
  };

  const removeFoodEntryFromTimeline = (currentTimeline, mealItemId, foodEntryKey, foodIndex = null) => currentTimeline
    .map((item) => {
      if (item.id !== mealItemId) return item;

      const nextFoods = Array.isArray(item.foods) ? [...item.foods] : [];

      if (Number.isInteger(foodIndex) && foodIndex >= 0 && foodIndex < nextFoods.length) {
        nextFoods.splice(foodIndex, 1);
      } else {
        const filteredFoods = nextFoods.filter((food, index) => buildFoodEntryKey(food, index) !== foodEntryKey);
        nextFoods.splice(0, nextFoods.length, ...filteredFoods);
      }

      if (nextFoods.length === 0) {
        return null;
      }

      return {
        ...item,
        foods: nextFoods,
      };
    })
    .filter(Boolean);
  const handleConfirmDelete = async () => {
    if (!pendingDeleteItem) return;

    if (!user?.id) {
      toast.error('请先登录');
      return;
    }

    if (deleteDialogKind === 'food-entry') {
      if (deletingFoodGuardRef.current) return;

      if (!pendingDeleteFood?.mealItemId || !pendingDeleteFood?.foodEntryKey) {
        return;
      }

      const mealItem = timeline.find((it) => it.id === pendingDeleteFood.mealItemId);
      if (!mealItem || mealItem.type !== 'meal') {
        toast.error('目标餐次不存在，请刷新后重试');
        setDeleteDialogOpen(false);
        setPendingDeleteFood(null);
        setPendingDeleteItem(null);
        return;
      }

      const foods = Array.isArray(mealItem.foods) ? mealItem.foods : [];
      const targetIndex = foods.findIndex((food, index) => buildFoodEntryKey(food, index) === pendingDeleteFood.foodEntryKey);
      if (targetIndex < 0) {
        toast.error('目标食物不存在，请刷新后重试');
        setDeleteDialogOpen(false);
        setPendingDeleteFood(null);
        setPendingDeleteItem(null);
        return;
      }

      const isLastFood = foods.length === 1;
      const shouldDeleteMealRow = isLastFood && isLikelySupabaseUuid(mealItem.id);
      const shouldDeleteFoodRow = !isLastFood && isLikelySupabaseUuid(pendingDeleteFood.foodEntryKey);

      deletingFoodGuardRef.current = true;
      setDeletingFoodEntryKey(pendingDeleteFood.foodEntryKey);

      const nextTimeline = removeFoodEntryFromTimeline(
        timeline,
        mealItem.id,
        pendingDeleteFood.foodEntryKey,
        pendingDeleteFood.foodIndex,
      );

      try {
        if (shouldDeleteMealRow) {
          const { error } = await timelineService.deleteTimelineItemByUser(mealItem.id, user.id);
          if (error) {
            toast.error(error?.message || '删除失败，请稍后重试');
            return;
          }
        } else if (shouldDeleteFoodRow) {
          const { error } = await timelineService.deleteFoodEntry(pendingDeleteFood.foodEntryKey, user.id);
          if (error) {
            toast.error(error?.message || '删除失败，请稍后重试');
            return;
          }
        } else {
          toast.error('食物记录缺少有效标识，请刷新后重试');
          return;
        }

        setTimeline(nextTimeline);
        setDeleteDialogOpen(false);
        setPendingDeleteFood(null);
        setPendingDeleteItem(null);
        showSuccess('食物已删除');
        return;
      } finally {
        deletingFoodGuardRef.current = false;
        setDeletingFoodEntryKey(null);
      }
    }

    const item = pendingDeleteItem;
    setDeletingItemId(item.id);

    try {
      if (isLikelySupabaseUuid(item.id)) {
        const { error } = await timelineService.deleteTimelineItemByUser(item.id, user.id);
        if (error) {
          toast.error(error?.message || '删除失败，请稍后重试');
          return;
        }
      }

      setTimeline((prev) => prev.filter((it) => it.id !== item.id));
      setDeleteDialogOpen(false);
      setPendingDeleteItem(null);
      setPendingDeleteFood(null);
      showSuccess('活动已删除');
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleEndDay = () => {
    if (hasRunningTimelineItem) {
      toast.error('请先结束正在进行的事件或训练');
      return;
    }

    if (endDayLoading) {
      return; // 防止重复点击
    }

    setEndDayLoading(true);
    Promise.resolve(endDay()).then((result) => {
      if (result?.duplicate) {
        setEndDayLoading(false);
        return;
      }

      if (result?.success || result?.skipped) {
        if (result?.success) {
          showSuccess('本日已归档，开启新的一天');
        }
        setEndDayLoading(false);
        return;
      }

      toast.error(result?.error?.message || '归档失败，请稍后重试');
      setEndDayLoading(false);
    });
  };

  return (
    <div className="pb-32">
      {!dayInitialized ? (
        <div className="px-5 pt-10 text-[13px] text-[#858C88]">正在同步今日日期...</div>
      ) : null}
      {dayInitialized && !isViewingDeviceToday ? (
        <div
          className="mx-5 mt-5 max-w-full rounded-2xl border border-[#D7E8E0] bg-[#EEF7F2] px-4 py-3 text-[#2C332F]"
          data-testid="non-today-date-notice"
          role="status"
        >
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#6D8376]">DATE NOTICE</div>
          <div className="mt-1 break-words text-[13px] leading-5">
            你已离开本日，当前正在查看和修改 {nonTodayNoticeDate}的记录与计划。
          </div>
        </div>
      ) : null}
      <header className="px-5 pt-6 pb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">{dateSectionTitle}</p>
          <h1 className="text-[22px] font-medium text-[#2C332F] mt-1" data-testid="today-date">
            {dateLabel}
          </h1>
          <LiveClock />
        </div>
      </header>

      <section className="px-5 mb-4" data-testid="weekly-calendar">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[14px] font-medium text-[#2C332F]" data-testid="weekly-calendar-month">
            {currentYear}年{currentMonth}月
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleShiftWeek(-7)}
              className="h-8 w-8 rounded-full border border-[#E5E5E0] bg-white flex items-center justify-center text-[#5E6660]"
              data-testid="weekly-prev-week"
              aria-label="上一周"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleShiftWeek(7)}
              className="h-8 w-8 rounded-full border border-[#E5E5E0] bg-white flex items-center justify-center text-[#5E6660]"
              data-testid="weekly-next-week"
              aria-label="下一周"
            >
              <ChevronRight size={15} />
            </button>
            {showBackToToday ? (
              <button
                type="button"
                onClick={handleBackToToday}
                className="h-8 px-3 rounded-full border border-[#D7E8E0] bg-[#EEF7F2] text-[12px] text-[#2C332F]"
                data-testid="weekly-back-today"
              >
                今天
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1" data-testid="weekly-days-grid">
          {weekDateStrings.map((dateStr, idx) => {
            const dayNum = Number(dateStr.split('-')[2]);
            const isSelected = dateStr === currentDateStr;
            const isToday = dateStr === todaySydneyStr;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handlePickDate(dateStr)}
                className={`h-14 rounded-xl border text-center flex flex-col items-center justify-center transition-colors ${
                  isSelected
                    ? 'bg-[#2C332F] border-[#2C332F] text-white'
                    : isToday
                      ? 'bg-white border-[#6B8067] text-[#2C332F]'
                      : 'bg-white border-[#E5E5E0] text-[#5E6660]'
                }`}
                data-testid={`weekly-day-${idx + 1}`}
                aria-current={isSelected ? 'date' : undefined}
              >
                <span className={`text-[10px] ${isSelected ? 'text-white/85' : 'text-[#858C88]'}`}>{WEEKDAY_LABELS[idx]}</span>
                <span className="font-num text-[14px] leading-tight mt-0.5">{dayNum}</span>
                {!isSelected && isToday ? <span className="mt-0.5 h-1 w-1 rounded-full bg-[#6B8067]" /> : <span className="mt-0.5 h-1 w-1" />}
              </button>
            );
          })}
        </div>
      </section>

      <div className="px-5">
        <NutritionSummary totals={totals} plan={plan} layout="splitRows" />
      </div>

      <section className="mt-6 px-3">
        <div className="px-2 flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-medium text-[#2C332F] tracking-wide">今日时间轴</h2>
          <span className="text-[11px] text-[#858C88]">{sorted.length} 项</span>
        </div>

        <div className="relative timeline-guide before:hidden" data-testid="timeline">
          <div
            className="pointer-events-none absolute left-[73px] top-3 bottom-3 w-[1.5px]"
            style={{
              background: 'repeating-linear-gradient(to bottom, #D9D9D2 0, #D9D9D2 4px, transparent 4px, transparent 8px)',
            }}
            aria-hidden="true"
          />
          {displayTimelineItems.map((entry, index) => {
            if (entry.kind === 'now-marker') {
              return (
                <div
                  key={`now-marker-${currentDateStr}-${index}`}
                  className="grid grid-cols-[56px_18px_minmax(0,1fr)] gap-2 py-2.5"
                  data-testid="timeline-now-marker"
                >
                  <div className="font-num tabular-nums text-[12px] text-[#6B8067] text-right leading-6 pt-1 whitespace-nowrap">
                    {nowTimeLabel}
                  </div>

                  <div className="pt-3.5 flex justify-center">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center bg-[#EEF7F2] border-[1.5px] border-[#6B8067]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#6B8067]" />
                    </div>
                  </div>

                  <div className="min-w-0 pr-1 pt-3">
                    <div className="flex items-center gap-2 text-[#6B8067]" aria-hidden="true">
                      <span className="text-[12px] font-medium">现在</span>
                      <div className="h-[1.5px] flex-1 bg-[#6B8067]/55" />
                    </div>
                  </div>
                </div>
              );
            }

            const item = entry.item;

            return (
              <TimelineItem
                key={item.id}
                item={item}
                layout="home-time-left"
                onAddFood={handleAddFood}
                onDeleteFood={handleDeleteFood}
                onEditTime={(it) => setTimeSheet({ open: true, item: it })}
                onEditRecord={(it) => setEditActivitySheet({ open: true, item: it })}
                onDelete={handleDeleteClick}
                onEnd={handleEndTimelineItem}
                ending={endingItemId === item.id}
                deleting={deletingItemId === item.id}
                deletingFoodEntryKey={deletingFoodEntryKey}
                now={now}
              />
            );
          })}
        </div>

        <div className="px-2 mt-4">
          <button
            onClick={handleEndDay}
            disabled={endDayLoading}
            data-testid="end-day-btn"
            className={`w-full h-12 rounded-2xl text-[14px] flex items-center justify-center gap-2 transition-all ${
              endDayLoading
                ? 'bg-[#6B8067] border border-[#6B8067] text-white cursor-not-allowed'
                : 'bg-white border border-[#2C332F] text-[#2C332F] hover:bg-[#2C332F] hover:text-white'
            }`}
          >
            {endDayLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={1.8} />
                结束本日 · 进入下一日
              </>
            )}
          </button>
        </div>
      </section>

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pointer-events-none z-30">
        <div className="flex justify-end">
          <button
            ref={fabButtonRef}
            onClick={() => setFabOpen((v) => !v)}
            data-testid="fab-add"
            className="pointer-events-auto w-14 h-14 rounded-2xl bg-[#2C332F] text-white flex items-center justify-center shadow-[0_10px_24px_-8px_rgba(44,51,47,0.5)]"
          >
            <Plus size={22} strokeWidth={1.8} className={fabOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
          </button>
        </div>

        {fabOpen && (
          <div ref={addMenuRef} className="pointer-events-auto absolute bottom-16 right-5">
            <AddPickerMenu
              onSnack={handleOpenSnackSheet}
              onTraining={openTraining}
              onEvent={openEvent}
              testIdPrefix="picker"
            />
          </div>
        )}
      </div>

      <AddFoodSheet
        open={foodSheet.open}
        onOpenChange={(v) => setFoodSheet((s) => ({ ...s, open: v }))}
        targetTitle={foodSheet.target?.title || ''}
        onConfirm={handleFoodConfirm}
      />
      <AddSnackSheet
        open={snackSheetOpen}
        onOpenChange={setSnackSheetOpen}
        onConfirm={handleAddSnack}
      />
      <AddTrainingSheet
        open={trainingOpen}
        onOpenChange={setTrainingOpen}
        onConfirm={handleAddTraining}
        allowLiveStart={isViewingToday}
        onOpenPerfEvent={(eventName) => {
          const flowId = pendingOpenPerfRef.current?.type === 'training' ? pendingOpenPerfRef.current.flowId : null;
          if (!flowId) return;

          markCreatePerf(flowId, eventName);

          if (eventName === 'sheet_first_frame_rendered') {
            summarizeCreatePerfFlow(flowId);
            pendingOpenPerfRef.current = null;
          }
        }}
      />
      <AddEventSheet
        open={eventOpen}
        onOpenChange={setEventOpen}
        onConfirm={handleAddEvent}
        allowLiveStart={isViewingToday}
        onOpenPerfEvent={(eventName) => {
          const flowId = pendingOpenPerfRef.current?.type === 'event' ? pendingOpenPerfRef.current.flowId : null;
          if (!flowId) return;

          markCreatePerf(flowId, eventName);

          if (eventName === 'sheet_first_frame_rendered') {
            summarizeCreatePerfFlow(flowId);
            pendingOpenPerfRef.current = null;
          }
        }}
      />
      <EditTimeSheet
        open={timeSheet.open}
        onOpenChange={(v) => setTimeSheet((s) => ({ ...s, open: v }))}
        item={timeSheet.item}
        onConfirm={handleTimeConfirm}
      />

      <EditActivitySheet
        open={editActivitySheet.open}
        onOpenChange={(open) => setEditActivitySheet((prev) => ({ ...prev, open }))}
        item={editActivitySheet.item}
        onConfirm={handleEditActivityConfirm}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialogKind === 'food-entry' ? '确认删除食物' : '确认删除活动'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogKind === 'food-entry'
                ? `将从${pendingDeleteFood?.mealTitle || '该餐次'}中删除“${pendingDeleteFood?.foodName || '该食物'}”。如果这是该餐次最后一个食物，会同时删除该餐次记录。`
                : '确定删除这个活动吗？删除后无法恢复。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingItemId) || Boolean(deletingFoodEntryKey)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!deletingItemId && !deletingFoodEntryKey) handleConfirmDelete();
              }}
              disabled={Boolean(deletingItemId) || Boolean(deletingFoodEntryKey)}
              className="bg-[#D27D67] hover:bg-[#bf6e59]"
            >
              {deletingItemId || deletingFoodEntryKey ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
