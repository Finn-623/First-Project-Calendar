import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
import { formatNumberByField } from '../lib/intakePlanCalculations';
import { validateIntakePlanDraft, hasIntakePlanChanged } from '../lib/intakePlanValidation';

const FIELD_DEFINITIONS = [
  { key: 'calories', label: '热量', unit: 'kcal' },
  { key: 'protein', label: '蛋白质', unit: 'g' },
  { key: 'fat', label: '脂肪', unit: 'g' },
  { key: 'carbs', label: '碳水', unit: 'g' },
];

function toDraft(plan) {
  if (!plan) {
    return {
      calories: '',
      protein: '',
      fat: '',
      carbs: '',
    };
  }

  return {
    calories: String(plan.calories ?? ''),
    protein: String(plan.protein ?? ''),
    fat: String(plan.fat ?? ''),
    carbs: String(plan.carbs ?? ''),
  };
}

function calculateAutoField(draft) {
  const values = {
    calories: Number(draft.calories) || 0,
    protein: Number(draft.protein) || 0,
    fat: Number(draft.fat) || 0,
    carbs: Number(draft.carbs) || 0,
  };

  const emptyFields = Object.entries(values).filter(([, v]) => v === 0).map(([k]) => k);

  if (emptyFields.length !== 1) {
    return null;
  }

  const emptyField = emptyFields[0];

  if (emptyField === 'calories') {
    return Math.round(values.protein * 4 + values.fat * 9 + values.carbs * 4);
  }

  if (emptyField === 'protein') {
    const remaining = values.calories - (values.fat * 9 + values.carbs * 4);
    return Math.max(0, Math.round(remaining / 4 * 10) / 10);
  }

  if (emptyField === 'fat') {
    const remaining = values.calories - (values.protein * 4 + values.carbs * 4);
    return Math.max(0, Math.round(remaining / 9 * 10) / 10);
  }

  if (emptyField === 'carbs') {
    const remaining = values.calories - (values.protein * 4 + values.fat * 9);
    return Math.max(0, Math.round(remaining / 4 * 10) / 10);
  }

  return null;
}

export const SettingsIntakePlanPage = () => {
  const { user, plan, loadPlan, savePlan } = useStore();
  const [saving, setSaving] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(plan || null);
  const [draft, setDraft] = useState(() => toDraft(plan));
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    loadPlan(user.id).then((result) => {
      if (result?.success && result.data) {
        setCurrentPlan(result.data);
        setDraft(toDraft(result.data));
      }
    });
  }, [loadPlan, user?.id]);

  const autoValue = calculateAutoField(draft);

  const handleSave = async () => {
    if (saving || !user?.id) return;

    if (autoValue === null) {
      setErrorMessage('请填写其中任意 3 项，第 4 项将自动计算');
      return;
    }

    const emptyFields = Object.entries(draft).filter(([, v]) => !v || Number(v) === 0).map(([k]) => k);
    const filledData = { ...draft };
    if (emptyFields.length === 1) {
      const emptyKey = emptyFields[0];
      filledData[emptyKey] = String(autoValue);
    }

    const validated = validateIntakePlanDraft(filledData, 'calories');
    if (!validated.success) {
      setErrorMessage(validated.error || '请输入有效数值');
      return;
    }

    if (!hasIntakePlanChanged(currentPlan, validated.data)) {
      setErrorMessage('');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    const result = await savePlan(user.id, validated.data, undefined, 'calories');
    if (!result.success) {
      const message = String(result.error?.message || result.error || '保存失败，请稍后重试');
      setErrorMessage(message);
      setSaving(false);
      return;
    }

    const nextPlan = validated.data;
    setCurrentPlan(nextPlan);
    setDraft(toDraft(nextPlan));
    setSaving(false);
    toast.success('摄入计划已更新');
  };

  const handleCancel = () => {
    setErrorMessage('');
    setDraft(toDraft(currentPlan));
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="摄入计划"
        description="设置每日热量和宏量营养目标。"
      />

      <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[14px] font-medium text-[#2C332F]">编辑摄入计划</p>
          <p className="text-[12px] text-[#858C88] mt-1">填写任意 3 项，第 4 项自动计算</p>
        </div>

        <div className="px-4 py-3 space-y-2">
          {FIELD_DEFINITIONS.map((field) => {
            const emptyFields = Object.entries(draft).filter(([, v]) => !v || Number(v) === 0).map(([k]) => k);
            const isAutoField = autoValue !== null && emptyFields.length === 1 && emptyFields[0] === field.key;
            const displayValue = isAutoField ? formatNumberByField(autoValue, field.key) : draft[field.key];

            return (
              <div key={field.key}>
                <label htmlFor={`intake-${field.key}`} className="text-[12px] text-[#6A6F6C]">
                  {field.label}
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id={`intake-${field.key}`}
                    inputMode="decimal"
                    value={displayValue}
                    readOnly={isAutoField || saving}
                    onChange={(event) => {
                      setDraft((prev) => ({ ...prev, [field.key]: event.target.value }));
                      setErrorMessage('');
                    }}
                    className={`w-full min-h-11 rounded-lg border px-3 text-[14px] ${isAutoField ? 'border-[#E5E5E0] bg-[#F7F7F5] text-[#6A6F6C]' : 'border-[#D5DCD2] bg-white text-[#2C332F]'}`}
                    placeholder="0"
                  />
                  <span className="text-[12px] text-[#858C88] w-10 text-right">{field.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {errorMessage ? (
          <div className="px-4 py-2">
            <p className="text-[12px] text-[#A8483E]">{errorMessage}</p>
          </div>
        ) : null}

        <div className="px-4 py-3 border-t border-[#F0EFE9] flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="min-h-11 px-3 rounded-lg border border-[#D5DCD2] text-[13px] text-[#2C332F] disabled:opacity-55"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-11 px-3 rounded-lg bg-[#6B8067] text-[13px] text-white disabled:opacity-55 flex-1"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </section>
    </div>
  );
};
