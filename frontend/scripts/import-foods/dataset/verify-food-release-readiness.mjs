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

    // 15. Array check
    assert(Array.isArray(item.blocking_reasons), 'blocking_reasons should be an array');
    assert(Array.isArray(item.warning_reasons), 'warning_reasons should be an array');

    // 16. Action & Dimension status check
    assert(item.proposed_action, 'proposed_action should not be empty');
    assert(item.name_status, 'name_status should not be empty');
    assert(item.nutrition_status, 'nutrition_status should not be empty');
    assert(item.classification_status, 'classification_status should not be empty');
    assert(item.intake_type_status, 'intake_type_status should not be empty');
    assert(item.alias_status, 'alias_status should not be empty');

    // 17. Security check (extremely basic)
    const itemStr = JSON.stringify(item);
    assert(!itemStr.includes('password'), 'Should not contain password');
    assert(!itemStr.includes('secret'), 'Should not contain secret');
  }

  // 3. ID collection consistency
  const selectionIds = Object.keys(selection).sort();
  const readinessIds = Array.from(readinessMap.keys()).sort();
  assert.deepEqual(readinessIds, selectionIds, 'IDs mismatch with afcd-initial-selection.json');
  assert.deepEqual(readinessIds, Object.keys(translations).sort(), 'IDs mismatch with food-name-translations.json');
  assert.deepEqual(readinessIds, Object.keys(intakeTypes).sort(), 'IDs mismatch with food-intake-types.json');

  // 5. Total 400
  assert.equal(Object.values(stats).reduce((a, b) => a + b, 0), 400, 'Sum of stats should be 400');

  // 8. Every Ready name must be a release candidate.
  const readyNameIds = Object.entries(translations)
    .filter(([id, t]) => t.translation_status === 'ready')
    .map(([id, t]) => id);
  
  for (const id of readyNameIds) {
    const item = readinessMap.get(id);
    assert(item.final_status === 'release_ready' || item.final_status === 'release_ready_without_portion', 
      `Ready name food ${id} should be in release candidate, but is ${item.final_status}`);
  }

  // 9. Every name still awaiting review remains blocked.
  const needsReviewIds = Object.entries(translations)
    .filter(([id, t]) => t.translation_status === 'needs_review')
    .map(([id, t]) => id);
  
  for (const id of needsReviewIds) {
    const item = readinessMap.get(id);
    assert.equal(item.proposed_action, 'hold', `Needs review food ${id} should be held`);
    assert(item.blocking_reasons.includes('Name needs manual review (Stage 4 constraint)'), 
      `Needs review food ${id} should be blocked by name`);
  }

  // 11/12. Global portion stats
  const totalReadyPortions = readiness.reduce((a, b) => a + b.ready_portion_count, 0);
  const totalHeldPortions = readiness.reduce((a, b) => a + b.held_portion_count, 0);
  assert.equal(totalReadyPortions, 501, 'Total publishable portions mismatch');
  assert.equal(totalHeldPortions, 43, 'Total held portions mismatch');

  for (const id of ['F007827', 'F005634', 'F000262', 'F001905']) {
    assert.equal(readinessMap.get(id).proposed_action, 'approve', `${id} reviewed name should be ready`);
  }

  console.log('--- Verification Stats ---');
  console.log(stats);
  console.log('Portions Ready:', totalReadyPortions, 'Held:', totalHeldPortions);
  console.log('Stage 7 readiness verification passed.');
}

verify().catch(error => {
  console.error(error);
  process.exit(1);
});
