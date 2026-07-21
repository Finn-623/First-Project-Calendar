import React, { useState, useEffect } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useStore } from '../store';

const FIELDS = [
  { key: 'calories', label: '目标热量', unit: 'kcal', color: '#2C332F' },
  { key: 'protein', label: '蛋白质', unit: 'g', color: '#6B8067' },
  { key: 'fat', label: '脂肪', unit: 'g', color: '#D27D67' },
  { key: 'carbs', label: '碳水化合物', unit: 'g', color: '#E0B876' },
];

export const PlanPage = () => {
  const { plan: storedPlan, setPlan: setStoredPlan } = useStore();
  const [plan, setPlan] = useState(storedPlan);

  useEffect(() => { setPlan(storedPlan); }, [storedPlan]);

  // Simple derived preview: kcal from macros
  const kcalFromMacros = plan.protein * 4 + plan.carbs * 4 + plan.fat * 9;
  const delta = kcalFromMacros - plan.calories;

  return (
    <div className="pb-32">
      <header className="px-5 pt-6 pb-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">PLAN</p>
        <h1 className="text-[22px] font-medium text-[#2C332F] mt-1">每日摄入计划</h1>
        <p className="text-[12px] text-[#858C88] mt-1">设置你的每日目标，让时间轴更懂你</p>
      </header>

      <div className="px-5 space-y-3">
        {FIELDS.map((f) => (
          <div
            key={f.key}
            className="rounded-2xl bg-white border border-[#E5E5E0] p-4"
            data-testid={`plan-field-${f.key}`}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[12px] px-2 py-0.5 rounded-full"
                style={{ background: `${f.color}12`, color: f.color }}
              >
                {f.label}
              </span>
              <span className="text-[11px] text-[#858C88]">{f.unit}</span>
            </div>
            <Input
              type="number"
              inputMode="numeric"
              value={plan[f.key]}
              onChange={(e) =>
                setPlan((p) => ({ ...p, [f.key]: Number(e.target.value) || 0 }))
              }
              className="mt-2 h-14 text-2xl font-num bg-transparent border-none px-0 focus-visible:ring-0"
              data-testid={`plan-input-${f.key}`}
            />
          </div>
        ))}

        <div className="rounded-2xl p-4" style={{ background: '#EFF2ED' }}>
          <p className="text-[11px] uppercase tracking-widest text-[#858C88]">宏观核对</p>
          <p className="font-num text-[13px] text-[#2C332F] mt-1.5">
            由三大营养素换算 = <b>{kcalFromMacros}</b> kcal
          </p>
          <p className="font-num text-[11px] mt-1" style={{ color: Math.abs(delta) > 100 ? '#D27D67' : '#6B8067' }}>
            与目标热量差 {delta > 0 ? '+' : ''}{delta} kcal
          </p>
        </div>

        <Button
          onClick={() => { setStoredPlan(plan); toast.success('计划已保存（模拟）'); }}
          data-testid="plan-save-btn"
          className="w-full h-12 rounded-2xl bg-[#6B8067] hover:bg-[#5a6d57] text-white text-[14px] mt-2"
        >
          保存计划
        </Button>
      </div>
    </div>
  );
};
