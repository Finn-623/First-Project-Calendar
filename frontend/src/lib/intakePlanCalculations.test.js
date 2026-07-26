import { calculateIntakePlan, formatNumberByField } from './intakePlanCalculations';

describe('intakePlanCalculations', () => {
  test('calculates calories from protein/fat/carbs', () => {
    const result = calculateIntakePlan(
      { protein: 180, fat: 60, carbs: 185 },
      'calories'
    );

    expect(result.success).toBe(true);
    expect(result.data.calories).toBe(2000);
  });

  test('calculates protein from calories/fat/carbs', () => {
    const result = calculateIntakePlan(
      { calories: 2000, fat: 60, carbs: 185 },
      'protein'
    );

    expect(result.success).toBe(true);
    expect(result.data.protein).toBe(180);
  });

  test('calculates carbs from calories/protein/fat', () => {
    const result = calculateIntakePlan(
      { calories: 2000, protein: 180, fat: 60 },
      'carbs'
    );

    expect(result.success).toBe(true);
    expect(result.data.carbs).toBe(185);
  });

  test('calculates fat from calories/protein/carbs', () => {
    const result = calculateIntakePlan(
      { calories: 2000, protein: 180, carbs: 185 },
      'fat'
    );

    expect(result.success).toBe(true);
    expect(result.data.fat).toBe(60);
  });

  test('cannot calculate when two required values are missing', () => {
    const result = calculateIntakePlan(
      { protein: 180 },
      'calories'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('请输入三个目标值');
  });

  test('macro values keep one decimal while calories round to integer', () => {
    expect(formatNumberByField(2010.8, 'calories')).toBe('2011');
    expect(formatNumberByField(83.36, 'protein')).toBe('83.4');
  });
});
