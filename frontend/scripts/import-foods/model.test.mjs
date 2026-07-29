import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FoodImportError,
  createImportFood,
  parseNullableNumber,
  validateImportFood,
} from './model.mjs';

const validInput = {
  source_name: 'AFCD',
  external_food_id: 'one',
  name_zh: '测试食品',
  category_primary: '其他',
  preparation_state: 'unspecified',
  intake_types: ['protein'],
  energy_kcal: 100,
  protein_g: 10,
  carbohydrate_g: 5,
  fat_g: 2,
  fiber_g: 1,
};

test('standard model keeps unknown extended nutrients as null', () => {
  const food = createImportFood(validInput);
  assert.equal(food.saturated_fat_g, null);
  assert.equal(food.sodium_mg, null);
  assert.equal(food.potassium_mg, null);
  assert.equal(validateImportFood(food).length, 0);
});

test('unsafe numeric text is a parse error rather than zero', () => {
  assert.throws(
    () => parseNullableNumber('about 12', 'protein_g'),
    (error) => error instanceof FoodImportError && error.code === 'PARSE_ERROR'
  );
});

test('negative nutrient values are rejected', () => {
  const food = createImportFood({ ...validInput, fat_g: -1 });
  assert.ok(validateImportFood(food).some((error) => error.code === 'NEGATIVE_NUTRIENT'));
});

test('total and added sugar relationships are validated', () => {
  const food = createImportFood({
    ...validInput,
    carbohydrate_g: 10,
    total_sugar_g: 11,
    added_sugar_g: 12,
  });
  const codes = validateImportFood(food).map((error) => error.code);
  assert.ok(codes.includes('TOTAL_SUGAR_EXCEEDS_CARBOHYDRATE'));
  assert.ok(codes.includes('ADDED_SUGAR_EXCEEDS_TOTAL'));
});

test('invalid intake types are rejected', () => {
  const food = createImportFood({ ...validInput, intake_types: ['protein', 'vitamin'] });
  assert.ok(validateImportFood(food).some((error) => error.code === 'INVALID_INTAKE_TYPE'));
});

test('all five core nutrients are required for new imports', () => {
  const food = createImportFood({ ...validInput, fiber_g: null });
  assert.ok(
    validateImportFood(food).some(
      (error) => error.code === 'MISSING_CORE_NUTRIENT' && error.field === 'fiber_g'
    )
  );
});

test('portion grams must be positive and only one portion may be default', () => {
  const food = createImportFood({
    ...validInput,
    portions: [
      { name: '1个', grams: 0, is_default: true },
      { name: '1份', grams: 20, is_default: true },
    ],
  });
  const codes = validateImportFood(food).map((error) => error.code);
  assert.ok(codes.includes('INVALID_PORTION_GRAMS'));
  assert.ok(codes.includes('MULTIPLE_DEFAULT_PORTIONS'));
});

test('aliases and portion names are cleaned and deduplicated per food', () => {
  const food = createImportFood({
    ...validInput,
    aliases: [' 别名 ', '别名', '', 'Alias'],
    portions: [
      { name: ' 1杯 ', grams: 200 },
      { name: '1杯', grams: 250 },
    ],
  });
  assert.deepEqual(food.aliases, ['别名', 'Alias']);
  assert.deepEqual(food.portions, [{ name: '1杯', grams: 200, is_default: false }]);
});
