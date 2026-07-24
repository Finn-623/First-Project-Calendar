import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Trash2, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { TimelineItem } from '../components/TimelineItem';
import { NutritionSummary } from '../components/NutritionSummary';
import { AddFoodSheet } from '../modals/AddFoodSheet';
import { EditTimeSheet } from '../modals/EditTimeSheet';
import { historyService } from '../services/historyService';
import { sumTimelineMacros } from '../mockData';
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

export const HistoryDetailPage = () => {
  const { dateStr } = useParams();
  const navigate = useNavigate();
  const { history, plan, user, loadHistory, loadCurrentUserData } = useStore();

  const entry = history.find((h) => h.dateStr === dateStr);
  const [draftTimeline, setDraftTimeline] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [foodSheet, setFoodSheet] = useState({ open: false, target: null });
  const [timeSheet, setTimeSheet] = useState({ open: false, item: null });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState('item');
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);

  useEffect(() => {
    if (!entry) return;

    setDraftTimeline(entry.timeline || []);
    setIsEditing(false);
    setFoodSheet({ open: false, target: null });
    setTimeSheet({ open: false, item: null });
    setConfirmOpen(false);
    setConfirmKind('item');
    setPendingDeleteItem(null);
  }, [entry]);

  const entryTimeline = useMemo(() => entry?.timeline || [], [entry]);
  const activeTimeline = useMemo(
    () => (isEditing ? draftTimeline : entryTimeline),
    [draftTimeline, entryTimeline, isEditing]
  );
  const sorted = useMemo(
    () => [...activeTimeline].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)),
    [activeTimeline]
  );
  const totals = useMemo(
    () => (entry ? (entry.totals || sumTimelineMacros(activeTimeline)) : null),
    [activeTimeline, entry]
  );

  const updateItem = (itemId, updater) => {
    setDraftTimeline((prev) => prev.map((item) => (item.id === itemId ? updater(item) : item)));
  };

  const handleAddFood = (mealItem) => {
    setFoodSheet({ open: true, target: mealItem });
  };

  const handleFoodConfirm = (food) => {
    if (!foodSheet.target) return;

    updateItem(foodSheet.target.id, (item) => ({
      ...item,
      foods: [...(item.foods || []), food],
    }));
    toast.success(`已添加 ${food.name} 到 ${foodSheet.target.title}`);
  };

  const handleTimeConfirm = (newTime) => {
    if (!timeSheet.item) return;

    updateItem(timeSheet.item.id, (item) => ({ ...item, time: newTime }));
    toast.success('时间已更新');
  };

  const handleDeleteItem = (item) => {
    setPendingDeleteItem(item);
    setConfirmKind('item');
    setConfirmOpen(true);
  };

  const handleDeleteDay = () => {
    setPendingDeleteItem(null);
    setConfirmKind('day');
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!user?.id) return;

    if (confirmKind === 'day') {
      setConfirmOpen(false);
      const { error } = await historyService.deleteDayArchive(user.id, dateStr);
      if (error) {
        toast.error('删除失败，请稍后重试');
        return;
      }

      await loadHistory(user.id);
      await loadCurrentUserData(user.id);
      toast.success('历史记录已删除');
      navigate('/');
      return;
    }

    if (!pendingDeleteItem) return;

    setDraftTimeline((prev) => prev.filter((item) => item.id !== pendingDeleteItem.id));
    setConfirmOpen(false);
    setPendingDeleteItem(null);
    toast.success('条目已删除');
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const totalsToSave = sumTimelineMacros(draftTimeline);
      const { error } = await historyService.updateDayArchive(user.id, dateStr, draftTimeline, totalsToSave);
      if (error) {
        toast.error('保存失败，请稍后重试');
        return;
      }

      await loadHistory(user.id);
      setIsEditing(false);
      toast.success('历史记录已保存');
    } finally {
      setSaving(false);
    }
  };

  if (!entry) {
    return (
      <div className="px-5 pt-6 pb-32">
        <button
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
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate('/history')}
            data-testid="history-detail-back"
            className="flex items-center gap-1 text-[12px] text-[#858C88]"
          >
            <ChevronLeft size={14} strokeWidth={1.5} /> 历史
          </button>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setDraftTimeline(entry.timeline || []);
                    setIsEditing(false);
                  }}
                  className="h-8 px-3 rounded-full border border-[#E5E5E0] text-[12px] text-[#858C88]"
                  data-testid="history-cancel-edit"
                >
                  <X size={13} className="inline-block mr-1" />
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="h-8 px-3 rounded-full bg-[#2C332F] text-white text-[12px] disabled:opacity-60"
                  data-testid="history-save-edit"
                >
                  <Check size={13} className="inline-block mr-1" />
                  保存
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="h-8 px-3 rounded-full border border-[#E5E5E0] text-[12px] text-[#2C332F]"
                  data-testid="history-start-edit"
                >
                  <Pencil size={13} className="inline-block mr-1" />
                  编辑
                </button>
                <button
                  onClick={handleDeleteDay}
                  className="h-8 px-3 rounded-full border border-[#E5E5E0] text-[12px] text-[#D27D67]"
                  data-testid="history-delete-day"
                >
                  <Trash2 size={13} className="inline-block mr-1" />
                  删除
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">DAY</p>
        <h1 className="text-[22px] font-medium text-[#2C332F] mt-1" data-testid="history-detail-date">
          {entry.dateLabel}
        </h1>

        {isEditing ? (
          <p className="mt-2 text-[12px] text-[#6B8067]">编辑中：可改时间、添加食物或删除条目，保存后会更新历史记录。</p>
        ) : null}
      </header>

      <div className="px-5">
        <NutritionSummary totals={totals} plan={plan} />
      </div>

      <section className="mt-6 px-3">
        <div className="px-2 flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-medium text-[#2C332F] tracking-wide">时间轴回顾</h2>
          <span className="text-[11px] text-[#858C88]">{sorted.length} 项</span>
        </div>
        <div className="relative timeline-guide" data-testid="history-detail-timeline">
          {sorted.map((item) => (
            <TimelineItem
              key={item.id}
              item={item}
              readOnly={!isEditing}
              onAddFood={handleAddFood}
              onEditTime={(it) => setTimeSheet({ open: true, item: it })}
              onDelete={handleDeleteItem}
            />
          ))}
        </div>
      </section>

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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmKind === 'day' ? '删除整条历史记录？' : '删除这个条目？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmKind === 'day'
                ? '这会永久删除该日期的归档记录，无法恢复。'
                : '这个条目会从该日期的归档中移除，保存后生效。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-[#D27D67] text-white hover:bg-[#c86d56]"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
