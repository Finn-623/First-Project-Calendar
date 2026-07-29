import { readFile } from 'node:fs/promises';
import {
  FoodImportError,
  cleanText,
  createImportFood,
  parseNullableNumber,
} from './model.mjs';

const KJ_TO_KCAL = 1 / 4.184;

async function readJsonRows(inputPath) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch (error) {
    throw new FoodImportError('INPUT_READ_ERROR', `Unable to read JSON input: ${error.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new FoodImportError('INPUT_SHAPE_ERROR', 'Input JSON must contain an array');
  }
  return parsed;
}

function splitList(value) {
  if (Array.isArray(value)) return value;
  const text = cleanText(value);
  return text ? text.split(/[;,|]/).map((entry) => entry.trim()) : [];
}

function chooseEnergyKcal(kcal, kj) {
  const direct = parseNullableNumber(kcal, 'energy_kcal');
  if (direct !== null) return direct;
  return parseNullableNumber(kj, 'energy_kj', KJ_TO_KCAL);
}

export const afcdAdapter = {
  sourceName: 'AFCD',
  readRows: readJsonRows,
  adapt(row) {
    return createImportFood({
      source_name: 'AFCD',
      external_food_id: row.food_id,
      name_zh: row.name_zh,
      name_en: row.name_en || row.food_name,
      brand: row.brand,
      preparation_state: row.preparation_state,
      category_primary: row.category_primary,
      category_secondary: row.category_secondary,
      intake_types: splitList(row.intake_types),
      energy_kcal: chooseEnergyKcal(row.energy_kcal, row.energy_kj),
      protein_g: row.protein_g,
      carbohydrate_g: row.carbohydrate_g,
      fat_g: row.fat_g,
      fiber_g: row.fiber_g,
      saturated_fat_g: row.saturated_fat_g,
      monounsaturated_fat_g: row.monounsaturated_fat_g,
      polyunsaturated_fat_g: row.polyunsaturated_fat_g,
      trans_fat_g: row.trans_fat_g,
      total_sugar_g: row.total_sugar_g,
      added_sugar_g: row.added_sugar_g,
      sugar_alcohol_g: row.sugar_alcohol_g,
      sodium_mg: row.sodium_mg,
      potassium_mg: row.potassium_mg,
      portions: row.portions,
      aliases: row.aliases,
    });
  },
};

const USDA_NUTRIENT_MAP = new Map([
  ['energy', 'energy_kcal'],
  ['protein', 'protein_g'],
  ['carbohydrate, by difference', 'carbohydrate_g'],
  ['total lipid (fat)', 'fat_g'],
  ['fiber, total dietary', 'fiber_g'],
  ['fatty acids, total saturated', 'saturated_fat_g'],
  ['fatty acids, total monounsaturated', 'monounsaturated_fat_g'],
  ['fatty acids, total polyunsaturated', 'polyunsaturated_fat_g'],
  ['fatty acids, total trans', 'trans_fat_g'],
  ['sugars, total including nlea', 'total_sugar_g'],
  ['sugars, added', 'added_sugar_g'],
  ['sugar alcohol', 'sugar_alcohol_g'],
  ['sodium, na', 'sodium_mg'],
  ['potassium, k', 'potassium_mg'],
]);

function mapUsdaNutrients(foodNutrients = []) {
  const result = {};
  for (const entry of Array.isArray(foodNutrients) ? foodNutrients : []) {
    const name = cleanText(entry?.nutrient?.name)?.toLowerCase();
    const target = USDA_NUTRIENT_MAP.get(name);
    if (!target || result[target] !== undefined) continue;

    const unit = cleanText(entry?.nutrient?.unitName)?.toLowerCase();
    let factor = 1;
    if (target === 'energy_kcal' && unit === 'kj') factor = KJ_TO_KCAL;
    if ((target === 'sodium_mg' || target === 'potassium_mg') && unit === 'g') {
      factor = 1000;
    }
    result[target] = parseNullableNumber(entry.amount, target, factor);
  }
  return result;
}

export const usdaAdapter = {
  sourceName: 'USDA',
  readRows: readJsonRows,
  adapt(row) {
    const nutrients = mapUsdaNutrients(row.foodNutrients);
    return createImportFood({
      source_name: 'USDA',
      external_food_id: row.fdcId,
      name_zh: row.name_zh,
      name_en: row.description,
      brand: row.brandOwner || row.brandName,
      preparation_state: row.preparation_state,
      category_primary: row.category_primary || row.foodCategory?.description,
      category_secondary: row.category_secondary,
      intake_types: splitList(row.intake_types),
      ...nutrients,
      portions: row.portions,
      aliases: row.aliases,
    });
  },
};

export function getAdapter(source) {
  const normalized = cleanText(source)?.toUpperCase();
  if (normalized === 'AFCD') return afcdAdapter;
  if (normalized === 'USDA') return usdaAdapter;
  throw new FoodImportError('UNSUPPORTED_SOURCE', `Unsupported source: ${source}`);
}
