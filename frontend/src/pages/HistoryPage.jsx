import React from 'react';
import { HISTORY, DAILY_PLAN } from '../mockData';
import { ChevronRight } from 'lucide-react';

export const HistoryPage = () => {
  return (
    <div className="pb-32">
      <header className="px-5 pt-6 pb-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">HISTORY</p>
        <h1 className="text-[22px] font-medium text-[#2C332F] mt-1">历史记录</h1>
        <p className="text-[12px] text-[#858C88] mt-1">回顾过去几天的摄入情况</p>
      </header>

      <div className="px-5 space-y-3" data-testid="history-list">
        {HISTORY.map((d, idx) => {
          const pct = Math.round((d.cal / DAILY_PLAN.calories) * 100);
          return (
            <button
              key={idx}
              data-testid={`history-item-${idx}`}
              className="w-full text-left rounded-2xl bg-white border border-[#E5E5E0] p-4 flex items-center justify-between"
            >
              <div className="min-w-0">
                <p className="text-[13.5px] text-[#2C332F]">{d.date}</p>
                <p className="font-num text-[11px] text-[#858C88] mt-1">
                  P{d.p}g · F{d.f}g · C{d.c}g
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="font-num text-[15px] font-medium text-[#2C332F]">
                    {d.cal} <span className="text-[10px] text-[#858C88] font-normal">kcal</span>
                  </p>
                  <p className="text-[10px] text-[#858C88] mt-0.5">
                    <span
                      className="font-num"
                      style={{ color: pct > 100 ? '#D27D67' : '#6B8067' }}
                    >
                      {pct}%
                    </span>{' '}
                    计划完成
                  </p>
                </div>
                <ChevronRight size={16} strokeWidth={1.5} className="text-[#858C88]" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 mx-5 rounded-2xl border border-dashed border-[#E5E5E0] p-6 text-center">
        <p className="text-[13px] text-[#858C88]">更多历史统计与趋势图正在赶来</p>
      </div>
    </div>
  );
};
