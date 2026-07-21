import React, { createContext, useContext, useState, useCallback } from 'react';
import { TODAY_TIMELINE_INIT, DAILY_PLAN, SEED_HISTORY, sumTimelineMacros } from './mockData';

const StoreContext = createContext(null);

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const formatDateLabel = (d) => `${d.getMonth() + 1}月${d.getDate()}日 · ${weekdays[d.getDay()]}`;
export const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const freshTimeline = () => ([
  { id: `m1-${Date.now()}`, type: 'meal', subtype: 'breakfast', title: '早餐', time: '08:00', fixed: true, foods: [] },
  { id: `m2-${Date.now() + 1}`, type: 'meal', subtype: 'lunch', title: '午餐', time: '12:30', fixed: true, foods: [] },
  { id: `m3-${Date.now() + 2}`, type: 'meal', subtype: 'dinner', title: '晚餐', time: '19:00', fixed: true, foods: [] },
]);

export const StoreProvider = ({ children }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeline, setTimeline] = useState(TODAY_TIMELINE_INIT);
  const [plan, setPlan] = useState(DAILY_PLAN);
  const [history, setHistory] = useState(SEED_HISTORY);

  const endDay = useCallback(() => {
    const totals = sumTimelineMacros(timeline);
    const entry = {
      dateStr: toDateStr(currentDate),
      dateLabel: formatDateLabel(currentDate),
      timeline,
      totals,
    };
    setHistory((prev) => [entry, ...prev.filter((h) => h.dateStr !== entry.dateStr)]);
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
    setTimeline(freshTimeline());
  }, [currentDate, timeline]);

  const value = {
    currentDate,
    dateLabel: formatDateLabel(currentDate),
    timeline,
    setTimeline,
    plan,
    setPlan,
    history,
    endDay,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};
