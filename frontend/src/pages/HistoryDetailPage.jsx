import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { showSuccess } from '../lib/notifications';
import { useStore } from '../store';
import { TimelineItem } from '../components/TimelineItem';
import { NutritionSummary } from '../components/NutritionSummary';
import { AddFoodSheet } from '../modals/AddFoodSheet';
import { EditTimeSheet } from '../modals/EditTimeSheet';
import { EditActivitySheet } from '../modals/EditActivitySheet';
import { historyService } from '../services/historyService';
import { timelineService } from '../services/timelineService';
import { sumTimelineMacros } from '../mockData';
import { diffSecondsBetween, formatClockTime, secondsToDurationMinutes } from '../lib/localDateTime';
import { useCurrentTime } from '../hooks/useCurrentTime';
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

const buildFoodEntryKey = (food, index) => {
  if (food?.entryId) return String(food.entryId);
  if (food?.id) return String(food.id);
  if (food?.foodEntryId) return String(food.foodEntryId);
  return `legacy-${index}-${food?.foodId || food?.name || 'food'}`;
};

const removeEmptyMeals = (timeline = []) => (timeline || []).filter((item) => {
  if (item?.type !== 'meal') return true;
  return Array.isArray(item?.foods) && item.foods.length > 0;
});

export const HistoryDetailPage = () => {
  const { dateStr } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { history, plan, user, loadHistory, resetDeletedDateState } = useStore();

  // 判断是否从设置来
  const isFromSettings = location.state?.returnTo === 'settings';
  const backPath = isFromSettings ? '/history' : '/history';
  const backLabel = isFromSettings ? '历史' : '历史';

  const entry = history.find((h) => h.dateStr === dateStr);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftTimeline, setDraftTimeline] = useState([]);
  const [savingAction, setSavingAction] = useState(false);
  const [foodSheet, setFoodSheet] = useState({ open: false, target: null });
  const [timeSheet, setTimeSheet] = useState({ open: false, item: null });
  const [endingItemId, setEndingItemId] = useState(null);
  const [editActivitySheet, setEditActivitySheet] = useState({ open: false, item: null });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState('timeline-item');
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [pendingDeleteFood, setPendingDeleteFood] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const now = useCurrentTime();

  useEffect(() => {
    if (!entry) return;

    setDraftTimeline(removeEmptyMeals(entry.timeline || []));
    setFoodSheet({ open: false, target: null });
    setTimeSheet({ open: false, item: null });
    setEditActivitySheet({ open: false, item: null });
    setConfirmOpen(false);
    setConfirmKind('timeline-item');
    setPendingDeleteItem(null);
    setPendingDeleteFood(null);
  }, [entry]);

  useEffect(() => {
    setIsEditMode(false);
  }, [dateStr]);

  const entryTimeline = useMemo(() => removeEmptyMeals(entry?.timeline || []), [entry]);
  const isEmptyDay = Boolean(entry?.isEmptyDay) && entryTimeline.length === 0;
  const activeTimeline = useMemo(() => removeEmptyMeals(draftTimeline), [draftTimeline]);
  const sorted = useMemo(
    () => [...activeTimeline].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)),
    [activeTimeline]
  );
  const totals = useMemo(
    () => (entry ? (entry.totals || sumTimelineMacros(activeTimeline)) : null),
    [activeTimeline, entry]
  );

  const hasOpenEditor = foodSheet.open || timeSheet.open || editActivitySheet.open;
  const interactionDisabled = savingAction || deleting;
  const timelineReadOnly = !isEditMode || interactionDisabled;

  const persistTimeline = async (nextTimeline, successMessage) => {
    if (!user?.id) return false;

    const cleaned = removeEmptyMeals(nextTimeline);
    const previousTimeline = draftTimeline;

    setSavingAction(true);
    setDraftTimeline(cleaned);

    try {
      const totalsToSave = sumTimelineMacros(cleaned);
      const { error } = await historyService.updateDayArchive(user.id, dateStr, cleaned, totalsToSave);
      if (error) {
        setDraftTimeline(previousTimeline);
        toast.error(error?.message || '保存失败，请稍后重试');
        return false;
      }

      await loadHistory(user.id);
      showSuccess(successMessage);
      return true;
    } finally {
      setSavingAction(false);
    }
  };

  const updateItem = (itemId, updater) => {
    const next = draftTimeline.map((item) => (item.id === itemId ? updater(item) : item));
    return removeEmptyMeals(next);
  };

  const handleAddFood = (mealItem) => {
    if (!isEditMode || interactionDisabled) return;
    setFoodSheet({ open: true, target: mealItem });
  };

  const handleFoodConfirm = async (food) => {
    if (!foodSheet.target) return;

    const nextTimeline = updateItem(foodSheet.target.id, (item) => ({
      ...item,
      foods: [...(item.foods || []), {
        ...food,
        entryId: food?.entryId || `food-entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }],
    }));

    await persistTimeline(nextTimeline, `已添加 ${food.name} 到 ${foodSheet.target.title}`);
  };

  const handleTimeConfirm = async (newTime) => {
    if (!timeSheet.item) return;

    const nextTimeline = updateItem(timeSheet.item.id, (item) => ({ ...item, time: newTime }));
    await persistTimeline(nextTimeline, '时间已更新');
  };

  const handleDeleteItem = (item) => {
    if (!isEditMode || interactionDisabled) return;
    setPendingDeleteItem(item);
    setPendingDeleteFood(null);
    setConfirmKind('timeline-item');
    setConfirmOpen(true);
  };

  const handleDeleteFood = (mealItem, food, foodIndex) => {
    if (!isEditMode || interactionDisabled) return;
    setPendingDeleteItem(mealItem);
    setPendingDeleteFood({
      mealItemId: mealItem.id,
      foodEntryId: buildFoodEntryKey(food, foodIndex),
      foodName: food?.name || '该食物',
      mealTitle: mealItem?.title || '该餐次',
    });
    setConfirmKind('food-entry');
    setConfirmOpen(true);
  };

  const handleEndItem = async (item) => {
    if (!user?.id || !item?.id || item.status !== 'running' || endingItemId) return;

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

      if (error) throw error;

      if (data) {
        const nextTimeline = draftTimeline.map((row) => (row.id === item.id ? data : row));
        const saved = await persistTimeline(nextTimeline, '记录已结束');
        if (!saved) {
          toast.error('结束后保存失败，请稍后重试');
        }
      }
    } catch (error) {
      toast.error(error?.message || '结束失败，请稍后重试');
    } finally {
      setEndingItemId(null);
    }
  };

  const mapItemTypeToUiType = (itemType) => {
    if (itemType === 'anaerobic_training') return 'anaerobic';
    if (itemType === 'aerobic_training') return 'aerobic';
    if (itemType === 'snack' || itemType === 'breakfast' || itemType === 'lunch' || itemType === 'dinner') return 'meal';
    return 'event';
  };

  const prepareDraftActivityUpdate = (item, updates) => {
    const next = {
      ...item,
      ...updates,
      details: updates?.details ? updates.details : item.details,
    };

    if (Object.prototype.hasOwnProperty.call(updates || {}, 'event_time')) {
      next.time = updates.event_time;
    }

    if (updates?.item_type) {
      next.type = mapItemTypeToUiType(updates.item_type);
    }

    if (next.details?.bodyParts) {
      next.bodyParts = next.details.bodyParts;
    }

    const touchedTime = Object.prototype.hasOwnProperty.call(updates || {}, 'started_at') || Object.prototype.hasOwnProperty.call(updates || {}, 'ended_at');
    if (touchedTime) {
      const startedAt = Object.prototype.hasOwnProperty.call(updates || {}, 'started_at') ? updates.started_at : item.started_at;
      const endedAt = Object.prototype.hasOwnProperty.call(updates || {}, 'ended_at') ? updates.ended_at : item.ended_at;

      if (!endedAt) {
        next.duration_minutes = null;
      } else {
        const seconds = diffSecondsBetween(new Date(startedAt), new Date(endedAt));
        next.duration_minutes = secondsToDurationMinutes(seconds);
      }
    }

    next.time = formatClockTime(next.event_time || next.started_at || next.time);

    if (Object.prototype.hasOwnProperty.call(updates || {}, 'notes')) {
      next.detail = updates.notes || '';
    }

    return next;
  };

  const handleEditActivityConfirm = async (item, updates) => {
    const nextTimeline = updateItem(item.id, (row) => prepareDraftActivityUpdate(row, updates));
    await persistTimeline(nextTimeline, '记录已更新');
  };

  const handleDeleteDay = () => {
    if (interactionDisabled || hasOpenEditor || confirmOpen) return;
    setPendingDeleteItem(null);
    setPendingDeleteFood(null);
    setConfirmKind('day');
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleting) return;
    if (!user?.id) {
      toast.error('无法确认当前用户，请重新登录后重试');
      return;
    }

    setDeleting(true);
    try {
      if (confirmKind === 'day') {
        const { error } = await historyService.deleteFullDayRecords(dateStr);
        if (error) {
          toast.error(error?.message || '删除失败，请稍后重试');
          return;
        }

        // 先清理本地状态源，避免刷新失败时恢复到已删除日期。
        resetDeletedDateState(dateStr);
        const historyResult = await loadHistory(user.id);

        setConfirmOpen(false);
        if (historyResult?.success === false) {
          toast.error('记录已删除，但历史列表刷新失败，请稍后重试');
        } else {
          showSuccess('历史记录已删除');
        }
        navigate('/history', {
          state: isFromSettings ? { returnTo: 'settings' } : { fallbackTo: 'settings' },
        });
        return;
      }

      if (confirmKind === 'food-entry') {
        if (!pendingDeleteFood?.mealItemId || !pendingDeleteFood?.foodEntryId) return;

        const nextTimeline = draftTimeline
          .map((item) => {
            if (item.id !== pendingDeleteFood.mealItemId) return item;

            const nextFoods = (item.foods || []).filter((food, index) => {
              const currentEntryKey = buildFoodEntryKey(food, index);
              return currentEntryKey !== pendingDeleteFood.foodEntryId;
            });

            if (nextFoods.length === 0) {
              return null;
            }

            return {
              ...item,
              foods: nextFoods,
            };
          })
          .filter(Boolean);

        const saved = await persistTimeline(nextTimeline, '食物记录已删除');
        if (saved) {
          setConfirmOpen(false);
          setPendingDeleteFood(null);
        }
        return;
      }

      if (!pendingDeleteItem) return;

      const nextTimeline = draftTimeline.filter((item) => item.id !== pendingDeleteItem.id);
      const saved = await persistTimeline(nextTimeline, '条目已删除');
      if (saved) {
        setConfirmOpen(false);
        setPendingDeleteItem(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  if (!entry) {
    return (
      <div className="px-5 pt-6 pb-32">
        <button
          type="button"
          onClick={() => navigate(-1)}
          data-testid="history-detail-back"
          className="flex items-center gap-1 text-[13px] text-[#858C88]"
        >
          <ChevronLeft size={16} strokeWidth={1.5} /> 返回
        </button>
        <p className="mt-10 text-center text-sm text-[#858C88]">未找到该日记录</p>
      </div>
    );
  }

  return (
    <div className="pb-32" data-testid="history-detail-page">
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={() => navigate('/history', {
              state: isFromSettings ? { returnTo: 'settings' } : { fallbackTo: 'settings' },
            })}
            data-testid="history-detail-back"
            className="flex items-center gap-1 text-[12px] text-[#858C88]"
          >
            <ChevronLeft size={14} strokeWidth={1.5} /> {backLabel}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeleteDay}
              className="h-8 px-3 rounded-full border border-[#E5E5E0] text-[12px] text-[#D27D67] disabled:opacity-60"
              data-testid="history-delete-day"
              aria-label={`删除${dateStr}整天记录`}
              disabled={interactionDisabled || hasOpenEditor || confirmOpen}
            >
              {deleting && confirmKind === 'day' ? '删除中...' : '删除整天记录'}
            </button>

            <button
              type="button"
              data-testid="history-detail-edit-mode-toggle"
              aria-label="编辑当前日期的历史记录"
              onClick={() => {
                if (isEditMode) {
                  setIsEditMode(false);
                } else {
                  setIsEditMode(true);
                }
              }}
              disabled={interactionDisabled || hasOpenEditor || confirmOpen}
              className="h-8 px-3 rounded-full border border-[#E5E5E0] text-[12px] text-[#2C332F] disabled:opacity-60"
            >
              {isEditMode ? '完成' : '编辑'}
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">DAY</p>
          <h1 className="text-[22px] font-medium text-[#2C332F] mt-1" data-testid="history-detail-date">
            {entry.dateLabel}
          </h1>
        </div>

      </header>

      {isEmptyDay ? (
        <section className="mt-4 px-5" data-testid="history-empty-day-state">
          <div className="rounded-2xl border border-dashed border-[#E5E5E0] bg-white p-6 text-center">
            <p className="text-[14px] text-[#2C332F]">本日无记录</p>
            <p className="mt-2 text-[12px] text-[#858C88]">该日期已结束，但没有摄入、训练或其他事件。</p>
          </div>
        </section>
      ) : (
        <>
          <div className="px-5">
            <NutritionSummary totals={totals} plan={plan} layout="splitRows" />
          </div>

          <section className="mt-6 px-3">
            <div className="px-2 flex items-center justify-between mb-2">
              <h2 className="text-[13px] font-medium text-[#2C332F] tracking-wide">时间轴回顾</h2>
              <span className="text-[11px] text-[#858C88]">{sorted.length} 项</span>
            </div>
            <div className="relative timeline-guide before:hidden" data-testid="history-detail-timeline">
              <div
                className="pointer-events-none absolute left-[73px] top-3 bottom-3 w-[1.5px]"
                style={{
                  background: 'repeating-linear-gradient(to bottom, #D9D9D2 0, #D9D9D2 4px, transparent 4px, transparent 8px)',
                }}
                aria-hidden="true"
              />
              {sorted.map((item) => (
                <TimelineItem
                  key={item.id}
                  item={item}
                  layout="home-time-left"
                  readOnly={timelineReadOnly}
                  allowMealDelete
                  onAddFood={handleAddFood}
                  onDeleteFood={handleDeleteFood}
                  onEditTime={(it) => setTimeSheet({ open: true, item: it })}
                  onEditRecord={(it) => setEditActivitySheet({ open: true, item: it })}
                  onDelete={handleDeleteItem}
                  onEnd={handleEndItem}
                  ending={endingItemId === item.id}
                  deleting={deleting && confirmKind !== 'day' && pendingDeleteItem?.id === item.id}
                  now={now}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <AddFoodSheet
        open={foodSheet.open}
        onOpenChange={(open) => setFoodSheet((prev) => ({ ...prev, open }))}
        targetTitle={foodSheet.target?.title || ''}
        onConfirm={handleFoodConfirm}
      />

      <EditTimeSheet
        open={timeSheet.open}
        onOpenChange={(open) => setTimeSheet((prev) => ({ ...prev, open }))}
        item={timeSheet.item}
        onConfirm={handleTimeConfirm}
      />

      <EditActivitySheet
        open={editActivitySheet.open}
        onOpenChange={(open) => setEditActivitySheet((prev) => ({ ...prev, open }))}
        item={editActivitySheet.item}
        onConfirm={handleEditActivityConfirm}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmKind === 'day' ? '删除整天记录？' : confirmKind === 'food-entry' ? '删除这个食物记录？' : '删除这个条目？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmKind === 'day'
                ? `确定删除${dateStr}的全部记录吗？当天的摄入、事件、训练和其他记录都会被删除，且无法撤销。`
                : confirmKind === 'food-entry'
                  ? `将从${pendingDeleteFood?.mealTitle || '该餐次'}中删除“${pendingDeleteFood?.foodName || '该食物'}”。如果这是该餐次最后一个食物，会同时删除该餐次记录。`
                  : '这个条目会从该日期的归档中移除。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={interactionDisabled}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (!interactionDisabled) handleConfirmDelete();
              }}
              disabled={interactionDisabled}
              className="bg-[#D27D67] text-white hover:bg-[#c86d56]"
            >
              {deleting ? '删除中...' : confirmKind === 'day' ? '删除整天记录' : confirmKind === 'food-entry' ? '删除食物' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
