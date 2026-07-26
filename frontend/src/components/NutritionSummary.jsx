import React from 'react';
import { Flame, Drumstick, Droplets, Wheat } from 'lucide-react';

const Item = ({ icon: Icon, label, value, unit, color }) => (
  <div className="rounded-2xl bg-white border border-[#E5E5E0] p-3.5">
    <div className="flex items-center gap-2 text-[#858C88] text-[11px]">
      <Icon size={14} strokeWidth={1.6} style={{ color }} />
      <span>{label}</span>
    </div>
    <div className="mt-2 flex items-end gap-1">
      <span className="font-num text-[22px] leading-none text-[#2C332F]" data-testid={`sum-${label}`}>
        {value}
      </span>
      <span className="text-[11px] text-[#858C88] mb-0.5">{unit}</span>
    </div>
  </div>
);

const safePlan = (plan) => {
  if (!plan) return null;
  return {
    calories: Number(plan.calories) || 0,
    protein: Number(plan.protein) || 0,
    fat: Number(plan.fat) || 0,
    carbs: Number(plan.carbs) || 0,
  };
};

export const NutritionSummary = ({ totals, plan, layout = 'default' }) => {
  const normalizedPlan = safePlan(plan);
  const pct = normalizedPlan && normalizedPlan.calories > 0
    ? Math.round((totals.cal / normalizedPlan.calories) * 100)
    : 0;

  const nutrientFields = [
    {
      key: 'calories',
      label: '热量',
      currentValue: totals.cal,
      targetValue: normalizedPlan ? normalizedPlan.calories : '--',
      unit: 'kcal',
    },
    {
      key: 'protein',
      label: '蛋白质',
      currentValue: totals.p,
      targetValue: normalizedPlan ? normalizedPlan.protein : '--',
      unit: 'g',
    },
    {
      key: 'fat',
      label: '脂肪',
      currentValue: totals.f,
      targetValue: normalizedPlan ? normalizedPlan.fat : '--',
      unit: 'g',
    },
    {
      key: 'carbs',
      label: '碳水',
      currentValue: totals.c,
      targetValue: normalizedPlan ? normalizedPlan.carbs : '--',
      unit: 'g',
    },
  ];

  if (layout === 'splitRows') {
    return (
      <section className="rounded-3xl bg-[#EFF2ED] border border-[#E1E6DE] p-4" data-testid="nutrition-summary">
        <div className="grid grid-cols-[3.8rem_repeat(4,minmax(0,1fr))] gap-1.5 items-stretch" data-testid="sum-current-row">
          <div className="text-[11px] text-[#5E6660] font-medium flex items-center justify-start pl-0.5">今日摄入</div>
          {nutrientFields.map((field) => (
            <div key={field.key} className="rounded-xl bg-white border border-[#E5E5E0] px-1.5 py-2 text-center">
              <div className="text-[10px] leading-tight text-[#858C88]">{field.label}</div>
              <div className="mt-1 text-[12px] leading-none text-[#2C332F] font-num whitespace-nowrap">
                <span data-testid={field.key === 'calories' ? 'sum-cal' : `sum-current-${field.key}`}>{field.currentValue}</span>
                <span className="text-[10px] text-[#858C88] font-normal"> {field.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-[3.8rem_repeat(4,minmax(0,1fr))] items-center gap-1 text-[10.5px] text-[#5E6660]" data-testid="sum-target-row">
          <span className="font-medium pl-0.5 whitespace-nowrap">目标</span>
          <span className="whitespace-nowrap">热量 <span className="font-num" data-testid="sum-target-calories">{nutrientFields[0].targetValue}</span> kcal</span>
          <span className="whitespace-nowrap">蛋白 <span className="font-num" data-testid="sum-target-protein">{nutrientFields[1].targetValue}</span> g</span>
          <span className="whitespace-nowrap">脂肪 <span className="font-num" data-testid="sum-target-fat">{nutrientFields[2].targetValue}</span> g</span>
          <span className="whitespace-nowrap">碳水 <span className="font-num" data-testid="sum-target-carbs">{nutrientFields[3].targetValue}</span> g</span>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-[#EFF2ED] border border-[#E1E6DE] p-4" data-testid="nutrition-summary">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#7E867F]">今日摄入</p>
          <div className="mt-1 flex items-end gap-1.5">
            <span className="font-num text-[30px] leading-none text-[#2C332F]" data-testid="sum-cal">
              {totals.cal}
            </span>
            <span className="text-[11px] text-[#7E867F] mb-1">kcal</span>
          </div>
          {normalizedPlan ? (
            <p className="text-[11px] text-[#7E867F] mt-1" data-testid="sum-progress">
              目标 {normalizedPlan.calories} kcal · 完成 <span className="font-num">{pct}%</span>
            </p>
          ) : (
            <p className="text-[11px] text-[#7E867F] mt-1" data-testid="sum-progress">
              尚未设置目标
            </p>
          )}
        </div>

        <div className="h-16 w-16 rounded-2xl bg-white/70 border border-[#DCE3D8] flex items-center justify-center">
          <Flame size={24} strokeWidth={1.8} color="#6B8067" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Item icon={Drumstick} label="蛋白质" value={totals.p} unit="g" color="#6B8067" />
        <Item icon={Droplets} label="脂肪" value={totals.f} unit="g" color="#D27D67" />
        <Item icon={Wheat} label="碳水" value={totals.c} unit="g" color="#E0B876" />
      </div>
    </section>
  );
};
