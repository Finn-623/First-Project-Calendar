import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('./026_preserve_food_nutrient_precision.sql', import.meta.url),
  'utf8'
);

test('canonical imported nutrients retain four decimal places', () => {
  for (const field of [
    'energy_kcal',
    'protein_g',
    'carbohydrate_g',
    'fat_g',
    'fiber_g',
    'saturated_fat_g',
    'monounsaturated_fat_g',
    'polyunsaturated_fat_g',
    'trans_fat_g',
    'total_sugar_g',
    'added_sugar_g',
    'sugar_alcohol_g',
    'sodium_mg',
    'potassium_mg',
  ]) {
    assert.match(
      sql,
      new RegExp(`ALTER COLUMN ${field} TYPE NUMERIC\\(14, 4\\)`)
    );
  }
});

test('legacy and historical snapshot columns are not rewritten', () => {
  assert.doesNotMatch(sql, /ALTER COLUMN (calories|protein|fat|carbs) TYPE/);
  assert.doesNotMatch(sql, /food_entries/);
  assert.doesNotMatch(sql, /UPDATE public\.foods/);
});
