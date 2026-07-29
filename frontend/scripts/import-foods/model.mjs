export const ALLOWED_SOURCES = new Set(['AFCD', 'USDA']);
export const ALLOWED_INTAKE_TYPES = new Set([
  'carbohydrate',
  'protein',
  'fat',
  'fiber',
]);

export const NUTRIENT_FIELDS = [
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
];

export const CORE_NUTRIENT_FIELDS = [
  'energy_kcal',
  'protein_g',
  'carbohydrate_g',
  'fat_g',
  'fiber_g',
];

const MISSING_VALUES = new Set(['', '-', '—', 'na', 'n/a', 'null', 'unknown']);
const NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

export class FoodImportError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FoodImportError';
    this.code = code;
    this.details = details;
  }
}

export function cleanText(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

export function parseNullableNumber(value, field, factor = 1) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (MISSING_VALUES.has(text.toLowerCase())) return null;
  if (!NUMBER_PATTERN.test(text)) {
    throw new FoodImportError(
      'PARSE_ERROR',
      `${field} contains a value that cannot be safely parsed`,
      { field }
    );
  }

  const parsed = Number(text) * factor;
  if (!Number.isFinite(parsed)) {
    throw new FoodImportError('PARSE_ERROR', `${field} is not a finite number`, {
      field,
    });
  }
  return Number(parsed.toFixed(4));
}

function normalizeStringList(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const cleaned = cleanText(value);
    if (!cleaned) continue;
    const key = cleaned.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function normalizePortions(portions = []) {
  const seen = new Set();
  const result = [];
  for (const portion of Array.isArray(portions) ? portions : []) {
    const name = cleanText(portion?.name);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      name,
      grams: parseNullableNumber(portion?.grams, `portion:${name}:grams`),
      is_default: portion?.is_default === true,
    });
  }
  return result;
}

export function createImportFood(input) {
  const nutrients = {};
  for (const field of NUTRIENT_FIELDS) {
    nutrients[field] = parseNullableNumber(input[field], field);
  }

  return {
    source_name: cleanText(input.source_name)?.toUpperCase() || null,
    external_food_id: cleanText(input.external_food_id),
    name_zh: cleanText(input.name_zh),
    name_en: cleanText(input.name_en),
    brand: cleanText(input.brand),
    preparation_state: cleanText(input.preparation_state) || 'unspecified',
    category_primary: cleanText(input.category_primary),
    category_secondary: cleanText(input.category_secondary),
    intake_types: normalizeStringList(input.intake_types),
    ...nutrients,
    portions: normalizePortions(input.portions),
    aliases: normalizeStringList(input.aliases),
  };
}

export function validateImportFood(food) {
  const errors = [];
  const add = (code, message, field) => errors.push({ code, message, field });

  if (!food.source_name) add('MISSING_SOURCE', 'source_name is required', 'source_name');
  if (!food.external_food_id) {
    add('MISSING_EXTERNAL_ID', 'external_food_id is required', 'external_food_id');
  }
  if (!food.name_zh && !food.name_en) {
    add('MISSING_NAME', 'name_zh or name_en is required', 'name_zh');
  }
  if (!food.category_primary) {
    add('MISSING_CATEGORY', 'category_primary is required', 'category_primary');
  }
  if (!['raw', 'cooked', 'unspecified'].includes(food.preparation_state)) {
    add(
      'INVALID_PREPARATION_STATE',
      'preparation_state must be raw, cooked, or unspecified',
      'preparation_state'
    );
  }

  for (const field of CORE_NUTRIENT_FIELDS) {
    if (food[field] === null) {
      add('MISSING_CORE_NUTRIENT', `${field} is required for a new import`, field);
    }
  }
  for (const field of NUTRIENT_FIELDS) {
    if (food[field] !== null && food[field] < 0) {
      add('NEGATIVE_NUTRIENT', `${field} must not be negative`, field);
    }
  }

  if (
    food.total_sugar_g !== null
    && food.carbohydrate_g !== null
    && food.total_sugar_g > food.carbohydrate_g
  ) {
    add(
      'TOTAL_SUGAR_EXCEEDS_CARBOHYDRATE',
      'total_sugar_g must not exceed carbohydrate_g',
      'total_sugar_g'
    );
  }
  if (
    food.added_sugar_g !== null
    && food.total_sugar_g !== null
    && food.added_sugar_g > food.total_sugar_g
  ) {
    add(
      'ADDED_SUGAR_EXCEEDS_TOTAL',
      'added_sugar_g must not exceed total_sugar_g',
      'added_sugar_g'
    );
  }

  for (const intakeType of food.intake_types) {
    if (!ALLOWED_INTAKE_TYPES.has(intakeType)) {
      add(
        'INVALID_INTAKE_TYPE',
        `unsupported intake type: ${intakeType}`,
        'intake_types'
      );
    }
  }

  let defaultPortionCount = 0;
  for (const portion of food.portions) {
    if (portion.grams === null || portion.grams <= 0) {
      add(
        'INVALID_PORTION_GRAMS',
        `portion ${portion.name} must have grams greater than zero`,
        'portions'
      );
    }
    if (portion.is_default) defaultPortionCount += 1;
  }
  if (defaultPortionCount > 1) {
    add(
      'MULTIPLE_DEFAULT_PORTIONS',
      'only one portion may be the default',
      'portions'
    );
  }

  return errors;
}

export function importKey(food) {
  return `${food.source_name}\u0000${food.external_food_id}`;
}

export function safeRowSummary(row, externalFoodId = null) {
  return {
    external_food_id:
      cleanText(externalFoodId)
      || cleanText(row?.external_food_id)
      || cleanText(row?.fdcId)
      || cleanText(row?.food_id),
    name:
      cleanText(row?.name_zh)
      || cleanText(row?.name_en)
      || cleanText(row?.description)
      || cleanText(row?.food_name),
  };
}
