import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { toast } from 'sonner';
import { useStore } from '../store';
import { upsertDailyTarget } from '../services/targetService';
import { round1, roundCalories } from '../lib/nutrition';

const FIELDS = [
  { key: 'calories', label: '目标热量', unit: 'kcal', color: '#2C332F' },
  { key: 'protein', label: '蛋白质', unit: 'g', color: '#6B8067' },
  { key: 'fat', label: '脂肪', unit: 'g', color: '#D27D67' },
  { key: 'carbs', label: '碳水化合物', unit: 'g', color: '#E0B876' },
];

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const computeAuto = (autoKey, draft) => {
  const calories = toNumber(draft.calories);
  const protein = toNumber(draft.protein);
  const fat = toNumber(draft.fat);
  const carbs = toNumber(draft.carbs);

  if (autoKey === 'calories') {
    if ([protein, fat, carbs].some((x) => x === null)) return null;
    return roundCalories(protein * 4 + carbs * 4 + fat * 9);
  }
  if (autoKey === 'protein') {
    if ([calories, fat, carbs].some((x) => x === null)) return null;
    return round1((calories - carbs * 4 - fat * 9) / 4);
  }
  if (autoKey === 'carbs') {
    if ([calories, protein, fat].some((x) => x === null)) return null;
    return round1((calories - protein * 4 - fat * 9) / 4);
  }
  if ([calories, protein, carbs].some((x) => x === null)) return null;
  return round1((calories - protein * 4 - carbs * 4) / 9);
};

export const PlanPage = () => {
  const { plan: storedPlan, setPlan: setStoredPlan, user, dateStr, getCurrentUser, reloadPlan } = useStore();
  const [draft, setDraft] = useState({ calories: '', protein: '', fat: '', carbs: '' });
  const [autoKey, setAutoKey] = useState('calories');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!storedPlan) {
      setDraft({ calories: '', protein: '', fat: '', carbs: '' });
      return;
    }
    setDraft({
      calories: String(storedPlan.calories ?? ''),
      protein: String(storedPlan.protein ?? ''),
      fat: String(storedPlan.fat ?? ''),
      carbs: String(storedPlan.carbs ?? ''),
    });
  }, [storedPlan]);

  useEffect(() => { reloadPlan(); }, [dateStr, reloadPlan]);

  const autoValue = useMemo(() => computeAuto(autoKey, draft), [autoKey, draft]);

  const previewPlan = useMemo(() => {
    const merged = { ...draft };
    if (autoValue !== null) merged[autoKey] = String(autoValue);
    return merged;
  }, [autoValue, autoKey, draft]);

  const handleSave = async () => {
    let currentUser = user;
    if (!currentUser) {
      try {
        currentUser = await getCurrentUser();
      } catch (e) {
        toast.error(e?.message || '登录状态获取失败');
        return;
      }
    }
    if (!currentUser?.id) {
      toast.error('请先登录');
      return;
    }

    const resolved = {
      calories: autoKey === 'calories' ? autoValue : toNumber(draft.calories),
      protein: autoKey === 'protein' ? autoValue : toNumber(draft.protein),
      fat: autoKey === 'fat' ? autoValue : toNumber(draft.fat),
      carbs: autoKey === 'carbs' ? autoValue : toNumber(draft.carbs),
    };

    if (Object.values(resolved).some((v) => v === null || !Number.isFinite(v))) {
      toast.error('请填写完整且有效的数字');
      return;
    }
    if (resolved.calories <= 0 || resolved.protein < 0 || resolved.fat < 0 || resolved.carbs < 0) {
      toast.error('当前三个数值无法计算出有效目标，请调整输入');
      return;
    }

    const rounded = {
      calories: roundCalories(resolved.calories),
      protein: round1(resolved.protein),
      fat: round1(resolved.fat),
      carbs: round1(resolved.carbs),
    };

    if (Object.values(rounded).some((v) => !Number.isFinite(v))) {
      toast.error('目标数值无效');
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertDailyTarget({ userId: currentUser.id, dateStr, plan: rounded });
      setStoredPlan(saved);
      setDraft({
        calories: String(saved.calories),
        protein: String(saved.protein),
        fat: String(saved.fat),
        carbs: String(saved.carbs),
      });
      toast.success('计划已保存');
    } catch (e) {
      toast.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-32">
      <header className="px-5 pt-6 pb-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#858C88]">PLAN</p>
        <h1 className="text-[22px] font-medium text-[#2C332F] mt-1">每日摄入计划</h1>
        <p className="text-[12px] text-[#858C88] mt-1">
          {storedPlan ? '选择一项自动计算，填写其余三项' : '尚未设置目标'}
        </p>
      </header>

      <div className="px-5 space-y-3">
        <RadioGroup value={autoKey} onValueChange={setAutoKey} className="gap-3">
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
                <label className="flex items-center gap-2 text-[11px] text-[#858C88]">
                  <RadioGroupItem value={f.key} id={`auto-${f.key}`} />
                  自动计算
                </label>
              </div>
              <Input
                type="number"
                inputMode="decimal"
                value={previewPlan[f.key]}
                readOnly={autoKey === f.key}
                onChange={(e) => setDraft((p) => ({ ...p, [f.key]: e.target.value }))}
                className="mt-2 h-14 text-2xl font-num bg-transparent border-none px-0 focus-visible:ring-0 disabled:opacity-100"
                data-testid={`plan-input-${f.key}`}
              />
              <p className="text-[11px] text-[#858C88]">
                {autoKey === f.key ? `自动结果 · ${f.unit}` : `手动输入 · ${f.unit}`}
              </p>
            </div>
          ))}
        </RadioGroup>

        {autoValue !== null && autoValue < 0 && (
          <p className="text-[12px] text-[#D27D67]">当前三个数值无法计算出有效目标，请调整输入</p>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || autoValue === null || autoValue < 0}
          data-testid="plan-save-btn"
          className="w-full h-12 rounded-2xl bg-[#6B8067] hover:bg-[#5a6d57] text-white text-[14px] mt-2"
        >
          {saving ? '保存中...' : '保存计划'}
        </Button>
      </div>
    </div>
  );
};
