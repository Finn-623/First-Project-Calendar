import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import * as XLSX from 'xlsx';
import {
  PORTION_TYPES,
  buildLabels,
  normalizeText,
  portionPriority,
  semanticLabelKey
} from './portion-label-rules.mjs';

export const AUSNUT_PATH = '/Users/finn/Downloads/AUSNUT 2023 - Food measures.xlsx';
export const SELECTION_PATH = 'frontend/scripts/import-foods/dataset/afcd-initial-selection.json';
export const TRANSLATION_PATH = 'frontend/scripts/import-foods/dataset/food-name-translations.json';
export const OUTPUT_PATH = 'frontend/scripts/import-foods/dataset/food-portions.json';
export const AUDIT_PATH = 'frontend/scripts/import-foods/dataset/ausnut-portions-audit.json';

const COMMON_FOODS = {
  bread: 'F001463',
  rice: 'F007661',
  oats: 'F006143',
  pasta: 'F006456',
  potato: 'F007320',
  sweet_potato: 'F009034',
  corn: 'F003200',
  chicken_breast: 'F002594',
  beef: 'F000561',
  salmon: 'F007827',
  tuna: 'F009300',
  prawn: 'F007433',
  egg: 'F003729',
  milk: 'F005634',
  yoghurt: 'F009694',
  cheese: 'F002414',
  tofu: 'F009176',
  chickpeas: 'F002882',
  lentils: 'F005177',
  broccoli: 'F001905',
  tomato: 'F009193',
  carrot: 'F002276',
  apple: 'F000110',
  banana: 'F000262',
  orange: 'F006277',
  berries: 'F001290',
  almonds: 'F006081',
  peanuts: 'F006107',
  olive_oil: 'F006177',
  butter: 'F001971',
  sugar: 'F008976',
  soy_sauce: 'F008065',
  water: 'F009527',
  coffee: 'F003017',
  tea: 'F009125'
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sourceRow(row, rowNumber) {
  return {
    row_number: rowNumber,
    source_food_key: normalizeText(row['Public food key']),
    source_measure_id: normalizeText(row['Measure ID']),
    quantity: row.Quantity,
    descriptors: [
      row['Descriptor 1\r\n'],
      row['Descriptor 2'],
      row['Descriptor 3'],
      row['Descriptor 4\r\n']
    ].map(normalizeText),
    gram_amount: row['Gram amount'],
    volume_ml: row.Volume
  };
}

function initialDecision(row) {
  const grams = Number(row.gram_amount);
  const parsedVolume = Number(row.volume_ml);
  const volume = row.volume_ml === null
    || row.volume_ml === ''
    || !Number.isFinite(parsedVolume)
    ? null
    : parsedVolume;
  const descriptor = row.descriptors.join(' ').toLowerCase();
  if (!Number.isFinite(grams) || grams <= 0) return ['exclude', 'invalid_grams'];
  if (row.descriptors[0].toLowerCase() === 'density') {
    return ['exclude', 'density_record'];
  }
  if (/^(grams?|millilitres?)$/i.test(row.descriptors[0])) {
    return ['exclude', 'generic_weight_only'];
  }
  if (grams > 5000) return ['review', 'abnormal_weight'];
  if (volume !== null && volume > 5000) return ['review', 'abnormal_volume'];
  if (grams < 0.5 && !/(salt|spice|seasoning|teaspoon)/i.test(descriptor)) {
    return ['review', 'abnormal_weight'];
  }
  if (/not further defined|other|unknown|as surveyed/i.test(descriptor)) {
    return ['review', 'unclear_descriptor'];
  }
  return ['ready', null];
}

function makePortion(row) {
  // Descriptor 4 contains survey examples/brands in AUSNUT and is retained only
  // as provenance; it is not suitable for a user-facing portion label.
  const labels = buildLabels(row.quantity, row.descriptors.slice(0, 3));
  const sourceVolume = Number(row.volume_ml);
  if (
    labels.portion_type === 'container'
    && Number.isFinite(sourceVolume)
    && sourceVolume > 0
    && !/[()]|（/.test(labels.label_zh)
  ) {
    labels.label_en = `${labels.label_en} (${sourceVolume} mL)`;
    labels.label_zh = `${labels.label_zh}（${sourceVolume}毫升）`;
  }
  const [initialStatus, initialReason] = initialDecision(row);
  const reviewReasons = [];
  if (initialStatus === 'review') reviewReasons.push(initialReason);
  if (labels.unknown_terms.length) reviewReasons.push('uncertain_translation');
  const reviewStatus = reviewReasons.length ? 'needs_review' : 'ready';
  return {
    external_food_id: row.source_food_key,
    source_food_key: row.source_food_key,
    source_measure_id: row.source_measure_id,
    source_row_number: row.row_number,
    quantity: row.quantity,
    source_descriptors: row.descriptors,
    label_en: labels.label_en,
    label_zh: labels.label_zh,
    portion_type: labels.portion_type,
    grams: Number(row.gram_amount),
    volume_ml: row.volume_ml === null
      || row.volume_ml === ''
      || !Number.isFinite(Number(row.volume_ml))
      || Number(row.volume_ml) <= 0
      ? null
      : Number(row.volume_ml),
    is_default: false,
    review_status: reviewStatus,
    review_note: reviewStatus === 'needs_review'
      ? [...new Set(reviewReasons)].join('; ')
      : null
  };
}

function exactKey(portion) {
  return [
    portion.external_food_id,
    semanticLabelKey(portion),
    portion.grams,
    portion.volume_ml ?? ''
  ].join('|');
}

function nearKey(portion) {
  return [
    portion.external_food_id,
    portion.portion_type,
    portion.label_zh,
    Math.round(portion.grams * 10) / 10,
    portion.volume_ml === null ? '' : Math.round(portion.volume_ml * 10) / 10
  ].join('|');
}

function qualitySort(a, b) {
  return (
    (a.review_status === 'ready' ? 0 : 1) - (b.review_status === 'ready' ? 0 : 1)
    || portionPriority(a) - portionPriority(b)
    || b.source_descriptors.filter(Boolean).length - a.source_descriptors.filter(Boolean).length
    || a.grams - b.grams
    || a.source_measure_id.localeCompare(b.source_measure_id, 'en', { numeric: true })
  );
}

function addCount(counts, reason, amount = 1) {
  counts[reason] = (counts[reason] || 0) + amount;
}

export async function buildAusnutPortions() {
  const [selectionText, translationsText, workbookBuffer] = await Promise.all([
    readFile(SELECTION_PATH, 'utf8'),
    readFile(TRANSLATION_PATH, 'utf8'),
    readFile(AUSNUT_PATH)
  ]);
  const selection = JSON.parse(selectionText).selection;
  const translations = JSON.parse(translationsText);
  const workbook = XLSX.read(workbookBuffer, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['AUSNUT 2023'], {
    range: 2,
    defval: null
  });
  const rowsByFood = new Map();
  rows.forEach((row, index) => {
    const normalized = sourceRow(row, index + 3);
    if (!rowsByFood.has(normalized.source_food_key)) {
      rowsByFood.set(normalized.source_food_key, []);
    }
    rowsByFood.get(normalized.source_food_key).push(normalized);
  });

  const portionsByFood = {};
  const excludedCounts = {};
  const excludedRows = [];
  const duplicateGroups = [];
  const matchedButEmpty = [];
  let matchedRawRows = 0;
  let preDedupValidRows = 0;
  let exactDuplicateExcluded = 0;
  let semanticDuplicateExcluded = 0;
  let portionLimitExcluded = 0;

  for (const [id, selected] of Object.entries(selection)) {
    const rawRows = rowsByFood.get(id) || [];
    if (!rawRows.length) continue;
    matchedRawRows += rawRows.length;
    const candidates = [];
    const foodExcluded = [];
    for (const row of rawRows) {
      const [decision, reason] = initialDecision(row);
      if (decision === 'exclude') {
        addCount(excludedCounts, reason);
        const entry = { ...row, reason };
        excludedRows.push(entry);
        foodExcluded.push(entry);
        continue;
      }
      preDedupValidRows += 1;
      candidates.push(makePortion(row));
    }

    const exactSeen = new Map();
    const exactUnique = [];
    for (const portion of candidates.sort(qualitySort)) {
      const key = exactKey(portion);
      if (exactSeen.has(key)) {
        exactDuplicateExcluded += 1;
        addCount(excludedCounts, 'duplicate_exact');
        const entry = {
          source_food_key: id,
          source_measure_id: portion.source_measure_id,
          reason: 'duplicate_exact',
          retained_source_measure_id: exactSeen.get(key).source_measure_id
        };
        excludedRows.push(entry);
        foodExcluded.push(entry);
        continue;
      }
      exactSeen.set(key, portion);
      exactUnique.push(portion);
    }

    const nearSeen = new Map();
    const deduplicated = [];
    for (const portion of exactUnique) {
      const key = nearKey(portion);
      if (nearSeen.has(key)) {
        semanticDuplicateExcluded += 1;
        addCount(excludedCounts, 'duplicate_semantic');
        const retained = nearSeen.get(key);
        const entry = {
          source_food_key: id,
          source_measure_id: portion.source_measure_id,
          reason: 'duplicate_semantic',
          retained_source_measure_id: retained.source_measure_id
        };
        excludedRows.push(entry);
        foodExcluded.push(entry);
        duplicateGroups.push({
          external_food_id: id,
          kind: 'semantic',
          retained_source_measure_id: retained.source_measure_id,
          excluded_source_measure_id: portion.source_measure_id,
          label_zh: portion.label_zh,
          grams: portion.grams
        });
        continue;
      }
      nearSeen.set(key, portion);
      deduplicated.push(portion);
    }

    const labelGroups = new Map();
    for (const portion of deduplicated) {
      const key = semanticLabelKey(portion);
      if (!labelGroups.has(key)) labelGroups.set(key, []);
      labelGroups.get(key).push(portion);
    }
    for (const group of labelGroups.values()) {
      const distinctWeights = new Set(group.map((portion) => portion.grams));
      if (distinctWeights.size <= 1) continue;
      for (const portion of group) {
        portion.review_status = 'needs_review';
        portion.review_note = [
          portion.review_note,
          'conflicting_measure'
        ].filter(Boolean).join('; ');
      }
    }

    const ready = deduplicated.filter((portion) => portion.review_status === 'ready');
    const review = deduplicated.filter((portion) => portion.review_status === 'needs_review');
    const retainedReady = ready.slice(0, 6);
    for (const portion of ready.slice(6)) {
      portionLimitExcluded += 1;
      addCount(excludedCounts, 'portion_limit');
      const entry = {
        source_food_key: id,
        source_measure_id: portion.source_measure_id,
        reason: 'portion_limit'
      };
      excludedRows.push(entry);
      foodExcluded.push(entry);
    }
    const retained = [...retainedReady, ...review].sort(qualitySort);
    retained.forEach((portion, index) => {
      portion.is_default = index === 0;
    });
    if (retained.length) portionsByFood[id] = retained;
    else {
      matchedButEmpty.push({
        external_food_id: id,
        name_en: selected.name_en,
        name_zh: translations[id].name_zh,
        source_food_key: id,
        raw_measure_count: rawRows.length,
        excluded_measures: foodExcluded,
        final_reason: [...new Set(foodExcluded.map((item) => item.reason))].join('+')
      });
    }
  }

  const exactMatchedIds = Object.keys(selection).filter((id) => rowsByFood.has(id));
  const readyCount = Object.values(portionsByFood)
    .flat()
    .filter((portion) => portion.review_status === 'ready').length;
  const reviewCount = Object.values(portionsByFood)
    .flat()
    .filter((portion) => portion.review_status === 'needs_review').length;
  const commonFoods = Object.fromEntries(
    Object.entries(COMMON_FOODS).map(([label, id]) => {
      const sourceRows = rowsByFood.get(id) || [];
      const retained = portionsByFood[id] || [];
      return [label, {
        external_food_id: id,
        exact_key_match: sourceRows.length > 0,
        raw_measure_count: sourceRows.length,
        ready_count: retained.filter((item) => item.review_status === 'ready').length,
        needs_review_count: retained.filter((item) => item.review_status === 'needs_review').length,
        retained: retained.map((item) => ({
          source_measure_id: item.source_measure_id,
          label_zh: item.label_zh,
          grams: item.grams,
          review_status: item.review_status
        })),
        source_measures: sourceRows.map((row) => {
          const retainedPortion = retained.find(
            (item) => item.source_measure_id === row.source_measure_id
          );
          const exclusion = excludedRows.find(
            (item) =>
              item.source_food_key === id
              && item.source_measure_id === row.source_measure_id
          );
          return {
            source_measure_id: row.source_measure_id,
            quantity: row.quantity,
            descriptors: row.descriptors,
            gram_amount: row.gram_amount,
            volume_ml: row.volume_ml,
            label_en: retainedPortion?.label_en || null,
            label_zh: retainedPortion?.label_zh || null,
            portion_type: retainedPortion?.portion_type || null,
            review_status: retainedPortion?.review_status || null,
            decision: retainedPortion ? 'retained' : 'excluded',
            reason: retainedPortion?.review_note || exclusion?.reason || null
          };
        }),
        no_portion_reason: retained.length
          ? null
          : matchedButEmpty.find((item) => item.external_food_id === id)?.final_reason
            || 'no_exact_key_match'
      }];
    })
  );
  const finalTotal = readyCount + reviewCount;
  const similarGroups = Object.entries(portionsByFood)
    .flatMap(([id, foodPortions]) => {
      const byType = new Map();
      for (const portion of foodPortions) {
        if (!byType.has(portion.portion_type)) byType.set(portion.portion_type, []);
        byType.get(portion.portion_type).push(portion);
      }
      return [...byType.entries()]
        .filter(([, items]) => items.length > 1)
        .map(([portionType, items]) => ({
          external_food_id: id,
          portion_type: portionType,
          decision: 'kept_distinct',
          reason:
            'Different labels, sizes, preparation details, container volumes, or source weights remain distinct',
          items: items.map((item) => ({
            source_measure_id: item.source_measure_id,
            label_en: item.label_en,
            label_zh: item.label_zh,
            grams: item.grams,
            volume_ml: item.volume_ml
          }))
        }));
    });
  const audit = {
    source: {
      worksheet: 'AUSNUT 2023',
      data_rows: rows.length,
      valid_public_food_key_rows: rows.filter(
        (row) => normalizeText(row['Public food key'])
      ).length,
      grams_source: 'Gram amount column only',
      volume_policy: 'Volume is retained as source metadata and never used to calculate grams',
      input_sha256: sha256(workbookBuffer)
    },
    partition: {
      candidate_foods: Object.keys(selection).length,
      exact_key_match_foods: exactMatchedIds.length,
      unmatched_foods: Object.keys(selection).length - exactMatchedIds.length,
      matched_but_empty_foods: matchedButEmpty.length,
      foods_with_portions: Object.keys(portionsByFood).length,
      foods_without_portions:
        Object.keys(selection).length - Object.keys(portionsByFood).length
    },
    rows: {
      matched_raw_measure_rows: matchedRawRows,
      excluded_before_dedup: matchedRawRows - preDedupValidRows,
      pre_dedup_valid_rows: preDedupValidRows,
      duplicate_exact_excluded: exactDuplicateExcluded,
      duplicate_semantic_excluded: semanticDuplicateExcluded,
      portion_limit_excluded: portionLimitExcluded,
      ready: readyCount,
      needs_review: reviewCount,
      final_total: finalTotal
    },
    excluded_reason_counts: excludedCounts,
    review_note_counts: Object.values(portionsByFood)
      .flat()
      .filter((portion) => portion.review_note)
      .reduce((counts, portion) => {
        counts[portion.review_note] = (counts[portion.review_note] || 0) + 1;
        return counts;
      }, {}),
    matched_but_empty: matchedButEmpty,
    duplicate_groups: duplicateGroups,
    similar_groups_reviewed: similarGroups,
    common_foods: commonFoods,
    allowed_portion_types: PORTION_TYPES
  };
  return { portionsByFood, audit };
}

export async function generateAusnutPortions() {
  const { portionsByFood, audit } = await buildAusnutPortions();
  await Promise.all([
    writeFile(OUTPUT_PATH, `${JSON.stringify(portionsByFood, null, 2)}\n`),
    writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`)
  ]);
  return { portionsByFood, audit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateAusnutPortions()
    .then(({ audit }) => console.log(JSON.stringify(audit, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
