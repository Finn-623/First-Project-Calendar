import {
  PERSONAL_INFO_HEIGHT_MAX,
  PERSONAL_INFO_HEIGHT_MIN,
  PERSONAL_INFO_WEIGHT_MAX,
  PERSONAL_INFO_WEIGHT_MIN,
  buildPersonalInfoUpdatePayload,
  computeAgeFromBirthDate,
  getGenderLabel,
  normalizePersonalInfoFromProfile,
  validatePersonalInfo,
} from './personalInfoUtils';

describe('personalInfoUtils', () => {
  test('maps gender labels correctly', () => {
    expect(getGenderLabel('male')).toBe('男');
    expect(getGenderLabel('female')).toBe('女');
    expect(getGenderLabel('other')).toBe('其他');
    expect(getGenderLabel('prefer_not_to_say')).toBe('不愿透露');
    expect(getGenderLabel('')).toBe('未设置');
  });

  test('normalizes profile values and fallback fields', () => {
    const normalized = normalizePersonalInfoFromProfile({
      gender: 'male',
      birthday: '2000-01-01',
      height: '178',
      weight: '72.5',
    });

    expect(normalized).toEqual({
      gender: 'male',
      birthDate: '2000-01-01',
      heightCm: '178',
      weightKg: '72.5',
    });
  });

  test('future birth date should fail', () => {
    const result = validatePersonalInfo({
      gender: 'male',
      birthDate: '2099-01-01',
      heightCm: '170',
      weightKg: '60',
    }, '2026-07-26');

    expect(result.isValid).toBe(false);
    expect(result.errors.birthDate).toBe('生日不能晚于今天');
  });

  test('today birth date should pass', () => {
    const result = validatePersonalInfo({
      gender: '',
      birthDate: '2026-07-26',
      heightCm: '',
      weightKg: '',
    }, '2026-07-26');

    expect(result.isValid).toBe(true);
  });

  test('height lower than minimum fails', () => {
    const result = validatePersonalInfo({ gender: '', birthDate: '', heightCm: '49.9', weightKg: '' }, '2026-07-26');
    expect(result.isValid).toBe(false);
    expect(result.errors.heightCm).toBe('请输入 50-250 cm 之间的身高');
  });

  test('height at boundaries passes', () => {
    const low = validatePersonalInfo({ gender: '', birthDate: '', heightCm: String(PERSONAL_INFO_HEIGHT_MIN), weightKg: '' }, '2026-07-26');
    const high = validatePersonalInfo({ gender: '', birthDate: '', heightCm: String(PERSONAL_INFO_HEIGHT_MAX), weightKg: '' }, '2026-07-26');
    expect(low.isValid).toBe(true);
    expect(high.isValid).toBe(true);
  });

  test('height above maximum fails', () => {
    const result = validatePersonalInfo({ gender: '', birthDate: '', heightCm: '250.1', weightKg: '' }, '2026-07-26');
    expect(result.isValid).toBe(false);
    expect(result.errors.heightCm).toBe('请输入 50-250 cm 之间的身高');
  });

  test('weight lower than minimum fails', () => {
    const result = validatePersonalInfo({ gender: '', birthDate: '', heightCm: '', weightKg: '19.9' }, '2026-07-26');
    expect(result.isValid).toBe(false);
    expect(result.errors.weightKg).toBe('请输入 20-500 kg 之间的体重');
  });

  test('weight at boundaries passes', () => {
    const low = validatePersonalInfo({ gender: '', birthDate: '', heightCm: '', weightKg: String(PERSONAL_INFO_WEIGHT_MIN) }, '2026-07-26');
    const high = validatePersonalInfo({ gender: '', birthDate: '', heightCm: '', weightKg: String(PERSONAL_INFO_WEIGHT_MAX) }, '2026-07-26');
    expect(low.isValid).toBe(true);
    expect(high.isValid).toBe(true);
  });

  test('weight above maximum fails', () => {
    const result = validatePersonalInfo({ gender: '', birthDate: '', heightCm: '', weightKg: '500.1' }, '2026-07-26');
    expect(result.isValid).toBe(false);
    expect(result.errors.weightKg).toBe('请输入 20-500 kg 之间的体重');
  });

  test('build payload should only include allowed fields and changed values', () => {
    const output = buildPersonalInfoUpdatePayload(
      { gender: 'male', birthDate: '2000-01-01', heightCm: '175', weightKg: '70' },
      { gender: 'female', birthDate: '', heightCm: '175', weightKg: '72.5' }
    );

    expect(output.hasChanges).toBe(true);
    expect(output.payload).toEqual({
      gender: 'female',
      birth_date: null,
      weight_kg: 72.5,
    });
    expect(output.payload.role).toBeUndefined();
    expect(output.payload.account_status).toBeUndefined();
  });

  test('compute age should account for birthday not reached this year', () => {
    expect(computeAgeFromBirthDate('2000-08-15', '2026-07-26')).toBe(25);
    expect(computeAgeFromBirthDate('2000-07-01', '2026-07-26')).toBe(26);
  });
});
