import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CATEGORIES } from './category-mapping.mjs';
import {
  buildSelection,
  COMMON_FOODS,
  SOURCE_PATH,
  TARGETS
} from './select-candidates.mjs';

const data = JSON.parse(await readFile(SOURCE_PATH, 'utf8'));
const sourceDigestBefore = createHash('sha256')
  .update(JSON.stringify(data))
  .digest('hex');
const first = buildSelection(data);
const second = buildSelection(data);
const selected = Object.values(first.selection);
const sourceById = new Map(data.map((food) => [food.external_food_id, food]));
const allowedCategories = new Set(
  Object.keys(CATEGORIES).filter((category) => !['excluded', 'needs_review'].includes(category))
);
const allowedReasons = new Set([
  'alcohol',
  'duplicate_variant',
  'too_specific',
  'uncommon',
  'unclear_identity',
  'complex_recipe',
  'category_quota',
  'needs_manual_review'
]);

assert.equal(selected.length, 400, 'candidate count');
assert.equal(new Set(selected.map((food) => food.external_food_id)).size, 400, 'unique IDs');
assert.equal(Object.values(first.audit.category_stats).reduce((a, b) => a + b, 0), 400);
assert.deepEqual(first.audit.category_stats, TARGETS);
assert.equal(Object.values(first.audit.preparation_stats).reduce((a, b) => a + b, 0), 400);
assert.equal(
  Object.values(first.audit.classification_method_stats).reduce((a, b) => a + b, 0),
  400
);
assert.ok(first.audit.category_stats.meat_poultry <= 55);

for (const food of selected) {
  assert.ok(sourceById.has(food.external_food_id), `source ID ${food.external_food_id}`);
  assert.ok(allowedCategories.has(food.category_primary), `category ${food.category_primary}`);
  assert.doesNotMatch(food.name_en, /\b(alcoholic|beer|wine|spirit|cider|liqueur)\b/i);
  const source = sourceById.get(food.external_food_id);
  assert.equal(food.name_en, source.name_en);
  assert.equal(food.preparation_state, source.preparation_state);
}

for (const entry of [...first.excluded, ...first.needsReview]) {
  assert.ok(allowedReasons.has(entry.reason), `exclusion reason ${entry.reason}`);
}

assert.deepEqual(first.audit.classification_code_stats.total, 277);
assert.equal(
  first.audit.classification_code_stats.mapped
    + first.audit.classification_code_stats.needs_review
    + first.audit.classification_code_stats.excluded,
  277
);
assert.equal(
  first.audit.food_level_stats.mapped
    + first.audit.food_level_stats.needs_review
    + first.audit.food_level_stats.excluded,
  1588
);
assert.equal(first.audit.common_foods.length, COMMON_FOODS.length);
for (const food of first.audit.common_foods) {
  assert.equal(food.exists, true, `${food.label} exists in AFCD`);
  assert.ok(food.external_food_id, `${food.label} selected`);
}

const digest = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(digest(first), digest(second), 'selection is deterministic');
assert.equal(
  createHash('sha256').update(JSON.stringify(data)).digest('hex'),
  sourceDigestBefore,
  'selection does not mutate official normalized records'
);

console.log(JSON.stringify(first.audit, null, 2));
console.log('Stage 3 verification passed.');
