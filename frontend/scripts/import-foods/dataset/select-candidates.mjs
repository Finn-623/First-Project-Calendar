import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { AFCD_MAPPING, CATEGORIES, getCategory } from './category-mapping.mjs';
import { FOOD_OVERRIDES, getFoodOverride } from './food-category-overrides.mjs';

export const SOURCE_PATH =
  '/Users/finn/Downloads/food-data-work/afcd-release-3.normalized.json';
export const OUTPUT_PATH =
  'frontend/scripts/import-foods/dataset/afcd-initial-selection.json';

export const TARGETS = {
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

export const COMMON_FOODS = [
  ['rice', /^Rice,\s/i, 'F007641'],
  ['cooked rice', /^Rice,.*\b(boiled|cooked|rice cooker)\b/i, 'F007661'],
  ['bread', /^Bread(?:\s|,)/i, 'F001463'],
  ['oats', /^Oat(?:s|\s|,)/i, 'F006143'],
  ['pasta or noodles', /^(Pasta|Noodle),/i, 'F006456'],
  ['potato', /^Potato,/i, 'F007320'],
  ['sweet potato', /^Sweet potato,/i, 'F009034'],
  ['corn', /^Corn,/i, 'F003200'],
  ['chicken', /^Chicken,/i, 'F002594'],
  ['beef', /^Beef,/i, 'F000561'],
  ['pork', /^Pork,/i, 'F006899'],
  ['lamb', /^Lamb,/i, 'F004929'],
  ['salmon', /^Salmon,/i, 'F007827'],
  ['tuna', /^Tuna,/i, 'F009300'],
  ['prawn or shrimp', /^(Prawn|Shrimp),/i, 'F007433'],
  ['egg', /^Egg,/i, 'F003729'],
  ['milk', /^Milk,/i, 'F005634'],
  ['yogurt', /^Yogh?urt,/i, 'F009694'],
  ['cheese', /^Cheese,/i, 'F002414'],
  ['tofu', /^Tofu\b/i, 'F009176'],
  ['chickpeas', /^Chickpeas?,/i, 'F002882'],
  ['lentils', /^Lentils?,/i, 'F005177'],
  ['spinach', /^Spinach,/i, 'F008749'],
  ['broccoli', /^Broccoli,/i, 'F001905'],
  ['tomato', /^Tomato,/i, 'F009193'],
  ['carrot', /^Carrot,/i, 'F002276'],
  ['apple', /^Apple,/i, 'F000110'],
  ['banana', /^Banana,/i, 'F000262'],
  ['orange', /^Orange,/i, 'F006277'],
  ['berries', /^(Blackberry|Blueberry|Cranberry|Mulberry|Raspberry|Strawberry|Mixed berry),/i, 'F001290'],
  ['almonds', /\balmond\b/i, 'F006081'],
  ['peanuts', /\bpeanut\b/i, 'F006107'],
  ['olive oil', /\boil,\s*olive\b|\bolive oil\b/i, 'F006177'],
  ['butter', /^Butter,\s/i, 'F001971'],
  ['salt', /^Salt,\s/i, 'F007879'],
  ['sugar', /^Sugar,\s/i, 'F008976'],
  ['soy sauce', /^Sauce,\s*soy\b|\bsoy sauce\b/i, 'F008065'],
  ['water', /^Water,\s/i, 'F009527'],
  ['coffee', /^Coffee,\s/i, 'F003017'],
  ['tea', /^Tea,\s/i, 'F009125']
];

const REQUIRED_IDS = new Map(
  COMMON_FOODS.map(([, , id], index) => [id, COMMON_FOODS.length - index])
);
const ALCOHOL_PATTERN =
  /\b(alcoholic|beer|wine|spirit|cider|liqueur|sherry|port|vermouth|brandy|gin|rum|vodka|whisky|whiskey)\b/i;
const COMPLEX_PATTERN =
  /\b(cake|pizza|burger|casserole|lasagne|dessert|confectionery|muffin|doughnut|filled|coated|flavoured|sauce &|with sauce)\b/i;
const SPECIFIC_PATTERN =
  /\b(separable fat|untrimmed|fully-trimmed|forequarter|hindquarter|chump|cutlet|brand|fast food outlet|independent takeaway|added vitamins|omega-3|intense sweetened)\b/i;
const SIMPLE_PATTERN =
  /\b(raw|boiled|baked|steamed|grilled|fresh|plain|no added salt|no added fat|unsalted|natural)\b/i;

export function representativeScore(food) {
  let score = (REQUIRED_IDS.get(food.external_food_id) || 0) * 10000;
  if (SIMPLE_PATTERN.test(food.name_en)) score += 80;
  if (food.preparation_state === 'raw' || food.preparation_state === 'cooked') {
    score += 25;
  }
  if (food.source_derivation === 'Analysed') score += 10;
  if (COMPLEX_PATTERN.test(food.name_en) || COMPLEX_PATTERN.test(food.source_description || '')) {
    score -= 140;
  }
  if (SPECIFIC_PATTERN.test(food.name_en)) score -= 70;
  const commaSegments = food.name_en.split(',').length;
  score -= Math.max(0, commaSegments - 4) * 8;
  return score;
}

function compareRepresentative(a, b) {
  return (
    representativeScore(b) - representativeScore(a)
    || a.name_en.localeCompare(b.name_en, 'en')
    || a.external_food_id.localeCompare(b.external_food_id)
  );
}

function exclusionReason(food) {
  if (COMPLEX_PATTERN.test(food.name_en) || COMPLEX_PATTERN.test(food.source_description || '')) {
    return 'complex_recipe';
  }
  if (SPECIFIC_PATTERN.test(food.name_en)) return 'too_specific';
  if (food.name_en.split(',').length > 5) return 'duplicate_variant';
  if (/\b(borrowed|imputed)\b/i.test(food.source_derivation || '')) return 'uncommon';
  return 'category_quota';
}

function validateOverrides(dataById) {
  for (const override of Object.values(FOOD_OVERRIDES)) {
    const source = dataById.get(override.external_food_id);
    if (!source) throw new Error(`Override ID not found: ${override.external_food_id}`);
    if (
      source.name_en !== override.name_en
      || String(source.source_classification) !== override.source_classification
    ) {
      throw new Error(`Override identity mismatch: ${override.external_food_id}`);
    }
  }
}

function classificationStats(data) {
  const codes = new Set(data.map((food) => String(food.source_classification)));
  let mapped = 0;
  let excluded = 0;
  let needs_review = 0;
  for (const code of codes) {
    const category = AFCD_MAPPING[code] || 'needs_review';
    if (category === 'excluded') excluded += 1;
    else if (category === 'needs_review') needs_review += 1;
    else mapped += 1;
  }
  return { total: codes.size, mapped, needs_review, excluded };
}

function commonFoodReport(data, selection) {
  return COMMON_FOODS.map(([label, pattern, preferredId]) => {
    const matches = data.filter((food) => pattern.test(food.name_en));
    const chosen = selection[preferredId];
    return {
      label,
      source_match_count: matches.length,
      exists: matches.length > 0,
      external_food_id: chosen?.external_food_id || null,
      name_en: chosen?.name_en || null,
      category_primary: chosen?.category_primary || null,
      classification_method: chosen?.classification_method || null
    };
  });
}

const DUPLICATE_GROUPS = {
  beef: /^Beef,/i,
  pork: /^Pork,/i,
  lamb: /^Lamb,/i,
  chicken: /^Chicken,/i,
  rice: /^Rice,/i,
  bread: /^Bread(?:\s|,)/i,
  milk: /^Milk,/i,
  cheese: /^Cheese,/i,
  apple: /^Apple,/i,
  citrus: /^(Orange|Mandarin|Lemon|Lime|Grapefruit),/i,
  berries: /^(Blackberry|Blueberry|Cranberry|Mulberry|Raspberry|Strawberry|Mixed berry),/i
};

function duplicateGroupReport(data, selection, excludedById) {
  return Object.entries(DUPLICATE_GROUPS).map(([group, pattern]) => {
    const matches = data.filter((food) => pattern.test(food.name_en));
    const kept = matches.filter((food) => selection[food.external_food_id]);
    const reasons = {};
    for (const food of matches) {
      if (selection[food.external_food_id]) continue;
      const reason = excludedById.get(food.external_food_id) || 'needs_manual_review';
      reasons[reason] = (reasons[reason] || 0) + 1;
    }
    return {
      group,
      source_match_count: matches.length,
      selected_count: kept.length,
      excluded_count: matches.length - kept.length,
      representative_foods: kept.slice(0, 8).map((food) => ({
        external_food_id: food.external_food_id,
        name_en: food.name_en
      })),
      exclusion_reasons: reasons
    };
  });
}

export function buildSelection(data) {
  const dataById = new Map(data.map((food) => [food.external_food_id, food]));
  validateOverrides(dataById);

  const foodsByCategory = Object.fromEntries(
    Object.keys(TARGETS).map((category) => [category, []])
  );
  const needsReview = [];
  const excluded = [];
  const foodLevelStats = { mapped: 0, needs_review: 0, excluded: 0 };

  for (const food of data) {
    if (ALCOHOL_PATTERN.test(food.name_en)) {
      excluded.push({ id: food.external_food_id, reason: 'alcohol' });
      foodLevelStats.excluded += 1;
      continue;
    }

    let category = getCategory(food.source_classification, food.name_en);
    let method = 'classification_mapping';
    const override = getFoodOverride(food.external_food_id);
    if (override) {
      category = override.category_primary;
      method = 'food_level_override';
    }

    if (category === 'excluded') {
      excluded.push({ id: food.external_food_id, reason: 'uncommon' });
      foodLevelStats.excluded += 1;
    } else if (category === 'needs_review') {
      needsReview.push({
        id: food.external_food_id,
        reason: 'needs_manual_review',
        classification: food.source_classification
      });
      foodLevelStats.needs_review += 1;
    } else {
      foodsByCategory[category].push({
        ...food,
        category_primary: category,
        category_secondary: override?.category_secondary || null,
        classification_method: method
      });
      foodLevelStats.mapped += 1;
    }
  }

  const selection = {};
  const categoryStats = {};
  for (const [category, target] of Object.entries(TARGETS)) {
    const items = foodsByCategory[category].sort(compareRepresentative);
    if (items.length < target) {
      throw new Error(`${category} has ${items.length} eligible foods, requires ${target}`);
    }
    const selected = items.slice(0, target);
    categoryStats[category] = selected.length;
    for (const item of selected) {
      selection[item.external_food_id] = {
        external_food_id: item.external_food_id,
        name_en: item.name_en,
        category_primary: item.category_primary,
        category_secondary: item.category_secondary,
        preparation_state: item.preparation_state,
        source_classification: item.source_classification,
        selection_reason: REQUIRED_IDS.has(item.external_food_id)
          ? 'common_food_required'
          : 'representative_score',
        classification_method: item.classification_method,
        representative_score: representativeScore(item)
      };
    }
    for (const item of items.slice(target)) {
      excluded.push({ id: item.external_food_id, reason: exclusionReason(item) });
    }
  }

  const excludedById = new Map(excluded.map((entry) => [entry.id, entry.reason]));
  const exclusionReasonStats = {};
  for (const entry of [...excluded, ...needsReview]) {
    exclusionReasonStats[entry.reason] = (exclusionReasonStats[entry.reason] || 0) + 1;
  }

  return {
    selection,
    excluded,
    needsReview,
    audit: {
      targets: TARGETS,
      category_stats: categoryStats,
      preparation_stats: Object.values(selection).reduce(
        (stats, item) => {
          stats[item.preparation_state] += 1;
          return stats;
        },
        { raw: 0, cooked: 0, unspecified: 0 }
      ),
      classification_method_stats: Object.values(selection).reduce(
        (stats, item) => {
          stats[item.classification_method] += 1;
          return stats;
        },
        { classification_mapping: 0, food_level_override: 0 }
      ),
      classification_code_stats: classificationStats(data),
      food_level_stats: foodLevelStats,
      exclusion_reason_stats: exclusionReasonStats,
      common_foods: commonFoodReport(data, selection),
      duplicate_groups: duplicateGroupReport(data, selection, excludedById)
    }
  };
}

export async function selectCandidates({
  sourcePath = SOURCE_PATH,
  outputPath = OUTPUT_PATH
} = {}) {
  const data = JSON.parse(await readFile(sourcePath, 'utf8'));
  const result = buildSelection(data);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  selectCandidates()
    .then((result) => {
      console.log(JSON.stringify(result.audit, null, 2));
      console.log(`Final selected count: ${Object.keys(result.selection).length}`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
