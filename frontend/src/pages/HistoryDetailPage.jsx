import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useStore } from '../store';
import { TimelineItem } from '../components/TimelineItem';
import { NutritionSummary } from '../components/NutritionSummary';
import { sumTimelineMacros } from '../lib/nutrition';

const timeToMinutes = (t) => {
  if (!t) return 24 * 60;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const HistoryDetailPage = () => {
  const { dateStr } = useParams();
  const navigate = useNavigate();
  const { history, plan } = useStore();

  const entry = history.find((h) => h.dateStr === dateStr);

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

  const sorted = [...entry.timeline].sort(
    (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
  );
  const totals = entry.totals || sumTimelineMacros(entry.timeline);

  return (
    <div className="pb-32" data-testid="history-detail-page">
      <header className="px-5 pt-6 pb-4">
        <button
          onClick={() => navigate('/history')}
          data-testid="history-detail-back"
          className="flex items-center gap-1 text-[12px] text-[#858C88] mb-2"
        >
          <ChevronLeft size={14} strokeWidth={1.5} /> 历史
        </button>
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">DAY</p>
        <h1 className="text-[22px] font-medium text-[#2C332F] mt-1" data-testid="history-detail-date">
          {entry.dateLabel}
        </h1>
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
            <TimelineItem key={item.id} item={item} readOnly />
          ))}
        </div>
      </section>
    </div>
  );
};
