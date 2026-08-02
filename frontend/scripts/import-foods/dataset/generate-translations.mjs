import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  TRANSLATION_OVERRIDES,
  TRANSLATION_REVIEW_NOTES
} from './translation-overrides.mjs';
import { aliasesForTranslation, translateFoodName } from './translation-rules.mjs';

const SOURCE_PATH = '/Users/finn/Downloads/food-data-work/afcd-release-3.normalized.json';
const SELECTION_PATH = 'frontend/scripts/import-foods/dataset/afcd-initial-selection.json';
const TRANSLATION_PATH = 'frontend/scripts/import-foods/dataset/food-name-translations.json';
const ALIAS_PATH = 'frontend/scripts/import-foods/dataset/food-public-aliases.json';

async function readJson(path, fallback = {}) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export function buildTranslationData(source, selection, existing = {}) {
  const sourceById = new Map(source.map((food) => [food.external_food_id, food]));
  const translations = {};
  const aliases = {};

  for (const id of Object.keys(selection)) {
    const food = sourceById.get(id);
    if (!food) throw new Error(`Selected food missing from source: ${id}`);

    const manualExisting =
      existing[id]?.translation_source === 'manual' ? existing[id] : null;
    const configuredOverride = TRANSLATION_OVERRIDES[id];
    let generated;
    let translationSource = 'generated';
    if (manualExisting) {
      generated = manualExisting;
      translationSource = 'manual';
    } else if (configuredOverride) {
      generated = {
        name_zh: configuredOverride[0],
        translation_status: configuredOverride[1],
        translation_note: configuredOverride[2]
      };
      translationSource = 'manual_override';
    } else {
      generated = translateFoodName(food.name_en);
    }
    if (TRANSLATION_REVIEW_NOTES[id]) {
      generated = {
        ...generated,
        translation_status: 'needs_review',
        translation_note: TRANSLATION_REVIEW_NOTES[id]
      };
    }

    translations[id] = {
      external_food_id: id,
      name_en: food.name_en,
      name_zh: generated.name_zh,
      translation_status: generated.translation_status,
      translation_note: generated.translation_note,
      translation_source: translationSource
    };
    aliases[id] = aliasesForTranslation(translations[id]);
  }

  return { translations, aliases };
}

export async function generateTranslations() {
  const source = JSON.parse(await readFile(SOURCE_PATH, 'utf8'));
  const selection = JSON.parse(await readFile(SELECTION_PATH, 'utf8')).selection;
  const existing = await readJson(TRANSLATION_PATH);
  const { translations, aliases } = buildTranslationData(
    source,
    selection,
    existing
  );
  await writeFile(TRANSLATION_PATH, `${JSON.stringify(translations, null, 2)}\n`);
  await writeFile(ALIAS_PATH, `${JSON.stringify(aliases, null, 2)}\n`);
  return { translations, aliases };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateTranslations()
    .then(({ translations, aliases }) => {
      const statuses = Object.values(translations).reduce(
        (counts, item) => {
          counts[item.translation_status] += 1;
          return counts;
        },
        { ready: 0, needs_review: 0 }
      );
      console.log({
        translations: Object.keys(translations).length,
        aliases: Object.values(aliases).reduce((sum, values) => sum + values.length, 0),
        ...statuses
      });
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
