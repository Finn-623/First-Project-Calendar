import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { sumTimelineMacros } from '../mockData';

export const HistoryPage = () => {
  const { history, plan } = useStore();
  const navigate = useNavigate();

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
            <button
              key={d.dateStr}
              onClick={() => navigate(`/history/${d.dateStr}`)}
              data-testid={`history-item-${idx}`}
              className="w-full text-left rounded-2xl bg-white border border-[#E5E5E0] p-4 flex items-center justify-between hover:border-[#6B8067]/40"
            >
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
                <ChevronRight size={16} strokeWidth={1.5} className="text-[#858C88]" />
              </div>
            </button>
          );
        })}
        {history.length === 0 && (
          <p className="text-center text-sm text-[#858C88] py-10">暂无历史记录</p>
        )}
      </div>

      <div className="mt-8 mx-5 rounded-2xl border border-dashed border-[#E5E5E0] p-6 text-center">
        <p className="text-[13px] text-[#858C88]">按下今日的「结束本日」按钮，就会把当天归档到这里</p>
      </div>
    </div>
  );
};
