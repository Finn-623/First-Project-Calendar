import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { SettingsSubpageHeader } from '../components/settings/SettingsSubpageHeader';
import { intakePlanService } from '../services/intakePlanService';
import { formatLocalDateTime } from '../lib/versionInfoUtils';
import { calculateIntakePlan, formatNumberByField, normalizeCalculatedField } from '../lib/intakePlanCalculations';
import { hasIntakePlanChanged, validateIntakePlanDraft } from '../lib/intakePlanValidation';

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

function getCalculatedLabel(field) {
  const current = FIELD_DEFINITIONS.find((item) => item.key === field);
  return current?.label || '热量';
}

export const SettingsIntakePlanPage = () => {
  const { user, plan, loadPlan, savePlan } = useStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(plan || null);
  const [draft, setDraft] = useState(() => toDraft(plan));
  const [calculatedField, setCalculatedField] = useState(normalizeCalculatedField(plan?.calculatedField));
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyItems, setHistoryItems] = useState([]);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);

  useEffect(() => {
    if (!plan) return;
    setCurrentPlan(plan);
    if (!editing) {
      setDraft(toDraft(plan));
      setCalculatedField(normalizeCalculatedField(plan.calculatedField));
    }
  }, [editing, plan]);

  const loadHistory = useCallback(async ({ append = false, cursor = null } = {}) => {
    if (!user?.id) return;

    if (append) {
      if (loadingMoreHistory || loadingHistory || !historyHasMore || !cursor) return;
      setLoadingMoreHistory(true);
    } else {
      setLoadingHistory(true);
      setHistoryError('');
    }

    const result = await intakePlanService.listHistory({
      userId: user.id,
      limit: 5,
      cursor: append ? cursor : null,
    });

    if (!result.success) {
      if (append) {
        toast.error(result.error || '历史记录加载失败，请重试');
        setLoadingMoreHistory(false);
        return;
      }

      setHistoryError(result.error || '历史记录加载失败，请重试');
      setLoadingHistory(false);
      return;
    }

    if (append) {
      setHistoryItems((prev) => [...prev, ...(result.data || [])]);
      setLoadingMoreHistory(false);
    } else {
      setHistoryItems(result.data || []);
      setLoadingHistory(false);
    }

    setHistoryHasMore(Boolean(result.hasMore));
    setHistoryCursor(result.nextCursor || null);
  }, [historyHasMore, loadingHistory, loadingMoreHistory, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    loadPlan(user.id)
      .then((result) => {
        if (result?.success && result.data) {
          setCurrentPlan(result.data);
          setDraft(toDraft(result.data));
          setCalculatedField(normalizeCalculatedField(result.data.calculatedField));
        }
      });

    loadHistory({ append: false });
  }, [loadPlan, user?.id]);

  const previewResult = useMemo(() => {
    if (!editing) return null;
    return calculateIntakePlan(draft, calculatedField);
  }, [calculatedField, draft, editing]);

  const handleEditStart = () => {
    setErrorMessage('');
    setDraft(toDraft(currentPlan));
    setCalculatedField(normalizeCalculatedField(currentPlan?.calculatedField));
    setEditing(true);
  };

  const handleCancel = () => {
    setErrorMessage('');
    setDraft(toDraft(currentPlan));
    setCalculatedField(normalizeCalculatedField(currentPlan?.calculatedField));
    setEditing(false);
  };

  const handleSave = async () => {
    if (saving || !user?.id) return;

    const validated = validateIntakePlanDraft(draft, calculatedField);
    if (!validated.success) {
      setErrorMessage(validated.error || '请输入有效数值');
      return;
    }

    if (!hasIntakePlanChanged(currentPlan, validated.data)) {
      setEditing(false);
      setErrorMessage('');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    const result = await savePlan(user.id, validated.data, undefined, validated.data.calculatedField);
    if (!result.success) {
      const message = String(result.error?.message || result.error || '保存失败，请稍后重试');
      setErrorMessage(message);
      setSaving(false);
      return;
    }

    const nextPlan = {
      ...validated.data,
      calculatedField: validated.data.calculatedField,
    };

    setCurrentPlan(nextPlan);
    setDraft(toDraft(nextPlan));
    setCalculatedField(normalizeCalculatedField(nextPlan.calculatedField));
    setEditing(false);
    setSaving(false);
    toast.success('摄入计划已更新');
    await loadHistory({ append: false });
  };

  const currentCalculatedField = normalizeCalculatedField(currentPlan?.calculatedField);

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-6 pb-28">
      <SettingsSubpageHeader
        title="摄入计划"
        description="设置每日热量和宏量营养目标。"
      />

      <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#F0EFE9] flex items-center justify-between gap-2">
          <p className="text-[14px] font-medium text-[#2C332F]">当前摄入计划</p>
          {!editing ? (
            <button
              type="button"
              onClick={handleEditStart}
              className="min-h-11 px-3 rounded-lg border border-[#D5DCD2] text-[12px] text-[#2C332F]"
            >
              编辑计划
            </button>
          ) : null}
        </div>

        {!editing ? (
          <div className="px-4 py-3">
            {currentPlan ? (
              <>
                {FIELD_DEFINITIONS.map((field) => (
                  <div key={field.key} className="flex items-center justify-between py-1">
                    <p className="text-[13px] text-[#6A6F6C]">{field.label}</p>
                    <p className="text-[14px] text-[#2C332F]">
                      {formatNumberByField(currentPlan[field.key], field.key)} {field.unit}
                    </p>
                  </div>
                ))}
                <p className="text-[12px] text-[#858C88] mt-2">自动计算：{getCalculatedLabel(currentCalculatedField)}</p>
              </>
            ) : (
              <p className="text-[13px] text-[#6A6F6C]">暂无当前计划</p>
            )}
          </div>
        ) : (
          <div className="px-4 py-3">
            <p className="text-[12px] text-[#858C88]">选择一项自动计算，其余三项由你填写。</p>

            <div className="grid grid-cols-2 gap-2 mt-2">
              {FIELD_DEFINITIONS.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  disabled={saving}
                  onClick={() => setCalculatedField(field.key)}
                  className={`min-h-11 px-2 rounded-lg border text-[12px] ${calculatedField === field.key ? 'border-[#6B8067] text-[#6B8067] bg-[#EEF2EC]' : 'border-[#D5DCD2] text-[#2C332F]'}`}
                >
                  自动计算{field.label}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {FIELD_DEFINITIONS.map((field) => {
                const readOnly = calculatedField === field.key;
                const computedText = previewResult?.success
                  ? formatNumberByField(previewResult.data[field.key], field.key)
                  : '--';

                return (
                  <div key={field.key}>
                    <label htmlFor={`intake-${field.key}`} className="text-[12px] text-[#6A6F6C]">{field.label}</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        id={`intake-${field.key}`}
                        inputMode="decimal"
                        value={readOnly ? computedText : draft[field.key]}
                        readOnly={readOnly || saving}
                        onChange={(event) => {
                          setDraft((prev) => ({ ...prev, [field.key]: event.target.value }));
                          setErrorMessage('');
                        }}
                        className={`w-full min-h-11 rounded-lg border px-3 text-[14px] ${readOnly ? 'border-[#E5E5E0] bg-[#F7F7F5] text-[#6A6F6C]' : 'border-[#D5DCD2] bg-white text-[#2C332F]'}`}
                      />
                      <span className="text-[12px] text-[#858C88] w-10 text-right">{field.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {errorMessage ? (
              <p className="text-[12px] text-[#A8483E] mt-2">{errorMessage}</p>
            ) : null}

            <div className="mt-3 flex items-center gap-2">
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
                className="min-h-11 px-3 rounded-lg bg-[#6B8067] text-[13px] text-white disabled:opacity-55"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F0EFE9]">
          <p className="text-[14px] font-medium text-[#2C332F]">摄入计划历史记录</p>
        </div>

        {loadingHistory ? (
          <p className="px-4 py-3 text-[13px] text-[#6A6F6C]">正在加载历史记录...</p>
        ) : null}

        {!loadingHistory && historyError ? (
          <div className="px-4 py-3">
            <p className="text-[13px] text-[#A8483E]">{historyError}</p>
            <button
              type="button"
              onClick={() => loadHistory({ append: false })}
              className="mt-2 min-h-11 px-3 rounded-lg border border-[#D5DCD2] text-[13px] text-[#2C332F]"
            >
              重试
            </button>
          </div>
        ) : null}

        {!loadingHistory && !historyError && historyItems.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-[#6A6F6C]">暂无摄入计划记录</p>
        ) : null}

        {!loadingHistory && !historyError && historyItems.map((item, index) => (
          <article key={item.id} className="px-4 py-3 border-b border-[#F0EFE9] last:border-b-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-[#6A6F6C]">{formatLocalDateTime(item.createdAt)}</p>
              {index === 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EEF2EC] text-[#6B8067]">当前计划</span>
              ) : null}
            </div>
            <p className="text-[14px] text-[#2C332F] mt-1">{formatNumberByField(item.calories, 'calories')} kcal</p>
            <p className="text-[12px] text-[#6A6F6C] mt-1">
              蛋白质 {formatNumberByField(item.protein, 'protein')}g · 脂肪 {formatNumberByField(item.fat, 'fat')}g · 碳水 {formatNumberByField(item.carbs, 'carbs')}g
            </p>
            <p className="text-[12px] text-[#858C88] mt-1">自动计算：{getCalculatedLabel(item.calculatedField)}</p>
          </article>
        ))}

        {!loadingHistory && !historyError && historyItems.length > 0 && historyHasMore ? (
          <div className="px-4 py-3 border-t border-[#F0EFE9]">
            <button
              type="button"
              disabled={loadingMoreHistory}
              onClick={() => loadHistory({ append: true, cursor: historyCursor })}
              className="w-full min-h-11 rounded-lg border border-[#D5DCD2] text-[13px] text-[#2C332F] disabled:opacity-55"
            >
              {loadingMoreHistory ? '加载中...' : '查看更多'}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
};
