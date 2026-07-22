import React, { useState, useEffect, useMemo } from 'react';
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

const EMPTY_PLAN_FORM = {
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
};

const toForm = (plan) => {
  if (!plan) return EMPTY_PLAN_FORM;
  return {
    calories: plan.calories != null ? String(plan.calories) : '',
    protein: plan.protein != null ? String(plan.protein) : '',
    fat: plan.fat != null ? String(plan.fat) : '',
    carbs: plan.carbs != null ? String(plan.carbs) : '',
  };
};

const parseNumber = (value) => {
  if (value === '' || value == null) return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};

export const PlanPage = () => {
  const { plan: storedPlan, setPlan: setStoredPlan } = useStore();
  const [form, setForm] = useState(() => toForm(storedPlan));
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (isDirty) return;
    setForm(toForm(storedPlan));
  }, [storedPlan, isDirty]);

  const formNumbers = useMemo(() => ({
    calories: parseNumber(form.calories),
    protein: parseNumber(form.protein),
    fat: parseNumber(form.fat),
    carbs: parseNumber(form.carbs),
  }), [form]);

  const safeForPreview = {
    calories: Number.isFinite(formNumbers.calories) ? formNumbers.calories : 0,
    protein: Number.isFinite(formNumbers.protein) ? formNumbers.protein : 0,
    fat: Number.isFinite(formNumbers.fat) ? formNumbers.fat : 0,
    carbs: Number.isFinite(formNumbers.carbs) ? formNumbers.carbs : 0,
  };

  const kcalFromMacros = safeForPreview.protein * 4 + safeForPreview.carbs * 4 + safeForPreview.fat * 9;
  const delta = safeForPreview.calories > 0 ? kcalFromMacros - safeForPreview.calories : 0;

  const handleChange = (key, value) => {
    setIsDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const calories = parseNumber(form.calories);
    const protein = parseNumber(form.protein);
    const fat = parseNumber(form.fat);
    const carbs = parseNumber(form.carbs);

    if (!Number.isFinite(calories) || calories <= 0) {
      toast.error('目标热量必须是大于 0 的数字');
      return;
    }

    if (!Number.isFinite(protein) || protein < 0) {
      toast.error('蛋白质必须是大于或等于 0 的数字');
      return;
    }

    if (!Number.isFinite(fat) || fat < 0) {
      toast.error('脂肪必须是大于或等于 0 的数字');
      return;
    }

    if (!Number.isFinite(carbs) || carbs < 0) {
      toast.error('碳水化合物必须是大于或等于 0 的数字');
      return;
    }

    const nextPlan = { calories, protein, fat, carbs };
    setStoredPlan(nextPlan);
    setIsDirty(false);
    setForm(toForm(nextPlan));
    toast.success('计划已保存');
  };

  return (
    <div className="pb-32">
      <header className="px-5 pt-6 pb-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">PLAN</p>
        <h1 className="text-[22px] font-medium text-[#2C332F] mt-1">每日摄入计划</h1>
        <p className="text-[12px] text-[#858C88] mt-1">设置你的每日目标，让时间轴更懂你</p>
      </header>

      <div className="px-5 space-y-3">
        {!storedPlan && (
          <div className="rounded-2xl bg-white border border-[#E5E5E0] p-4">
            <p className="text-[13px] text-[#858C88]">尚未设置目标</p>
          </div>
        )}

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
              value={form[f.key]}
              onChange={(e) => handleChange(f.key, e.target.value)}
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
          onClick={handleSave}
          data-testid="plan-save-btn"
          className="w-full h-12 rounded-2xl bg-[#6B8067] hover:bg-[#5a6d57] text-white text-[14px] mt-2"
        >
          保存计划
        </Button>
      </div>
    </div>
  );
};
