export const PERSONAL_INFO_GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
  { value: 'prefer_not_to_say', label: '不愿透露' },
];

export const PERSONAL_INFO_HEIGHT_MIN = 50;
export const PERSONAL_INFO_HEIGHT_MAX = 250;
export const PERSONAL_INFO_WEIGHT_MIN = 20;
export const PERSONAL_INFO_WEIGHT_MAX = 500;

function toLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeNumericLike(value) {
  if (value == null) return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(1)));
}

export function normalizePersonalInfoFromProfile(profile) {
  const genderValue = profile?.gender;
  const validGender = PERSONAL_INFO_GENDER_OPTIONS.some((item) => item.value === genderValue) ? genderValue : '';

  const birthDate = String(profile?.birth_date || profile?.birthday || '').trim();
  const heightCmSource = profile?.height_cm ?? profile?.height;
  const weightKgSource = profile?.weight_kg ?? profile?.weight;

  return {
    gender: validGender,
    birthDate,
    heightCm: normalizeNumericLike(heightCmSource),
    weightKg: normalizeNumericLike(weightKgSource),
  };
}

export function getGenderLabel(value) {
  const match = PERSONAL_INFO_GENDER_OPTIONS.find((item) => item.value === value);
  return match ? match.label : '未设置';
}

export function formatMetric(value, unit) {
  if (value === '' || value == null) return '未设置';
  const num = Number(value);
  if (!Number.isFinite(num)) return '未设置';
  const text = Number.isInteger(num) ? String(num) : String(Number(num.toFixed(1)));
  return `${text} ${unit}`;
}

function parseDecimalValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { value: null, error: '' };

  if (!/^\d+(\.\d)?$/.test(raw)) {
    return { value: null, error: '格式错误' };
  }

  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return { value: null, error: '格式错误' };
  }

  return { value: num, error: '' };
}

export function validatePersonalInfo(formData, today = toLocalDateString()) {
  const errors = {};

  if (formData.gender && !PERSONAL_INFO_GENDER_OPTIONS.some((item) => item.value === formData.gender)) {
    errors.gender = '请选择有效的性别选项';
  }

  if (formData.birthDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.birthDate)) {
      errors.birthDate = '请输入有效生日';
    } else if (formData.birthDate > today) {
      errors.birthDate = '生日不能晚于今天';
    }
  }

  const heightParsed = parseDecimalValue(formData.heightCm);
  if (heightParsed.error) {
    errors.heightCm = '请输入 50-250 cm 之间的身高';
  } else if (heightParsed.value != null) {
    if (heightParsed.value < PERSONAL_INFO_HEIGHT_MIN || heightParsed.value > PERSONAL_INFO_HEIGHT_MAX) {
      errors.heightCm = '请输入 50-250 cm 之间的身高';
    }
  }

  const weightParsed = parseDecimalValue(formData.weightKg);
  if (weightParsed.error) {
    errors.weightKg = '请输入 20-500 kg 之间的体重';
  } else if (weightParsed.value != null) {
    if (weightParsed.value < PERSONAL_INFO_WEIGHT_MIN || weightParsed.value > PERSONAL_INFO_WEIGHT_MAX) {
      errors.weightKg = '请输入 20-500 kg 之间的体重';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

function normalizePayloadValue(value, type) {
  if (type === 'gender') {
    return value ? String(value) : null;
  }

  if (type === 'birthDate') {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  const parsed = parseDecimalValue(value);
  return parsed.value;
}

export function buildPersonalInfoUpdatePayload(originalData, formData) {
  const nextData = {
    gender: normalizePayloadValue(formData.gender, 'gender'),
    birth_date: normalizePayloadValue(formData.birthDate, 'birthDate'),
    height_cm: normalizePayloadValue(formData.heightCm, 'heightCm'),
    weight_kg: normalizePayloadValue(formData.weightKg, 'weightKg'),
  };

  const original = {
    gender: normalizePayloadValue(originalData.gender, 'gender'),
    birth_date: normalizePayloadValue(originalData.birthDate, 'birthDate'),
    height_cm: normalizePayloadValue(originalData.heightCm, 'heightCm'),
    weight_kg: normalizePayloadValue(originalData.weightKg, 'weightKg'),
  };

  const payload = {};
  Object.keys(nextData).forEach((key) => {
    if (nextData[key] !== original[key]) {
      payload[key] = nextData[key];
    }
  });

  return {
    hasChanges: Object.keys(payload).length > 0,
    payload,
  };
}

export function mapPersonalInfoSaveError(error) {
  const message = String(error?.message || '');
  const normalized = message.toLowerCase();

  if (normalized.includes('network') || normalized.includes('fetch')) {
    return '网络错误，请检查网络后重试';
  }

  if (normalized.includes('permission') || normalized.includes('rls') || normalized.includes('policy')) {
    return '无权限修改个人信息';
  }

  if (normalized.includes('session') || normalized.includes('jwt') || normalized.includes('token')) {
    return '会话已过期，请重新登录';
  }

  if (normalized.includes('check constraint')) {
    return '个人信息不符合保存规则，请检查输入';
  }

  return '保存失败，请稍后重试';
}

export function computeAgeFromBirthDate(birthDate, today = toLocalDateString()) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [by, bm, bd] = birthDate.split('-').map((item) => Number(item));
  const [ty, tm, td] = today.split('-').map((item) => Number(item));

  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function getTodayDateStringForInput() {
  return toLocalDateString();
}
