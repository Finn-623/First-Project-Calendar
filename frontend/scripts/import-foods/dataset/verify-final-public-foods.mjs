import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afcdAdapter } from '../adapters.mjs';
import {
  ALLOWED_INTAKE_TYPES,
  NUTRIENT_FIELDS,
  validateImportFood
} from '../model.mjs';
import {
  ALIASES_PATH,
  AUDIT_PATH,
  DECISIONS_PATH,
  INTAKE_TYPES_PATH,
  OUTPUT_PATH,
  PORTIONS_PATH,
  SELECTION_PATH,
  SOURCE_PATH,
  TRANSLATION_PATH,
  buildFinalPublicFoods,
  inputHashes
} from './generate-final-public-foods.mjs';
import { PORTION_TYPES } from './portion-label-rules.mjs';

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function verify() {
  const hashesBefore = await inputHashes();
  const [
    source,
    selectionFile,
    translations,
    aliases,
    intakeTypes,
    stage6Portions,
    decisionsText,
    outputText,
    auditText
  ] = await Promise.all([
    json(SOURCE_PATH),
    json(SELECTION_PATH),
    json(TRANSLATION_PATH),
    json(ALIASES_PATH),
    json(INTAKE_TYPES_PATH),
    json(PORTIONS_PATH),
    readFile(DECISIONS_PATH, 'utf8'),
    readFile(OUTPUT_PATH, 'utf8'),
    readFile(AUDIT_PATH, 'utf8')
  ]);
  const selection = selectionFile.selection;
  const decisions = JSON.parse(decisionsText);
  const foods = JSON.parse(outputText);
  const audit = JSON.parse(auditText);
  const sourceById = new Map(source.map((food) => [food.external_food_id, food]));
  const selectedIds = Object.keys(selection);

  assert.equal(foods.length, 400);
  assert.equal(new Set(foods.map((food) => food.external_food_id)).size, 400);
  assert.deepEqual(foods.map((food) => food.external_food_id), selectedIds);
  assert.equal(decisions.length, 223);
  assert.equal(
    decisions.filter((decision) => decision.decision === 'approve').length
      + decisions.filter((decision) => decision.decision === 'exclude').length
      + decisions.filter((decision) => decision.decision === 'defer').length,
    223
  );
  assert(
    decisions.every(
      (decision) =>
        ['approve', 'exclude', 'defer'].includes(decision.decision)
        && decision.decision_reason
        && decision.source_measure_id
        && decision.original_review_note
    )
  );
  assert.equal(new Set(decisions.map((item) => item.source_measure_id)).size, 223);

  const originalReviews = Object.values(stage6Portions)
    .flat()
    .filter((portion) => portion.review_status === 'needs_review');
  assert.deepEqual(
    new Set(decisions.map((decision) => decision.source_measure_id)),
    new Set(originalReviews.map((portion) => portion.source_measure_id))
  );

  const finalMeasureIds = new Set();
  for (const food of foods) {
    const id = food.external_food_id;
    const sourceFood = sourceById.get(id);
    assert(sourceFood, `${id}: not in AFCD source`);
    assert.equal(food.food_id, id);
    assert.equal(food.source_name, 'AFCD');
    assert.equal(food.source_food_key, id);
    assert.equal(food.name_en, sourceFood.name_en);
    assert.equal(food.name_zh, translations[id].name_zh);
    assert.equal(food.category_primary, selection[id].category_primary);
    assert.equal(food.category_secondary, selection[id].category_secondary);
    assert.equal(food.preparation_state, sourceFood.preparation_state);
    assert.equal(food.review_status, 'pending');
    assert.equal(food.brand, null);
    assert.deepEqual(food.aliases, aliases[id] || []);
    assert.deepEqual(food.intake_types, intakeTypes[id]);
    assert(
      food.intake_types.every((type) => ALLOWED_INTAKE_TYPES.has(type))
    );
    assert.deepEqual(
      food.intake_types,
      ['carbohydrate', 'protein', 'fat', 'fiber'].filter((type) =>
        food.intake_types.includes(type)
      )
    );

    for (const field of NUTRIENT_FIELDS) {
      assert.equal(food[field], sourceFood[field], `${id}: ${field} changed`);
      assert(food[field] === null || Number.isFinite(food[field]));
    }
    for (const field of [
      'energy_kcal',
      'protein_g',
      'carbohydrate_g',
      'fat_g',
      'fiber_g'
    ]) {
      assert.notEqual(food[field], null, `${id}: ${field} is required`);
    }
    assert(food.total_sugar_g <= food.carbohydrate_g);
    assert(
      food.added_sugar_g === null
      || food.added_sugar_g <= food.total_sugar_g
    );

    assert(food.portions.length <= 6);
    assert.equal(
      food.portions.filter((portion) => portion.is_default).length,
      food.portions.length ? 1 : 0
    );
    const portionNames = new Set();
    for (const portion of food.portions) {
      assert(Number.isFinite(portion.grams) && portion.grams > 0);
      assert(
        portion.volume_ml === null
        || (Number.isFinite(portion.volume_ml) && portion.volume_ml > 0)
      );
      assert(portion.name && portion.label_en && portion.label_zh);
      assert(PORTION_TYPES.includes(portion.portion_type));
      assert.equal(portion.source_food_key, id);
      assert(portion.source_measure_id);
      assert(!finalMeasureIds.has(portion.source_measure_id));
      finalMeasureIds.add(portion.source_measure_id);
      assert(!portionNames.has(portion.name.toLowerCase()));
      portionNames.add(portion.name.toLowerCase());
      assert(['stage_6_ready', 'stage_7_approve'].includes(portion.review_source));
      if (portion.review_source === 'stage_7_approve') {
        assert(
          decisions.some(
            (decision) =>
              decision.source_measure_id === portion.source_measure_id
              && decision.decision === 'approve'
          )
        );
      }
    }

    const normalized = afcdAdapter.adapt(food);
    assert.deepEqual(validateImportFood(normalized), []);
    assert.equal(normalized.source_name, 'AFCD');
    assert.equal(normalized.external_food_id, id);
    assert.deepEqual(
      normalized.portions,
      food.portions.map(({ name, grams, is_default }) => ({
        name,
        grams,
        is_default
      }))
    );
    assert.deepEqual(normalized.aliases, food.aliases);
  }

  for (const decision of decisions.filter(
    (item) => item.decision !== 'approve'
  )) {
    assert(!finalMeasureIds.has(decision.source_measure_id));
    assert.equal(decision.final_label_en, null);
    assert.equal(decision.final_label_zh, null);
  }

  assert.equal(
    foods.filter((food) => food.translation_status === 'needs_review').length,
    3
  );
  assert.equal(audit.translation_needs_review.length, 3);
  assert.equal(audit.food_count, 400);
  assert.equal(audit.source_identity_count, 400);
  assert.deepEqual(audit.aliases, { foods_with_aliases: 73, total: 100 });
  assert.deepEqual(audit.intake_types, {
    carbohydrate: 154,
    protein: 173,
    fat: 98,
    fiber: 167,
    empty: 53
  });
  assert.equal(
    audit.portion_review.approve
      + audit.portion_review.exclude
      + audit.portion_review.defer,
    223
  );
  assert.equal(
    audit.portion_review.not_imported,
    audit.portion_review.exclude + audit.portion_review.defer
  );
  assert.equal(
    audit.portions.final_ready,
    foods.reduce((sum, food) => sum + food.portions.length, 0)
  );
  assert.equal(
    audit.portions.foods_with_portions
      + audit.portions.foods_without_portions,
    400
  );

  const generatedA = await buildFinalPublicFoods();
  const generatedB = await buildFinalPublicFoods();
  assert.equal(canonical(generatedA.decisions), decisionsText);
  assert.equal(canonical(generatedA.foods), outputText);
  assert.equal(canonical(generatedA.audit), auditText);
  assert.deepEqual(generatedB, generatedA);
  assert.deepEqual(await inputHashes(), hashesBefore);

  console.log(JSON.stringify({
    status: 'passed',
    input_sha256_before_and_after: hashesBefore,
    output_sha256: {
      decisions: hash(decisionsText),
      foods: hash(outputText),
      audit: hash(auditText)
    },
    audit
  }, null, 2));
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
