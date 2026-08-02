import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function verify() {
  const selection = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/afcd-initial-selection.json', 'utf8')).selection;
  const translations = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/food-name-translations.json', 'utf8'));
  const intakeTypes = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/food-intake-types.json', 'utf8'));
  const finalFoods = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/public-foods-afcd-initial.json', 'utf8'));
  const portionDecisions = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/portion-review-decisions.json', 'utf8'));
  const readiness = JSON.parse(await readFile('frontend/scripts/import-foods/dataset/food-release-readiness.json', 'utf8'));
  const finalFoodMap = new Map(finalFoods.map((food) => [food.external_food_id, food]));

  // 1. Total count
  assert.equal(readiness.length, 400, 'Total foods should be 400');

  const readinessMap = new Map();
  const stats = {
    release_ready: 0,
    release_ready_without_portion: 0,
    needs_name_review: 0,
    needs_portion_review: 0,
    needs_data_review: 0,
    exclude_candidate: 0
  };

  const allowedStatuses = new Set(Object.keys(stats));

  for (const item of readiness) {
    // 2. Unique ID
    assert(!readinessMap.has(item.external_id), `Duplicate external_id: ${item.external_id}`);
    readinessMap.set(item.external_id, item);

    // 4. Allowed statuses
    assert(allowedStatuses.has(item.final_status), `Invalid status: ${item.final_status} for ${item.external_id}`);
    stats[item.final_status]++;

    // 6. Blocking reasons for ready
    if (item.final_status === 'release_ready' || item.final_status === 'release_ready_without_portion') {
      assert.equal(item.blocking_reasons.length, 0, `Ready food ${item.external_id} should have 0 blocking reasons`);
    } else {
      // 7. Other statuses must have reasons
      assert(item.blocking_reasons.length > 0, `Non-ready food ${item.external_id} must have blocking reasons`);
    }

    // 10. Portion counts
    const expectedReady = finalFoodMap.get(item.external_id)?.portions.length || 0;
    const expectedHeld = portionDecisions.filter(
      (decision) => decision.external_food_id === item.external_id && decision.decision !== 'approve'
    ).length;
    assert.equal(item.ready_portion_count, expectedReady, `Ready portion mismatch for ${item.external_id}`);
    assert.equal(item.held_portion_count, expectedHeld, `Held portion mismatch for ${item.external_id}`);
  }

  // Stats verification
  assert.equal(stats.release_ready, 217, `release_ready count mismatch, expected 217, got ${stats.release_ready}`);
  assert.equal(stats.release_ready_without_portion, 179, `release_ready_without_portion count mismatch, expected 179, got ${stats.release_ready_without_portion}`);
  assert.equal(stats.needs_name_review, 3, `needs_name_review count mismatch, expected 3, got ${stats.needs_name_review}`);
  assert.equal(stats.exclude_candidate, 1, `exclude_candidate count mismatch, expected 1, got ${stats.exclude_candidate}`);
  assert.equal(Object.values(stats).reduce((a, b) => a + b, 0), 400, 'Sum of stats should be 400');

  // 8. Every Ready name must be a release candidate, unless it is excluded.
  const readyNameIds = Object.entries(translations)
    .filter(([id, t]) => t.translation_status === 'ready')
    .map(([id, t]) => id);

  for (const id of readyNameIds) {
    const item = readinessMap.get(id);
    if (id === 'F004256') {
      assert.equal(item.final_status, 'exclude_candidate', `F004256 should be exclude_candidate`);
    } else {
      assert(item.final_status === 'release_ready' || item.final_status === 'release_ready_without_portion',
        `Ready name food ${id} should be in release candidate, but is ${item.final_status}`);
    }
  }

  // 9. Every name still awaiting review remains blocked.
  const needsReviewIds = Object.entries(translations)
    .filter(([id, t]) => t.translation_status === 'needs_review')
    .map(([id, t]) => id);

  for (const id of needsReviewIds) {
    const item = readinessMap.get(id);
    assert.equal(item.proposed_action, 'hold', `Needs review food ${id} should be held`);
    assert(item.blocking_reasons.length > 0, `Needs review food ${id} should be blocked`);
  }

  // F004256 specific assertions
  const f4256 = readinessMap.get('F004256');
  assert.equal(f4256.final_status, 'exclude_candidate');
  assert(f4256.blocking_reasons.length > 0);
  assert.notEqual(f4256.proposed_action, 'approve');

  // Specific needs_name_review assertions
  for (const id of ['F001884', 'F001885', 'F008359']) {
    const item = readinessMap.get(id);
    assert.equal(item.final_status, 'needs_name_review');
    assert(item.blocking_reasons.length > 0);
    assert.notEqual(item.proposed_action, 'approve');
  }

  console.log('--- Verification Stats ---');
  console.log(stats);
  console.log('Stage 7 readiness verification passed.');
}

verify().catch(error => {
  console.error(error);
  process.exit(1);
});
