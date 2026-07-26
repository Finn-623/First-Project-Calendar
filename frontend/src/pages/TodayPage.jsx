import React, { useMemo, useState } from 'react';
import { NutritionSummary } from '../components/NutritionSummary';
import { TimelineItem } from '../components/TimelineItem';
import { AddFoodSheet } from '../modals/AddFoodSheet';
import { AddTrainingSheet } from '../modals/AddTrainingSheet';
import { AddEventSheet } from '../modals/AddEventSheet';
import { EditTimeSheet } from '../modals/EditTimeSheet';
import { sumTimelineMacros } from '../mockData';
import { Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { timelineService } from '../services/timelineService';
import { getSydneyDateString } from '../services/historyService';
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
  const { timeline, setTimeline, plan, dateLabel, endDay, dayInitialized, currentDate } = useStore();
  const [foodSheet, setFoodSheet] = useState({ open: false, target: null });
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [trainingKind, setTrainingKind] = useState('anaerobic');
  const [eventOpen, setEventOpen] = useState(false);
  const [timeSheet, setTimeSheet] = useState({ open: false, item: null });
  const [fabOpen, setFabOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null);

  const sorted = useMemo(
    () => [...timeline].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)),
    [timeline]
  );

  const currentDateStr = useMemo(() => getSydneyDateString(currentDate), [currentDate]);
  const todaySydneyStr = useMemo(() => getSydneyDateString(), []);
  const isAutoAdvancedDay = currentDateStr !== todaySydneyStr;

  const totals = useMemo(() => sumTimelineMacros(timeline), [timeline]);

  const handleAddFood = (mealItem) => setFoodSheet({ open: true, target: mealItem });

  const handleFoodConfirm = (food) => {
    setTimeline(
      timeline.map((it) =>
        it.id === foodSheet.target.id ? { ...it, foods: [...(it.foods || []), food] } : it
      )
    );
    toast.success(`已添加 ${food.name} 到 ${foodSheet.target.title}`);
  };

  const handleAddSnack = () => {
    const id = `s${Date.now()}`;
    setTimeline([
      ...timeline,
      { id, type: 'meal', subtype: 'snack', title: '加餐', time: '15:30', fixed: false, foods: [] },
    ]);
    setFabOpen(false);
    toast.success('已添加加餐');
  };

  const openTraining = (kind) => {
    setTrainingKind(kind);
    setTrainingOpen(true);
    setFabOpen(false);
  };
  const openEvent = () => { setEventOpen(true); setFabOpen(false); };

  const handleAddTraining = (item) => {
    setTimeline([...timeline, item]);
    toast.success(`已添加 ${item.title}`);
  };

  const handleAddEvent = (item) => {
    setTimeline([...timeline, item]);
    toast.success(`已添加 ${item.title}`);
  };

  const handleTimeConfirm = (newTime) => {
    setTimeline(timeline.map((it) => (it.id === timeSheet.item.id ? { ...it, time: newTime } : it)));
    toast.success('时间已更新');
  };

  const handleDeleteClick = (item) => {
    setPendingDeleteItem(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteItem) return;

    const item = pendingDeleteItem;
    setDeletingItemId(item.id);

    const isLikelySupabaseUuid = typeof item.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id);

    if (isLikelySupabaseUuid) {
      const { error } = await timelineService.deleteTimelineItem(item.id);
      if (error) {
        toast.error('删除失败，请稍后重试');
        setDeletingItemId(null);
        setDeleteDialogOpen(false);
        setPendingDeleteItem(null);
        return;
      }
    }

    setTimeline((prev) => prev.filter((it) => it.id !== item.id));
    toast.success('活动已删除');

    setDeletingItemId(null);
    setDeleteDialogOpen(false);
    setPendingDeleteItem(null);
  };

  const handleEndDay = () => {
    Promise.resolve(endDay()).then((result) => {
      if (result?.success || result?.skipped) {
        if (result?.success) {
          toast.success('本日已归档，开启新的一天');
        }
        return;
      }

      toast.error(result?.error?.message || '归档失败，请稍后重试');
    });
  };

  return (
    <div className="pb-32">
      {!dayInitialized ? (
        <div className="px-5 pt-10 text-[13px] text-[#858C88]">正在同步今日日期...</div>
      ) : null}
      {dayInitialized && isAutoAdvancedDay ? (
        <div className="mx-5 mt-5 rounded-2xl border border-[#D7E8E0] bg-[#EEF7F2] px-4 py-3 text-[#2C332F]">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#6D8376]">NEXT DAY</div>
          <div className="mt-1 text-[13px] leading-5">
            前一天已结束，当前正在记录下一日。
          </div>
        </div>
      ) : null}
      <header className="px-5 pt-6 pb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">TODAY</p>
          <h1 className="text-[22px] font-medium text-[#2C332F] mt-1" data-testid="today-date">
            {dateLabel}
          </h1>
        </div>
      </header>

      <div className="px-5">
        <NutritionSummary totals={totals} plan={plan} layout="splitRows" />
      </div>

      <section className="mt-6 px-3">
        <div className="px-2 flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-medium text-[#2C332F] tracking-wide">今日时间轴</h2>
          <span className="text-[11px] text-[#858C88]">{sorted.length} 项</span>
        </div>

        <div className="relative timeline-guide" data-testid="timeline">
          {sorted.map((item) => (
            <TimelineItem
              key={item.id}
              item={item}
              onAddFood={handleAddFood}
              onEditTime={(it) => setTimeSheet({ open: true, item: it })}
              onDelete={handleDeleteClick}
              deleting={deletingItemId === item.id}
            />
          ))}
        </div>

        <div className="px-2 mt-4">
          <button
            onClick={handleEndDay}
            data-testid="end-day-btn"
            className="w-full h-12 rounded-2xl bg-white border border-[#2C332F] text-[#2C332F] text-[14px] flex items-center justify-center gap-2 hover:bg-[#2C332F] hover:text-white"
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除活动</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除这个活动吗？删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingItemId)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!deletingItemId) handleConfirmDelete();
              }}
              disabled={Boolean(deletingItemId)}
              className="bg-[#D27D67] hover:bg-[#bf6e59]"
            >
              {deletingItemId ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
