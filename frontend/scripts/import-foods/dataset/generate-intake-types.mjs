import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  ALLOWED_INTAKE_TYPES,
  assignByRules,
  emptyAuditClassification
} from './intake-type-rules.mjs';
import {
  INTAKE_OVERRIDES,
  getIntakeOverride
} from './intake-type-overrides.mjs';

export const SOURCE_PATH =
  '/Users/finn/Downloads/food-data-work/afcd-release-3.normalized.json';
export const SELECTION_PATH =
  'frontend/scripts/import-foods/dataset/afcd-initial-selection.json';
export const TRANSLATION_PATH =
  'frontend/scripts/import-foods/dataset/food-name-translations.json';
export const OUTPUT_PATH =
  'frontend/scripts/import-foods/dataset/food-intake-types.json';

export function buildIntakeTypes(source, selection) {
  const sourceById = new Map(source.map((food) => [food.external_food_id, food]));
  const intakeTypes = {};
  for (const [id, selected] of Object.entries(selection)) {
    const food = sourceById.get(id);
    if (!food) throw new Error(`Selected food missing from AFCD source: ${id}`);
    const override = getIntakeOverride(id);
    intakeTypes[id] = override
      ? ALLOWED_INTAKE_TYPES.filter((type) => override.types.includes(type))
      : assignByRules(food, selected.category_primary);
  }
  return intakeTypes;
}

export function buildIntakeAudit(source, selection, translations, intakeTypes) {
  const sourceById = new Map(source.map((food) => [food.external_food_id, food]));
  const typeCounts = Object.fromEntries(
    ALLOWED_INTAKE_TYPES.map((type) => [type, 0])
  );
  const sizeCounts = { empty: 0, single: 0, double: 0, triple: 0, quadruple: 0 };
  const combinations = {};
  const empty = [];
  const quadruple = [];
  const categories = {};

  for (const [id, selected] of Object.entries(selection)) {
    const food = sourceById.get(id);
    const types = intakeTypes[id];
    for (const type of types) typeCounts[type] += 1;
    const sizeKey = ['empty', 'single', 'double', 'triple', 'quadruple'][types.length];
    sizeCounts[sizeKey] += 1;
    const combination = types.length ? types.join('+') : 'empty';
    combinations[combination] = (combinations[combination] || 0) + 1;

    if (!categories[selected.category_primary]) {
      categories[selected.category_primary] = {
        total: 0,
        carbohydrate: 0,
        protein: 0,
        fat: 0,
        fiber: 0,
        empty: 0,
        combinations: {}
      };
    }
    const category = categories[selected.category_primary];
    category.total += 1;
    for (const type of types) category[type] += 1;
    if (types.length === 0) category.empty += 1;
    category.combinations[combination] =
      (category.combinations[combination] || 0) + 1;

    if (types.length === 0) {
      empty.push({
        external_food_id: id,
        name_en: food.name_en,
        name_zh: translations[id].name_zh,
        category_primary: selected.category_primary,
        protein_g: food.protein_g,
        carbohydrate_g: food.carbohydrate_g,
        fat_g: food.fat_g,
        fiber_g: food.fiber_g,
        ...emptyAuditClassification(food, selected.category_primary)
      });
    }
    if (types.length === 4) {
      quadruple.push({
        external_food_id: id,
        name_en: food.name_en,
        name_zh: translations[id].name_zh,
        category_primary: selected.category_primary,
        protein_g: food.protein_g,
        carbohydrate_g: food.carbohydrate_g,
        fat_g: food.fat_g,
        fiber_g: food.fiber_g,
        generated_by: 'all four nutrient thresholds satisfied',
        conclusion: 'reasonable'
      });
    }
  }

  for (const category of Object.values(categories)) {
    category.most_common_combination = Object.entries(category.combinations)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'empty';
  }

  return {
    type_counts: typeCounts,
    size_counts: sizeCounts,
    combinations: Object.fromEntries(
      Object.entries(combinations).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    ),
    empty,
    quadruple,
    categories,
    rules_count: ALLOWED_INTAKE_TYPES.length * 2,
    overrides_count: Object.keys(INTAKE_OVERRIDES).length
  };
}

export async function generateIntakeTypes() {
  const source = JSON.parse(await readFile(SOURCE_PATH, 'utf8'));
  const selection = JSON.parse(await readFile(SELECTION_PATH, 'utf8')).selection;
  const translations = JSON.parse(await readFile(TRANSLATION_PATH, 'utf8'));
  const intakeTypes = buildIntakeTypes(source, selection);
  const audit = buildIntakeAudit(source, selection, translations, intakeTypes);
  await writeFile(OUTPUT_PATH, `${JSON.stringify(intakeTypes, null, 2)}\n`);
  return { intakeTypes, audit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateIntakeTypes()
    .then(({ audit }) => console.log(JSON.stringify(audit, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
