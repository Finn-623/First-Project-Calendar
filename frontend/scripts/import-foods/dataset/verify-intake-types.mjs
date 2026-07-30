import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  ALLOWED_INTAKE_TYPES,
  assignByRules
} from './intake-type-rules.mjs';
import { INTAKE_OVERRIDES } from './intake-type-overrides.mjs';
import {
  SOURCE_PATH,
  SELECTION_PATH,
  TRANSLATION_PATH,
  OUTPUT_PATH,
  buildIntakeAudit,
  buildIntakeTypes
} from './generate-intake-types.mjs';

const ALIASES_PATH =
  'frontend/scripts/import-foods/dataset/food-public-aliases.json';

const EXPECTED_CATEGORY_TOTALS = {
  grains_staples: 49,
  potatoes_starchy_vegetables: 25,
  meat_poultry: 50,
  fish_seafood: 35,
  eggs: 8,
  dairy: 32,
  legumes_soy: 25,
  vegetables: 65,
  fruits: 50,
  nuts_seeds: 20,
  oils_fats: 15,
  condiments_sauces: 18,
  beverages_non_alcoholic: 8,
  mixed_simple_foods: 0
};

const COMMON_FOOD_EXPECTATIONS = {
  rice: ['F007641', 'carbohydrate'],
  cooked_rice: ['F007661', 'carbohydrate'],
  bread: ['F001463', 'carbohydrate'],
  oats: ['F006143', 'carbohydrate'],
  pasta_noodles: ['F006456', 'carbohydrate'],
  potato: ['F007320', 'carbohydrate'],
  sweet_potato: ['F009034', 'carbohydrate'],
  corn: ['F003200', 'carbohydrate'],
  chicken_breast: ['F002594', 'protein'],
  beef: ['F000561', 'protein'],
  pork: ['F006899', 'protein'],
  lamb: ['F004929', 'protein'],
  salmon: ['F007827', 'protein'],
  tuna: ['F009300', 'protein'],
  prawn_shrimp: ['F007433', 'protein'],
  egg: ['F003729', 'protein'],
  egg_white: ['F003705', 'protein'],
  whole_milk: ['F005634', null],
  skim_milk: ['F005637', null],
  yoghurt: ['F009694', 'protein'],
  cheese: ['F002414', 'protein'],
  tofu: ['F009176', 'protein'],
  chickpeas: ['F002882', 'fiber'],
  lentils: ['F005177', 'fiber'],
  spinach: ['F008749', 'fiber'],
  broccoli: ['F001905', 'fiber'],
  tomato: ['F009193', null],
  carrot: ['F002276', 'fiber'],
  apple: ['F000110', 'fiber'],
  banana: ['F000262', 'carbohydrate'],
  berries: ['F001290', 'fiber'],
  almonds: ['F006081', 'fat'],
  peanuts: ['F006107', 'fat'],
  olive_oil: ['F006177', 'fat'],
  butter: ['F001971', 'fat'],
  salt: ['F007879', null],
  sugar: ['F008976', 'carbohydrate'],
  soy_sauce: ['F008065', null],
  water: ['F009527', null],
  coffee: ['F003017', null],
  tea: ['F009125', null]
};

const EXPECTED_EMPTY_IDS = new Set([
  'F007879',
  'F007878',
  'F009527',
  'F003017',
  'F009125',
  'F005696',
  'F009117',
  'F003041',
  'F004099',
  'F004114',
  'F008065'
]);

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function assertOrderedUnique(types, id) {
  assert.equal(new Set(types).size, types.length, `${id}: duplicate intake type`);
  assert.deepEqual(
    types,
    ALLOWED_INTAKE_TYPES.filter((type) => types.includes(type)),
    `${id}: intake types are not in canonical order`
  );
}

async function verify() {
  const [sourceText, selectionText, translationText, aliasesText, outputText] =
    await Promise.all([
      readFile(SOURCE_PATH, 'utf8'),
      readFile(SELECTION_PATH, 'utf8'),
      readFile(TRANSLATION_PATH, 'utf8'),
      readFile(ALIASES_PATH, 'utf8'),
      readFile(OUTPUT_PATH, 'utf8')
    ]);
  const inputHashes = {
    source: hash(sourceText),
    selection: hash(selectionText),
    translations: hash(translationText),
    aliases: hash(aliasesText)
  };
  const source = JSON.parse(sourceText);
  const selection = JSON.parse(selectionText).selection;
  const translations = JSON.parse(translationText);
  const intakeTypes = JSON.parse(outputText);
  const selectedIds = Object.keys(selection);
  const outputIds = Object.keys(intakeTypes);
  const sourceById = new Map(source.map((food) => [food.external_food_id, food]));

  assert.equal(selectedIds.length, 400);
  assert.equal(new Set(selectedIds).size, 400);
  assert.deepEqual(outputIds, selectedIds, 'output IDs/order must match selection');

  for (const id of selectedIds) {
    const sourceFood = sourceById.get(id);
    assert(sourceFood, `${id}: missing source food`);
    assert.equal(selection[id].name_en, sourceFood.name_en);
    assert.equal(typeof translations[id]?.name_zh, 'string');
    assert(translations[id].name_zh.trim(), `${id}: missing Chinese name`);
    assert(Array.isArray(intakeTypes[id]), `${id}: intake types must be an array`);
    assert(
      intakeTypes[id].every((type) => ALLOWED_INTAKE_TYPES.includes(type)),
      `${id}: invalid intake type`
    );
    assertOrderedUnique(intakeTypes[id], id);
  }

  const generatedA = buildIntakeTypes(source, selection);
  const generatedB = buildIntakeTypes(source, selection);
  assert.deepEqual(generatedA, intakeTypes, 'committed output is stale');
  assert.deepEqual(generatedB, generatedA, 'generation is not deterministic');

  for (const [id, override] of Object.entries(INTAKE_OVERRIDES)) {
    assert(selection[id], `${id}: override is not a selected food`);
    assert(Array.isArray(override.types));
    assertOrderedUnique(override.types, id);
    assert.equal(typeof override.reason, 'string');
    assert(override.reason.trim(), `${id}: override requires a reason`);
  }

  // A null value must remain unavailable to the rules, never be coerced to zero.
  assert.deepEqual(
    assignByRules(
      { protein_g: null, carbohydrate_g: null, fat_g: null, fiber_g: null },
      'grains_staples'
    ),
    []
  );

  const audit = buildIntakeAudit(source, selection, translations, intakeTypes);
  assert.equal(
    Object.values(audit.size_counts).reduce((sum, value) => sum + value, 0),
    400
  );
  assert.equal(
    Object.values(audit.combinations).reduce((sum, value) => sum + value, 0),
    400
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(EXPECTED_CATEGORY_TOTALS).map((category) => [
        category,
        audit.categories[category]?.total || 0
      ])
    ),
    EXPECTED_CATEGORY_TOTALS
  );

  for (const item of audit.empty) {
    assert(
      ['expected_empty', 'threshold_boundary'].includes(item.classification),
      `${item.external_food_id}: suspicious empty intake types`
    );
    assert(item.reason, `${item.external_food_id}: empty classification needs reason`);
    if (EXPECTED_EMPTY_IDS.has(item.external_food_id)) {
      assert.equal(item.classification, 'expected_empty');
    }
  }
  for (const item of audit.quadruple) {
    assert.equal(item.conclusion, 'reasonable');
    assert(
      [item.protein_g, item.carbohydrate_g, item.fat_g, item.fiber_g].every(
        (value) => typeof value === 'number'
      )
    );
  }

  const commonFoods = {};
  for (const [label, [id, requiredType]] of Object.entries(
    COMMON_FOOD_EXPECTATIONS
  )) {
    assert(selection[id], `${label}: expected representative ${id} is absent`);
    if (requiredType) {
      assert(
        intakeTypes[id].includes(requiredType),
        `${label}: ${id} must include ${requiredType}`
      );
    } else {
      assert.deepEqual(
        intakeTypes[id],
        [],
        `${label}: ${id} must not be forced into a main intake role`
      );
    }
    commonFoods[label] = {
      external_food_id: id,
      name_en: selection[id].name_en,
      intake_types: intakeTypes[id]
    };
  }

  const afterHashes = {
    source: hash(await readFile(SOURCE_PATH, 'utf8')),
    selection: hash(await readFile(SELECTION_PATH, 'utf8')),
    translations: hash(await readFile(TRANSLATION_PATH, 'utf8')),
    aliases: hash(await readFile(ALIASES_PATH, 'utf8'))
  };
  assert.deepEqual(afterHashes, inputHashes, 'stage 5 modified an input file');

  console.log(
    JSON.stringify(
      {
        status: 'passed',
        input_sha256_before_and_after: inputHashes,
        type_counts: audit.type_counts,
        size_counts: audit.size_counts,
        combinations: audit.combinations,
        top_10_combinations: Object.entries(audit.combinations).slice(0, 10),
        empty_count: audit.empty.length,
        empty_classifications: audit.empty.reduce((counts, item) => {
          counts[item.classification] =
            (counts[item.classification] || 0) + 1;
          return counts;
        }, {}),
        suspicious_empty_count: 0,
        empty_items: audit.empty,
        quadruple_items: audit.quadruple,
        rules_count: audit.rules_count,
        overrides_count: audit.overrides_count,
        category_distribution: audit.categories,
        common_foods: commonFoods
      },
      null,
      2
    )
  );
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
