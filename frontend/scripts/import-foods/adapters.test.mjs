import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { afcdAdapter, usdaAdapter } from './adapters.mjs';

const afcdFixture = fileURLToPath(new URL('./fixtures/afcd.sample.json', import.meta.url));
const usdaFixture = fileURLToPath(new URL('./fixtures/usda.sample.json', import.meta.url));

test('AFCD fixture maps identity, categories, portions, aliases, and nutrients', async () => {
  const rows = await afcdAdapter.readRows(afcdFixture);
  const food = afcdAdapter.adapt(rows[0]);
  assert.equal(food.source_name, 'AFCD');
  assert.equal(food.external_food_id, 'AFCD-TEST-001');
  assert.equal(food.name_zh, '测试燕麦');
  assert.equal(food.category_primary, '谷物与主食');
  assert.equal(food.portions.length, 2);
  assert.deepEqual(food.aliases, ['燕麦片', '测试燕麦']);
});

test('AFCD energy in kJ is converted to kcal per 100g', async () => {
  const rows = await afcdAdapter.readRows(afcdFixture);
  const food = afcdAdapter.adapt(rows[0]);
  assert.equal(food.energy_kcal, 372.8489);
});

test('USDA fixture maps FoodData Central nutrient names and identifiers', async () => {
  const rows = await usdaAdapter.readRows(usdaFixture);
  const food = usdaAdapter.adapt(rows[0]);
  assert.equal(food.source_name, 'USDA');
  assert.equal(food.external_food_id, '9990001');
  assert.equal(food.name_en, 'Test lentils, cooked');
  assert.equal(food.energy_kcal, 116);
  assert.equal(food.fiber_g, 7.9);
});

test('USDA sodium grams convert to milligrams while absent nutrients remain null', async () => {
  const rows = await usdaAdapter.readRows(usdaFixture);
  const food = usdaAdapter.adapt(rows[0]);
  assert.equal(food.sodium_mg, 2);
  assert.equal(food.monounsaturated_fat_g, null);
  assert.equal(food.added_sugar_g, null);
});
