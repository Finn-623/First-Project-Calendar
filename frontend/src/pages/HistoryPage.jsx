import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckSquare, ChevronRight, Square, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { sumTimelineMacros } from '../mockData';
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

const formatDateRangeLabel = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

export const HistoryPage = () => {
  const { history, plan, setHistory, recordingDateStr, resetDeletedDateState } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isBatchDeleteMode, setIsBatchDeleteMode] = useState(false);
  const [selectedDateKeys, setSelectedDateKeys] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 判断是否从设置进来
  const isFromSettings = location.state?.returnTo === 'settings';

  const selectedSet = useMemo(() => new Set(selectedDateKeys), [selectedDateKeys]);
  const selectedCount = selectedDateKeys.length;
  const allSelectableDateKeys = useMemo(
    () => history.map((item) => item.dateStr).filter(Boolean),
    [history]
  );
  const allSelected = allSelectableDateKeys.length > 0 && selectedCount === allSelectableDateKeys.length;

  const selectedEntries = useMemo(
    () => history.filter((item) => selectedSet.has(item.dateStr)),
    [history, selectedSet]
  );

  const sortedSelectedDateKeys = useMemo(
    () => [...selectedDateKeys].sort((a, b) => String(a).localeCompare(String(b))),
    [selectedDateKeys]
  );

  const selectedRange = useMemo(() => {
    if (sortedSelectedDateKeys.length === 0) return null;
    return {
      start: sortedSelectedDateKeys[0],
      end: sortedSelectedDateKeys[sortedSelectedDateKeys.length - 1],
    };
  }, [sortedSelectedDateKeys]);

  const exitBatchMode = () => {
    if (deleting) return;
    setIsBatchDeleteMode(false);
    setSelectedDateKeys([]);
    setConfirmOpen(false);
  };

  const toggleDateSelection = (dateStr) => {
    if (deleting) return;
    setSelectedDateKeys((prev) => {
      if (prev.includes(dateStr)) {
        return prev.filter((item) => item !== dateStr);
      }
      return [...prev, dateStr];
    });
  };

  const handleToggleSelectAll = () => {
    if (deleting) return;
    if (allSelected) {
      setSelectedDateKeys([]);
      return;
    }
    setSelectedDateKeys(allSelectableDateKeys);
  };

  const handleBatchDelete = async () => {
    if (selectedDateKeys.length === 0 || deleting) return;

    setDeleting(true);
    try {
      const { error } = await historyService.deleteHistoryDays(selectedDateKeys);
      if (error) {
        toast.error(error?.message || '删除失败，请稍后重试');
        return;
      }

      const selectedLookup = new Set(selectedDateKeys);
      setHistory((prev) => prev.filter((item) => !selectedLookup.has(item.dateStr)));

      // 如果被删除的日期中包含当前查看的日期，重置状态为真实的今天
      if (selectedLookup.has(recordingDateStr)) {
        resetDeletedDateState(recordingDateStr);
      }

      setConfirmOpen(false);
      setSelectedDateKeys([]);
      setIsBatchDeleteMode(false);
      toast.success(`已删除 ${selectedLookup.size} 天历史记录`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="pb-32">
      <header className="px-5 pt-6 pb-4">
        {isFromSettings ? (
          <div className="flex items-center justify-between gap-3 mb-4">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              aria-label="返回设置"
              className="min-h-11 px-2 -ml-2 rounded-lg text-[13px] text-[#6B8067] hover:bg-[#EEF2EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8067]/40 inline-flex items-center gap-1.5"
            >
              <ArrowLeft size={16} />
              返回设置
            </button>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {!isFromSettings ? <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">HISTORY</p> : null}
            <h1 className={`text-[22px] font-medium text-[#2C332F] ${!isFromSettings ? 'mt-1' : ''}`}>历史记录</h1>
            <p className="text-[12px] text-[#858C88] mt-1">
              {isBatchDeleteMode ? '选择一个或多个日期后可批量删除' : '点击任意一天回看完整时间轴'}
            </p>
          </div>

          {!isBatchDeleteMode ? (
            <button
              type="button"
              onClick={() => setIsBatchDeleteMode(true)}
              aria-label="批量删除历史记录"
              data-testid="history-batch-delete-toggle"
              className="shrink-0 h-9 px-3 rounded-full border border-[#E5E5E0] bg-white text-[12px] text-[#D27D67] flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              批量删除
            </button>
          ) : (
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={exitBatchMode}
                disabled={deleting}
                className="h-9 px-3 rounded-full border border-[#E5E5E0] bg-white text-[12px] text-[#858C88] disabled:opacity-60"
                data-testid="history-batch-cancel"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                disabled={deleting || allSelectableDateKeys.length === 0}
                className="h-9 px-3 rounded-full border border-[#E5E5E0] bg-white text-[12px] text-[#2C332F] disabled:opacity-60"
                data-testid="history-batch-select-all"
              >
                {allSelected ? '取消全选' : '全选'}
              </button>
            </div>
          )}
        </div>
      </header>

      {isBatchDeleteMode && (
        <section className="px-5 pb-2" data-testid="history-batch-toolbar">
          <div className="rounded-2xl border border-[#E5E5E0] bg-white p-3.5 flex items-center justify-between gap-3">
            <p className="text-[12px] text-[#2C332F]">
              已选择 <span className="font-num font-medium">{selectedCount}</span> 天
            </p>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={selectedCount === 0 || deleting}
              className="h-9 px-3 rounded-xl bg-[#D27D67] text-white text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="history-batch-delete-selected"
            >
              {selectedCount <= 1 ? '删除 1 天记录' : `删除 ${selectedCount} 天记录`}
            </button>
          </div>
        </section>
      )}

      <div className="px-5 space-y-3" data-testid="history-list">
        {history.map((d, idx) => {
          const t = d.totals || sumTimelineMacros(d.timeline || []);
          const pct = plan?.calories ? Math.round((t.cal / plan.calories) * 100) : 0;
          const isEmptyDay = d.isEmptyDay === true;
          const checked = selectedSet.has(d.dateStr);

          const handleClick = () => {
            if (isBatchDeleteMode) {
              toggleDateSelection(d.dateStr);
              return;
            }

            navigate(`/history/${d.dateStr}`);
          };

          return (
            <div
              key={d.dateStr}
              onClick={handleClick}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleClick();
                }
              }}
              role="button"
              tabIndex={0}
              data-testid={`history-item-${idx}`}
              className={`w-full text-left rounded-2xl bg-white border p-4 flex items-center justify-between ${
                checked ? 'border-[#6B8067] bg-[#F2F7F1]' : 'border-[#E5E5E0] hover:border-[#6B8067]/40'
              }`}
            >
              <div className="min-w-0 flex items-center gap-3">
                {isBatchDeleteMode ? (
                  checked ? (
                    <CheckSquare size={18} className="text-[#6B8067] shrink-0" aria-hidden="true" />
                  ) : (
                    <Square size={18} className="text-[#858C88] shrink-0" aria-hidden="true" />
                  )
                ) : null}

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
                {!isBatchDeleteMode ? <ChevronRight size={16} strokeWidth={1.5} className="text-[#858C88]" /> : null}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>批量删除历史记录？</AlertDialogTitle>
            <AlertDialogDescription>
              {`确定删除所选的 ${selectedCount} 天历史记录吗？这些日期中的摄入、事件、训练和其他记录都会被删除，此操作无法撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedEntries.length > 0 ? (
            <div className="rounded-xl border border-[#EFEFEA] bg-[#F8F9F7] p-3 text-[12px] text-[#5E6660]">
              {selectedEntries.length <= 4 ? (
                <div className="space-y-1" data-testid="history-batch-selected-dates-list">
                  {selectedEntries.map((entry) => (
                    <p key={entry.dateStr}>{`- ${entry.dateLabel}`}</p>
                  ))}
                </div>
              ) : (
                <div className="space-y-1" data-testid="history-batch-selected-dates-range">
                  <p>{`选择数量：${selectedCount} 天`}</p>
                  <p>{`最早日期：${formatDateRangeLabel(selectedRange?.start || '')}`}</p>
                  <p>{`最晚日期：${formatDateRangeLabel(selectedRange?.end || '')}`}</p>
                </div>
              )}
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (!deleting) handleBatchDelete();
              }}
              disabled={deleting || selectedCount === 0}
              className="bg-[#D27D67] text-white hover:bg-[#c86d56]"
              data-testid="history-batch-confirm-delete"
            >
              {deleting ? '删除中...' : '删除所选记录'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
