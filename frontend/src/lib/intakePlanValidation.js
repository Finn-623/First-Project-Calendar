import { calculateIntakePlan, normalizeCalculatedField } from './intakePlanCalculations';

function isValidDecimalString(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return /^\d+(\.\d)?$/.test(text);
}

function parseDecimal(value) {
  const num = Number(String(value ?? '').trim());
  return Number.isFinite(num) ? num : NaN;
}

export function validateIntakePlanDraft(draftValues, calculatedField) {
  const field = normalizeCalculatedField(calculatedField);
  const manualFields = ['calories', 'protein', 'fat', 'carbs'].filter((item) => item !== field);

  for (const manualField of manualFields) {
    const raw = draftValues?.[manualField];
    if (!isValidDecimalString(raw)) {
      return { success: false, error: '请输入有效数值' };
    }

    const parsed = parseDecimal(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { success: false, error: '请输入有效数值' };
    }
  }

  const calculated = calculateIntakePlan(
    {
      calories: field === 'calories' ? draftValues?.calories : parseDecimal(draftValues?.calories),
      protein: field === 'protein' ? draftValues?.protein : parseDecimal(draftValues?.protein),
      fat: field === 'fat' ? draftValues?.fat : parseDecimal(draftValues?.fat),
      carbs: field === 'carbs' ? draftValues?.carbs : parseDecimal(draftValues?.carbs),
    },
    field
  );

  if (!calculated.success) {
    return { success: false, error: calculated.error || '请输入三个目标值' };
  }

  const values = calculated.data;
  if (![values.calories, values.protein, values.fat, values.carbs].every((item) => Number.isFinite(item) && item >= 0)) {
    return { success: false, error: '自动计算结果不能小于 0，请调整其他目标' };
  }

  return {
    success: true,
    data: {
      calories: Number(values.calories),
      protein: Number(values.protein),
      fat: Number(values.fat),
      carbs: Number(values.carbs),
      calculatedField: field,
    },
  };
}

export function hasIntakePlanChanged(previousPlan, nextPlan) {
  if (!previousPlan) return true;

  return !(
    Number(previousPlan.calories) === Number(nextPlan.calories)
    && Number(previousPlan.protein) === Number(nextPlan.protein)
    && Number(previousPlan.fat) === Number(nextPlan.fat)
    && Number(previousPlan.carbs) === Number(nextPlan.carbs)
    && String(previousPlan.calculatedField || 'calories') === String(nextPlan.calculatedField || 'calories')
  );
}
