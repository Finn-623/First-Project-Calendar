import React, { useMemo, useState, useEffect } from 'react';
import { NutritionSummary } from '../components/NutritionSummary';
import { TimelineItem } from '../components/TimelineItem';
import { AddFoodSheet } from '../modals/AddFoodSheet';
import { AddTrainingSheet } from '../modals/AddTrainingSheet';
import { AddEventSheet } from '../modals/AddEventSheet';
import { EditTimeSheet } from '../modals/EditTimeSheet';
import { Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { sumTimelineMacros } from '../lib/nutrition';
import { createTimelineItem, ensureMealTimelineItem, deleteTimelineItemById, updateTimelineTime } from '../services/timelineService';
import { createFoodEntry, createFoodInLibrary, deleteFoodEntryById } from '../services/foodService';
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

const AddPickerMenu = ({ onSnack, onAnaerobic, onAerobic, onEvent, testIdPrefix = 'picker' }) => (
  <div className="w-56 rounded-2xl bg-white border border-[#E5E5E0] shadow-lg overflow-hidden" data-testid="add-picker">
    {[
      { label: '加餐', onClick: onSnack, testId: `${testIdPrefix}-snack` },
      { label: '无氧训练', onClick: onAnaerobic, testId: `${testIdPrefix}-anaerobic` },
      { label: '有氧训练', onClick: onAerobic, testId: `${testIdPrefix}-aerobic` },
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
  const { timeline, setTimeline, plan, dateLabel, dateStr, user, todayLoading, todayError, reloadToday, reloadPlan } = useStore();
  const [foodSheet, setFoodSheet] = useState({ open: false, target: null });
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [trainingKind, setTrainingKind] = useState('anaerobic');
  const [eventOpen, setEventOpen] = useState(false);
  const [timeSheet, setTimeSheet] = useState({ open: false, item: null });
  const [fabOpen, setFabOpen] = useState(false);
  const [topOpen, setTopOpen] = useState(false);
  const [savingFood, setSavingFood] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [deletingFoodId, setDeletingFoodId] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, type: null, item: null, food: null });

  useEffect(() => {
    reloadToday();
    reloadPlan();
  }, [dateStr, reloadPlan, reloadToday]);

  const sorted = useMemo(
    () => [...timeline].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)),
    [timeline],
  );

  const totals = useMemo(() => sumTimelineMacros(timeline), [timeline]);

  const handleAddFood = (mealItem) => setFoodSheet({ open: true, target: mealItem });

  const handleFoodConfirm = async ({ sourceFoodId, food, saveToLibrary, libraryPayload }) => {
    if (!user?.id || !foodSheet.target) {
      toast.error('请先登录后再操作');
      return false;
    }
    if (savingFood) return false;

    setSavingFood(true);
    try {
      let target = foodSheet.target;
      if (target.virtual) {
        target = await ensureMealTimelineItem({ userId: user.id, dateStr, subtype: target.subtype });
      }

      let finalSourceFoodId = sourceFoodId || null;
      if (saveToLibrary && libraryPayload && !sourceFoodId) {
        const createdFood = await createFoodInLibrary({ userId: user.id, food: libraryPayload });
        finalSourceFoodId = createdFood.id;
      }

      const savedFood = await createFoodEntry({
        userId: user.id,
        timelineItemId: target.id,
        sourceFoodId: finalSourceFoodId,
        food,
      });

      setTimeline((prev) => {
        const hasTarget = prev.some((item) => item.id === target.id);
        if (!hasTarget) {
          const next = prev.filter((item) => !(item.virtual && item.subtype === target.subtype));
          return [...next, { ...target, foods: [savedFood] }];
        }
        return prev.map((it) => (it.id === target.id ? { ...it, foods: [...(it.foods || []), savedFood], virtual: false } : it));
      });

      toast.success(`已添加 ${savedFood.name} 到 ${target.title}`);
      return true;
    } catch (e) {
      toast.error(e?.message || '添加食物失败');
      return false;
    } finally {
      setSavingFood(false);
    }
  };

  const handleAddSnack = async () => {
    if (!user?.id) {
      toast.error('请先登录');
      return;
    }
    if (creatingItem) return;
    setCreatingItem(true);
    try {
      const item = await createTimelineItem({
        userId: user.id,
        dateStr,
        type: 'meal',
        subtype: 'snack',
        title: '加餐',
        time: '15:30',
      });
      setTimeline((prev) => [...prev, { ...item, foods: [] }]);
      setFabOpen(false);
      setTopOpen(false);
      toast.success('已添加加餐');
    } catch (e) {
      toast.error(e?.message || '添加加餐失败');
    } finally {
      setCreatingItem(false);
    }
  };

  const openTraining = (kind) => {
    setTrainingKind(kind);
    setTrainingOpen(true);
    setFabOpen(false);
    setTopOpen(false);
  };
  const openEvent = () => { setEventOpen(true); setFabOpen(false); setTopOpen(false); };

  const handleAddTraining = async (item) => {
    if (!user?.id) {
      toast.error('请先登录');
      return;
    }
    if (creatingItem) return;
    setCreatingItem(true);
    try {
      const created = await createTimelineItem({
        userId: user.id,
        dateStr,
        type: item.type,
        title: item.title,
        time: item.time,
        detail: item.detail,
        caloriesBurned: item.caloriesBurned,
      });
      setTimeline((prev) => [...prev, created]);
      toast.success(`已添加 ${item.title}`);
    } catch (e) {
      toast.error(e?.message || '添加训练失败');
    } finally {
      setCreatingItem(false);
    }
  };

  const handleAddEvent = async (item) => {
    if (!user?.id) {
      toast.error('请先登录');
      return;
    }
    if (creatingItem) return;
    setCreatingItem(true);
    try {
      const created = await createTimelineItem({
        userId: user.id,
        dateStr,
        type: 'event',
        title: item.title,
        time: item.time,
        detail: item.detail,
      });
      setTimeline((prev) => [...prev, created]);
      toast.success(`已添加 ${item.title}`);
    } catch (e) {
      toast.error(e?.message || '添加事件失败');
    } finally {
      setCreatingItem(false);
    }
  };

  const handleTimeConfirm = async (newTime) => {
    if (!user?.id || !timeSheet.item) return;
    try {
      if (!timeSheet.item.virtual) {
        await updateTimelineTime({ itemId: timeSheet.item.id, userId: user.id, time: newTime });
      }
      setTimeline((prev) => prev.map((it) => (it.id === timeSheet.item.id ? { ...it, time: newTime } : it)));
      toast.success('时间已更新');
    } catch (e) {
      toast.error(e?.message || '更新时间失败');
    }
  };

  const requestDeleteFood = (item, food) => {
    setConfirmState({ open: true, type: 'food', item, food });
  };

  const requestDeleteItem = (item) => {
    setConfirmState({ open: true, type: 'item', item, food: null });
  };

  const handleDeleteConfirmed = async () => {
    if (!user?.id) {
      toast.error('请先登录');
      return;
    }
    if (confirmState.type === 'food' && confirmState.food) {
      const food = confirmState.food;
      const item = confirmState.item;
      if (!food.id) {
        toast.error('该记录缺少ID，无法删除');
        return;
      }
      setDeletingFoodId(food.id);
      try {
        await deleteFoodEntryById({ entryId: food.id, userId: user.id });
        setTimeline((prev) => prev.map((it) => (
          it.id === item.id
            ? { ...it, foods: (it.foods || []).filter((f) => f.id !== food.id) }
            : it
        )));
        toast.success('食物已删除');
      } catch (e) {
        toast.error(e?.message || '删除食物失败');
      } finally {
        setDeletingFoodId(null);
      }
    }

    if (confirmState.type === 'item' && confirmState.item) {
      const item = confirmState.item;
      setDeletingItemId(item.id);
      try {
        await deleteTimelineItemById({ itemId: item.id, userId: user.id });
        setTimeline((prev) => prev.filter((it) => it.id !== item.id));
        toast.success('项目已删除');
      } catch (e) {
        toast.error(e?.message || '删除项目失败');
      } finally {
        setDeletingItemId(null);
      }
    }

    setConfirmState({ open: false, type: null, item: null, food: null });
  };

  return (
    <div className="pb-32">
      <header className="px-5 pt-6 pb-4 relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">TODAY</p>
            <h1 className="text-[22px] font-medium text-[#2C332F] mt-1" data-testid="today-date">
              {dateLabel}
            </h1>
          </div>
          <button
            onClick={() => setTopOpen((v) => !v)}
            data-testid="top-add-btn"
            aria-label="添加"
            className="w-10 h-10 rounded-full bg-[#2C332F] text-white flex items-center justify-center shadow-[0_6px_16px_-6px_rgba(44,51,47,0.4)]"
          >
            <Plus size={18} strokeWidth={1.8} className={topOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
          </button>
        </div>

        {topOpen && (
          <div className="absolute right-5 top-16 z-30" data-testid="top-add-menu">
            <AddPickerMenu
              onSnack={handleAddSnack}
              onAnaerobic={() => openTraining('anaerobic')}
              onAerobic={() => openTraining('aerobic')}
              onEvent={openEvent}
              testIdPrefix="top-picker"
            />
          </div>
        )}
      </header>

      <div className="px-5">
        <NutritionSummary totals={totals} plan={plan} />
      </div>

      <section className="mt-6 px-3">
        <div className="px-2 flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-medium text-[#2C332F] tracking-wide">今日时间轴</h2>
          <span className="text-[11px] text-[#858C88]">{sorted.length} 项</span>
        </div>

        {todayLoading && <p className="px-2 py-10 text-center text-sm text-[#858C88]">加载中...</p>}
        {!todayLoading && !!todayError && <p className="px-2 py-10 text-center text-sm text-[#D27D67]">{todayError}</p>}
        {!todayLoading && !todayError && (
          <div className="relative timeline-guide" data-testid="timeline">
            {sorted.map((item) => (
              <TimelineItem
                key={item.id}
                item={item}
                onAddFood={handleAddFood}
                onEditTime={(it) => setTimeSheet({ open: true, item: it })}
                onDeleteFood={requestDeleteFood}
                onDeleteItem={requestDeleteItem}
                deletingFoodId={deletingFoodId}
                deletingItemId={deletingItemId}
              />
            ))}
          </div>
        )}

        <div className="px-2 mt-4">
          <button
            data-testid="end-day-btn"
            className="w-full h-12 rounded-2xl bg-white border border-[#2C332F] text-[#2C332F] text-[14px] flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
            disabled
          >
            <Check size={16} strokeWidth={1.8} />
            结束本日 · 进入下一日
          </button>
        </div>
      </section>

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pointer-events-none z-30">
        <div className="flex justify-end">
          <button
            onClick={() => setFabOpen((v) => !v)}
            data-testid="fab-add"
            className="pointer-events-auto w-14 h-14 rounded-2xl bg-[#2C332F] text-white flex items-center justify-center shadow-[0_10px_24px_-8px_rgba(44,51,47,0.5)]"
          >
            <Plus size={22} strokeWidth={1.8} className={fabOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
          </button>
        </div>

        {fabOpen && (
          <div className="pointer-events-auto absolute bottom-16 right-5">
            <AddPickerMenu
              onSnack={handleAddSnack}
              onAnaerobic={() => openTraining('anaerobic')}
              onAerobic={() => openTraining('aerobic')}
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
        loading={savingFood}
      />
      <AddTrainingSheet
        open={trainingOpen}
        onOpenChange={setTrainingOpen}
        onConfirm={handleAddTraining}
        initialKind={trainingKind}
      />
      <AddEventSheet
        open={eventOpen}
        onOpenChange={setEventOpen}
        onConfirm={handleAddEvent}
      />
      <EditTimeSheet
        open={timeSheet.open}
        onOpenChange={(v) => setTimeSheet((s) => ({ ...s, open: v }))}
        item={timeSheet.item}
        onConfirm={handleTimeConfirm}
      />

      <AlertDialog open={confirmState.open} onOpenChange={(open) => !open && setConfirmState({ open: false, type: null, item: null, food: null })}>
        <AlertDialogContent className="max-w-[90vw] rounded-2xl border-[#E5E5E0]">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState.type === 'food' ? '删除后该食物记录将从今日数据中移除。' : '删除后该时间轴项目及其关联食物将不可恢复。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirmed}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
