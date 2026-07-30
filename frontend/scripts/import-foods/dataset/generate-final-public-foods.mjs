import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { reviewPortion } from './portion-review-rules.mjs';

export const SOURCE_PATH =
  '/Users/finn/Downloads/food-data-work/afcd-release-3.normalized.json';
export const SELECTION_PATH =
  'frontend/scripts/import-foods/dataset/afcd-initial-selection.json';
export const TRANSLATION_PATH =
  'frontend/scripts/import-foods/dataset/food-name-translations.json';
export const ALIASES_PATH =
  'frontend/scripts/import-foods/dataset/food-public-aliases.json';
export const INTAKE_TYPES_PATH =
  'frontend/scripts/import-foods/dataset/food-intake-types.json';
export const PORTIONS_PATH =
  'frontend/scripts/import-foods/dataset/food-portions.json';
export const PORTION_AUDIT_PATH =
  'frontend/scripts/import-foods/dataset/ausnut-portions-audit.json';
export const AUSNUT_PATH =
  '/Users/finn/Downloads/AUSNUT 2023 - Food measures.xlsx';
export const DECISIONS_PATH =
  'frontend/scripts/import-foods/dataset/portion-review-decisions.json';
export const OUTPUT_PATH =
  'frontend/scripts/import-foods/dataset/public-foods-afcd-initial.json';
export const AUDIT_PATH =
  'frontend/scripts/import-foods/dataset/public-foods-afcd-initial-audit.json';

export const INPUT_PATHS = [
  SELECTION_PATH,
  TRANSLATION_PATH,
  ALIASES_PATH,
  INTAKE_TYPES_PATH,
  PORTIONS_PATH,
  SOURCE_PATH,
  AUSNUT_PATH
];

const PRIORITY_REVIEW_FOODS = {
  oats: 'F006143',
  corn: 'F003200',
  tuna: 'F009300',
  prawn: 'F007433',
  yoghurt: 'F009694',
  broccoli: 'F001905',
  carrot: 'F002276',
  apple: 'F000110',
  banana: 'F000262',
  orange: 'F006277',
  berries: 'F001290',
  almonds: 'F006081',
  olive_oil: 'F006177',
  sugar: 'F008976',
  soy_sauce: 'F008065'
};

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function inputHashes() {
  return Object.fromEntries(
    await Promise.all(
      INPUT_PATHS.map(async (path) => [path, hash(await readFile(path))])
    )
  );
}

function decisionRecord(portion, food, translation, result) {
  return {
    external_food_id: portion.external_food_id,
    name_en: food.name_en,
    name_zh: translation.name_zh,
    source_food_key: portion.source_food_key,
    source_measure_id: portion.source_measure_id,
    original_label_en: portion.label_en,
    original_label_zh: portion.label_zh,
    grams: portion.grams,
    volume_ml: portion.volume_ml,
    original_review_note: portion.review_note,
    decision: result.decision,
    final_label_en: result.final_label_en || null,
    final_label_zh: result.final_label_zh || null,
    final_portion_type: result.final_portion_type || null,
    decision_reason: result.decision_reason
  };
}

export async function buildFinalPublicFoods() {
  const [
    source,
    selectionFile,
    translations,
    aliases,
    intakeTypes,
    portionsByFood,
    portionAudit
  ] = await Promise.all([
    readJson(SOURCE_PATH),
    readJson(SELECTION_PATH),
    readJson(TRANSLATION_PATH),
    readJson(ALIASES_PATH),
    readJson(INTAKE_TYPES_PATH),
    readJson(PORTIONS_PATH),
    readJson(PORTION_AUDIT_PATH)
  ]);
  const selection = selectionFile.selection;
  const sourceById = new Map(source.map((food) => [food.external_food_id, food]));
  const decisions = [];
  const approvedByMeasure = new Map();

  for (const [id, portions] of Object.entries(portionsByFood)) {
    const existingReady = portions.filter(
      (portion) => portion.review_status === 'ready'
    ).length;
    let capacity = Math.max(0, 6 - existingReady);
    for (const portion of portions.filter(
      (item) => item.review_status === 'needs_review'
    )) {
      const sourceFood = sourceById.get(id);
      const result = reviewPortion(portion);
      if (result.decision === 'approve' && capacity <= 0) {
        result.decision = 'exclude';
        result.final_label_en = null;
        result.final_label_zh = null;
        result.final_portion_type = null;
        result.decision_reason =
          '已有高优先级 ready 份量达到每食品最多 6 条限制';
      } else if (result.decision === 'approve') {
        capacity -= 1;
      }
      const decision = decisionRecord(
        portion,
        sourceFood,
        translations[id],
        result
      );
      decisions.push(decision);
      if (decision.decision === 'approve') {
        approvedByMeasure.set(decision.source_measure_id, decision);
      }
    }
  }

  const foods = Object.keys(selection).map((id) => {
    const sourceFood = sourceById.get(id);
    const selected = selection[id];
    const translation = translations[id];
    const sourcePortions = portionsByFood[id] || [];
    const finalPortions = sourcePortions
      .filter(
        (portion) =>
          portion.review_status === 'ready'
          || approvedByMeasure.has(portion.source_measure_id)
      )
      .map((portion, index) => {
        const approved = approvedByMeasure.get(portion.source_measure_id);
        const labelZh = approved?.final_label_zh || portion.label_zh;
        return {
          name: labelZh,
          grams: portion.grams,
          is_default: index === 0,
          source_food_key: portion.source_food_key,
          source_measure_id: portion.source_measure_id,
          label_en: approved?.final_label_en || portion.label_en,
          label_zh: labelZh,
          portion_type: approved?.final_portion_type || portion.portion_type,
          volume_ml: portion.volume_ml,
          review_source:
            portion.review_status === 'ready' ? 'stage_6_ready' : 'stage_7_approve'
        };
      });
    return {
      food_id: id,
      external_food_id: id,
      source_name: 'AFCD',
      source_food_key: id,
      name_en: sourceFood.name_en,
      name_zh: translation.name_zh,
      brand: null,
      preparation_state: sourceFood.preparation_state,
      category_primary: selected.category_primary,
      category_secondary: selected.category_secondary,
      intake_types: intakeTypes[id],
      energy_kcal: sourceFood.energy_kcal,
      protein_g: sourceFood.protein_g,
      carbohydrate_g: sourceFood.carbohydrate_g,
      fat_g: sourceFood.fat_g,
      fiber_g: sourceFood.fiber_g,
      saturated_fat_g: sourceFood.saturated_fat_g,
      monounsaturated_fat_g: sourceFood.monounsaturated_fat_g,
      polyunsaturated_fat_g: sourceFood.polyunsaturated_fat_g,
      trans_fat_g: sourceFood.trans_fat_g,
      total_sugar_g: sourceFood.total_sugar_g,
      added_sugar_g: sourceFood.added_sugar_g,
      sugar_alcohol_g: sourceFood.sugar_alcohol_g,
      sodium_mg: sourceFood.sodium_mg,
      potassium_mg: sourceFood.potassium_mg,
      aliases: aliases[id] || [],
      portions: finalPortions,
      review_status: 'pending',
      translation_status: translation.translation_status,
      data_package: 'afcd_initial_400'
    };
  });

  const decisionCounts = decisions.reduce(
    (counts, decision) => {
      counts[decision.decision] += 1;
      return counts;
    },
    { approve: 0, exclude: 0, defer: 0 }
  );
  const finalPortionCount = foods.reduce(
    (sum, food) => sum + food.portions.length,
    0
  );
  const translationReview = foods
    .filter((food) => food.translation_status === 'needs_review')
    .map((food) => ({
      external_food_id: food.external_food_id,
      name_en: food.name_en,
      name_zh: food.name_zh
    }));
  const audit = {
    package: 'AFCD initial public foods',
    review_status: 'pending',
    food_count: foods.length,
    source_identity_count: new Set(
      foods.map((food) => `${food.source_name}\u0000${food.external_food_id}`)
    ).size,
    aliases: {
      foods_with_aliases: foods.filter((food) => food.aliases.length > 0).length,
      total: foods.reduce((sum, food) => sum + food.aliases.length, 0)
    },
    intake_types: {
      carbohydrate: foods.filter((food) =>
        food.intake_types.includes('carbohydrate')).length,
      protein: foods.filter((food) =>
        food.intake_types.includes('protein')).length,
      fat: foods.filter((food) => food.intake_types.includes('fat')).length,
      fiber: foods.filter((food) => food.intake_types.includes('fiber')).length,
      empty: foods.filter((food) => food.intake_types.length === 0).length
    },
    portion_review: {
      original_needs_review: decisions.length,
      ...decisionCounts,
      not_imported: decisionCounts.exclude + decisionCounts.defer
    },
    portions: {
      original_ready: portionAudit.rows.ready,
      approved: decisionCounts.approve,
      final_ready: finalPortionCount,
      foods_with_portions: foods.filter((food) => food.portions.length > 0).length,
      foods_without_portions: foods.filter((food) => food.portions.length === 0).length
    },
    priority_food_review: Object.fromEntries(
      Object.entries(PRIORITY_REVIEW_FOODS).map(([label, id]) => {
        const foodDecisions = decisions.filter(
          (decision) => decision.external_food_id === id
        );
        const food = foods.find((item) => item.external_food_id === id);
        return [label, {
          external_food_id: id,
          approve: foodDecisions.filter((item) => item.decision === 'approve').length,
          exclude: foodDecisions.filter((item) => item.decision === 'exclude').length,
          defer: foodDecisions.filter((item) => item.decision === 'defer').length,
          final_portions: food.portions.map((portion) => ({
            label_zh: portion.label_zh,
            grams: portion.grams
          }))
        }];
      })
    ),
    translation_needs_review: translationReview,
    input_sha256: await inputHashes(),
    limitations: [
      'No Supabase write, RPC, migration, or deployment was executed',
      'All foods remain pending for administrator review',
      'Excluded and deferred portions are retained only in the decision audit'
    ]
  };
  return { decisions, foods, audit };
}

export async function generateFinalPublicFoods() {
  const { decisions, foods, audit } = await buildFinalPublicFoods();
  await Promise.all([
    writeFile(DECISIONS_PATH, `${JSON.stringify(decisions, null, 2)}\n`),
    writeFile(OUTPUT_PATH, `${JSON.stringify(foods, null, 2)}\n`),
    writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`)
  ]);
  return { decisions, foods, audit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateFinalPublicFoods()
    .then(({ audit }) => console.log(JSON.stringify(audit, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
