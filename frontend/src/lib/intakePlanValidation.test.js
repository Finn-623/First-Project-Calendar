import { hasIntakePlanChanged, validateIntakePlanDraft } from './intakePlanValidation';

describe('intakePlanValidation', () => {
  test('rejects negative numbers', () => {
    const result = validateIntakePlanDraft(
      { calories: '2000', protein: '180', fat: '-1', carbs: '185' },
      'carbs'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('请输入有效数值');
  });

  test('rejects NaN and Infinity style inputs', () => {
    const nanResult = validateIntakePlanDraft(
      { calories: 'abc', protein: '180', fat: '60', carbs: '185' },
      'carbs'
    );
    expect(nanResult.success).toBe(false);

    const infResult = validateIntakePlanDraft(
      { calories: 'Infinity', protein: '180', fat: '60', carbs: '185' },
      'carbs'
    );
    expect(infResult.success).toBe(false);
  });

  test('rejects when auto-calculated result is negative', () => {
    const result = validateIntakePlanDraft(
      { calories: '200', protein: '180', fat: '60', carbs: '185' },
      'carbs'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('自动计算结果不能小于 0，请调整其他目标');
  });

  test('returns normalized valid plan payload', () => {
    const result = validateIntakePlanDraft(
      { calories: '2000', protein: '180', fat: '60', carbs: '185' },
      'calories'
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      calories: 2000,
      protein: 180,
      fat: 60,
      carbs: 185,
      calculatedField: 'calories',
    });
  });

  test('change detection returns false when values are identical', () => {
    const prev = {
      calories: 2000,
      protein: 180,
      fat: 60,
      carbs: 185,
      calculatedField: 'calories',
    };

    expect(hasIntakePlanChanged(prev, prev)).toBe(false);
  });

  test('change detection returns true when calculated field changes', () => {
    const prev = {
      calories: 2000,
      protein: 180,
      fat: 60,
      carbs: 185,
      calculatedField: 'calories',
    };

    const next = {
      ...prev,
      calculatedField: 'protein',
    };

    expect(hasIntakePlanChanged(prev, next)).toBe(true);
  });
});
