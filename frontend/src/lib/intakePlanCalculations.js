const CALCULATED_FIELDS = ['calories', 'protein', 'fat', 'carbs'];

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function roundCalories(value) {
  return Math.round(value);
}

function roundMacro(value) {
  return Math.round(value * 10) / 10;
}

export function isCalculatedField(value) {
  return CALCULATED_FIELDS.includes(value);
}

export function normalizeCalculatedField(value) {
  return isCalculatedField(value) ? value : 'calories';
}

export function calculateIntakePlan(values, calculatedField) {
  const normalizedField = normalizeCalculatedField(calculatedField);

  const calories = toFiniteNumber(values?.calories);
  const protein = toFiniteNumber(values?.protein);
  const fat = toFiniteNumber(values?.fat);
  const carbs = toFiniteNumber(values?.carbs);

  const result = {
    calories,
    protein,
    fat,
    carbs,
    calculatedField: normalizedField,
  };

  if (normalizedField === 'calories') {
    if (![protein, fat, carbs].every(Number.isFinite)) {
      return { success: false, error: '请输入三个目标值' };
    }

    const computed = protein * 4 + carbs * 4 + fat * 9;
    result.calories = roundCalories(computed);
    return { success: true, data: result };
  }

  if (normalizedField === 'protein') {
    if (![calories, fat, carbs].every(Number.isFinite)) {
      return { success: false, error: '请输入三个目标值' };
    }

    const computed = (calories - carbs * 4 - fat * 9) / 4;
    result.protein = roundMacro(computed);
    return { success: true, data: result };
  }

  if (normalizedField === 'fat') {
    if (![calories, protein, carbs].every(Number.isFinite)) {
      return { success: false, error: '请输入三个目标值' };
    }

    const computed = (calories - protein * 4 - carbs * 4) / 9;
    result.fat = roundMacro(computed);
    return { success: true, data: result };
  }

  if (![calories, protein, fat].every(Number.isFinite)) {
    return { success: false, error: '请输入三个目标值' };
  }

  const computed = (calories - protein * 4 - fat * 9) / 4;
  result.carbs = roundMacro(computed);
  return { success: true, data: result };
}

export function formatNumberByField(value, field) {
  if (!Number.isFinite(Number(value))) return '--';

  if (field === 'calories') {
    return String(roundCalories(Number(value)));
  }

  const rounded = roundMacro(Number(value));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
