import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useStore } from '../store';
import { Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

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

const formatPlanDate = (dateStr) => {
  if (!dateStr) return '未命名日期';

  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
};

export const PlanPage = () => {
  const { plan: storedPlan, planDate, planHistory, savePlan, deletePlan, user } = useStore();
  const [form, setForm] = useState(() => toForm(storedPlan));
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingDate, setEditingDate] = useState(planDate || null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const editingRecord = useMemo(() => {
    const targetDate = editingDate || planDate || null;
    if (!targetDate) return null;

    if (planDate === targetDate && storedPlan) {
      return { dateStr: targetDate, plan: storedPlan };
    }

    return planHistory.find((item) => item.dateStr === targetDate) || null;
  }, [editingDate, planDate, planHistory, storedPlan]);

  useEffect(() => {
    if (isDirty) return;
    setForm(toForm(editingRecord?.plan || storedPlan));
  }, [editingRecord, isDirty, storedPlan]);

  useEffect(() => {
    if (!editingDate && planDate) {
      setEditingDate(planDate);
      return;
    }

    if (editingDate && !planHistory.some((item) => item.dateStr === editingDate) && planDate) {
      setEditingDate(planDate);
    }
  }, [editingDate, planDate, planHistory]);

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
  const currentEditingDate = editingRecord?.dateStr || editingDate || planDate || null;

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
    setIsSaving(true);

    savePlan(user?.id, nextPlan, currentEditingDate || undefined)
      .then(({ success, error }) => {
        if (!success) {
          toast.error(error?.message || '计划保存失败，请稍后重试');
          return;
        }

        setIsDirty(false);
        setForm(toForm(nextPlan));
        setEditingDate(currentEditingDate || null);
        toast.success('计划已保存');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleEditRecord = (record) => {
    setEditingDate(record.dateStr);
    setForm(toForm(record.plan));
    setIsDirty(false);
    toast.success(`正在编辑 ${formatPlanDate(record.dateStr)} 的计划`);
  };

  const handleDeleteRecord = async () => {
    if (!deleteTarget || !user?.id) return;

    setIsDeleting(true);
    const { success, error } = await deletePlan(user.id, deleteTarget.dateStr);

    if (!success) {
      toast.error(error?.message || '删除失败，请稍后重试');
      setIsDeleting(false);
      return;
    }

    if (deleteTarget.dateStr === currentEditingDate) {
      setEditingDate(null);
      setIsDirty(false);
    }

    setDeleteTarget(null);
    toast.success('计划已删除');
    setIsDeleting(false);
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

        <div className="rounded-2xl bg-white border border-[#E5E5E0] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#858C88]">当前编辑</p>
              <p className="text-[14px] text-[#2C332F] mt-1">
                {currentEditingDate ? formatPlanDate(currentEditingDate) : '未选择记录'}
              </p>
            </div>
            <span className="text-[11px] text-[#858C88]">
              {planHistory.length} 条历史
            </span>
          </div>
          <p className="text-[12px] text-[#858C88] mt-2 leading-relaxed">
            你可以直接修改当前编辑的计划，也可以在下方选择历史记录进行编辑或删除。
          </p>
        </div>

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
          disabled={isSaving}
          className="w-full h-12 rounded-2xl bg-[#6B8067] hover:bg-[#5a6d57] text-white text-[14px] mt-2"
        >
          {isSaving ? '保存中...' : '保存计划'}
        </Button>

        <div className="pt-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-medium text-[#2C332F] tracking-wide">历史记录</h2>
            <span className="text-[11px] text-[#858C88]">可编辑 / 删除</span>
          </div>

          <div className="space-y-2">
            {planHistory.map((record) => {
              const isActive = record.dateStr === currentEditingDate;

              return (
                <div
                  key={record.dateStr}
                  className={`rounded-2xl border p-4 bg-white ${isActive ? 'border-[#6B8067]' : 'border-[#E5E5E0]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13.5px] text-[#2C332F]">{formatPlanDate(record.dateStr)}</p>
                      <p className="font-num text-[11px] text-[#858C88] mt-1">
                        {record.plan?.calories || 0} kcal · P{record.plan?.protein || 0} · F{record.plan?.fat || 0} · C{record.plan?.carbs || 0}
                      </p>
                    </div>
                    {isActive && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFF2ED] text-[#6B8067]">当前</span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => handleEditRecord(record)}
                      className="inline-flex items-center gap-1 text-[12px] text-[#6B8067] hover:text-[#5a6d57]"
                    >
                      <Pencil size={12} strokeWidth={1.8} /> 编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(record)}
                      className="inline-flex items-center gap-1 text-[12px] text-[#C76D5E] hover:text-[#B85A4A]"
                    >
                      <Trash2 size={12} strokeWidth={1.8} /> 删除
                    </button>
                  </div>
                </div>
              );
            })}

            {planHistory.length === 0 && (
              <p className="text-center text-sm text-[#858C88] py-8">暂无历史记录</p>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>删除计划记录</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除 {deleteTarget ? formatPlanDate(deleteTarget.dateStr) : ''} 的摄入计划吗？删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!isDeleting) handleDeleteRecord();
              }}
              disabled={isDeleting}
              className="bg-[#D27D67] hover:bg-[#bf6e59]"
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
