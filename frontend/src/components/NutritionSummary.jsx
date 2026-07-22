import React from 'react';
import { CircularProgress, MacroBar } from './CircularProgress';
import { Flame } from 'lucide-react';

export const NutritionSummary = ({ totals, plan }) => {
  const safePlan = plan || { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const calGap = safePlan.calories - totals.cal;

  return (
    <section
      className="rounded-3xl bg-white border border-[#E5E5E0] p-5 grain"
      data-testid="nutrition-summary"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#858C88]">今日摄入</p>
          <p className="text-sm text-[#2C332F] mt-0.5">
            {plan ? (
              <>距离目标还差 <span className="font-num font-medium" data-testid="cal-gap">{calGap > 0 ? calGap : 0}</span> kcal</>
            ) : '尚未设置目标'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[#6B8067]">
          <Flame size={16} strokeWidth={1.5} />
          <span className="text-xs">摄入 · 目标</span>
        </div>
      </div>

      <div className="flex items-center justify-center py-2">
        <CircularProgress
          value={totals.cal}
          max={safePlan.calories || 1}
          size={172}
          stroke={14}
          color="#6B8067"
          trackColor="#E5E5E0"
        >
          <span className="font-num text-4xl font-medium text-[#2C332F]" data-testid="total-calories">
            {totals.cal}
          </span>
          <span className="text-[11px] text-[#858C88] mt-1 tracking-widest">kcal</span>
          <span className="font-num text-[11px] text-[#858C88] mt-1">目标 {safePlan.calories || '--'}</span>
        </CircularProgress>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <MacroBar label="蛋白质" value={totals.p} max={safePlan.protein || 1} color="#6B8067" testId="macro-protein" />
        <MacroBar label="脂肪" value={totals.f} max={safePlan.fat || 1} color="#D27D67" testId="macro-fat" />
        <MacroBar label="碳水" value={totals.c} max={safePlan.carbs || 1} color="#E0B876" testId="macro-carbs" />
      </div>
    </section>
  );
};
