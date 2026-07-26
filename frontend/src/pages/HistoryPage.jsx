import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { sumTimelineMacros } from '../mockData';
import { toast } from 'sonner';
import { historyService } from '../services/historyService';
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

export const HistoryPage = () => {
  const { history, plan, user, setHistory } = useStore();
  const navigate = useNavigate();
  const [pendingDeleteDate, setPendingDeleteDate] = React.useState(null);
  const [deletingDate, setDeletingDate] = React.useState('');

  const handleClickDeleteDate = (event, dateEntry) => {
    event.preventDefault();
    event.stopPropagation();
    setPendingDeleteDate(dateEntry);
  };

  const handleConfirmDeleteDate = async () => {
    if (!user?.id || !pendingDeleteDate?.dateStr) return;
    if (deletingDate) return;

    const targetDateStr = pendingDeleteDate.dateStr;

    try {
      setDeletingDate(targetDateStr);
      const { error } = await historyService.deleteFullDayRecords(targetDateStr);
      if (error) {
        toast.error('删除失败，请稍后重试');
        return;
      }

      setHistory((prev) => prev.filter((item) => item.dateStr !== targetDateStr));
      toast.success('已删除该日期全部记录');
      setPendingDeleteDate(null);
    } finally {
      setDeletingDate('');
    }
  };

  return (
    <div className="pb-32">
      <header className="px-5 pt-6 pb-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">HISTORY</p>
        <h1 className="text-[22px] font-medium text-[#2C332F] mt-1">历史记录</h1>
        <p className="text-[12px] text-[#858C88] mt-1">点击任意一天回看完整时间轴</p>
      </header>

      <div className="px-5 space-y-3" data-testid="history-list">
        {history.map((d, idx) => {
          const t = d.totals || sumTimelineMacros(d.timeline || []);
          const pct = plan?.calories ? Math.round((t.cal / plan.calories) * 100) : 0;
          const isEmptyDay = d.isEmptyDay === true;
          return (
            <div
              key={d.dateStr}
              onClick={() => navigate(`/history/${d.dateStr}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/history/${d.dateStr}`);
                }
              }}
              role="button"
              tabIndex={0}
              data-testid={`history-item-${idx}`}
              className="relative w-full text-left rounded-2xl bg-white border border-[#E5E5E0] p-4 flex items-center justify-between hover:border-[#6B8067]/40"
            >
              <button
                type="button"
                onClick={(event) => handleClickDeleteDate(event, d)}
                aria-label={`删除${d.dateStr}全部记录`}
                data-testid={`history-delete-date-${idx}`}
                className="absolute right-3 top-3 h-8 w-8 rounded-xl border border-[#E5E5E0] text-[#858C88] hover:text-[#D27D67] hover:border-[#D27D67]/40 flex items-center justify-center"
              >
                <Trash2 size={14} />
              </button>

              <div className="min-w-0">
                <p className="text-[13.5px] text-[#2C332F]">{d.dateLabel}</p>
                {isEmptyDay ? (
                  <p className="text-[12px] text-[#858C88] mt-1">本日无记录</p>
                ) : (
                  <p className="font-num text-[11px] text-[#858C88] mt-1">
                    P{t.p}g · F{t.f}g · C{t.c}g
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isEmptyDay ? null : (
                  <div className="text-right">
                    <p className="font-num text-[15px] font-medium text-[#2C332F]">
                      {t.cal} <span className="text-[10px] text-[#858C88] font-normal">kcal</span>
                    </p>
                    <p className="text-[10px] text-[#858C88] mt-0.5">
                      <span className="font-num" style={{ color: pct > 100 ? '#D27D67' : '#6B8067' }}>
                        {pct}%
                      </span>{' '}
                      计划完成
                    </p>
                  </div>
                )}
                <ChevronRight size={16} strokeWidth={1.5} className="text-[#858C88] mt-5" />
              </div>
            </div>
          );
        })}
        {history.length === 0 && (
          <p className="text-center text-sm text-[#858C88] py-10">暂无历史记录</p>
        )}
      </div>

      <div className="mt-8 mx-5 rounded-2xl border border-dashed border-[#E5E5E0] p-6 text-center">
        <p className="text-[13px] text-[#858C88]">按下今日的「结束本日」按钮，就会把当天归档到这里</p>
      </div>

      <AlertDialog open={Boolean(pendingDeleteDate)} onOpenChange={(open) => {
        if (!open && !deletingDate) {
          setPendingDeleteDate(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除整天记录？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteDate
                ? `确定删除${pendingDeleteDate.dateStr}的全部记录吗？此操作会删除当天所有摄入、事件、训练和其他记录，且无法撤销。`
                : '确定删除这一天的全部记录吗？'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingDate)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteDate}
              disabled={Boolean(deletingDate)}
              className="bg-[#D27D67] text-white hover:bg-[#c86d56]"
            >
              {deletingDate ? '删除中...' : '删除整天记录'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
