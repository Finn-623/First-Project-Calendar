import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import {
  AUSNUT_PATH,
  AUDIT_PATH,
  OUTPUT_PATH,
  SELECTION_PATH,
  TRANSLATION_PATH,
  buildAusnutPortions
} from './generate-ausnut-portions.mjs';
import { PORTION_TYPES, semanticLabelKey } from './portion-label-rules.mjs';

const INPUT_PATHS = [
  SELECTION_PATH,
  TRANSLATION_PATH,
  'frontend/scripts/import-foods/dataset/food-public-aliases.json',
  'frontend/scripts/import-foods/dataset/food-intake-types.json',
  '/Users/finn/Downloads/food-data-work/afcd-release-3.normalized.json',
  AUSNUT_PATH
];

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function hashes() {
  return Object.fromEntries(
    await Promise.all(
      INPUT_PATHS.map(async (path) => [path, hash(await readFile(path))])
    )
  );
}

function canonical(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function verify() {
  const before = await hashes();
  const [selectionText, outputText, auditText] = await Promise.all([
    readFile(SELECTION_PATH, 'utf8'),
    readFile(OUTPUT_PATH, 'utf8'),
    readFile(AUDIT_PATH, 'utf8')
  ]);
  const selection = JSON.parse(selectionText).selection;
  const portionsByFood = JSON.parse(outputText);
  const audit = JSON.parse(auditText);
  const selectedIds = new Set(Object.keys(selection));
  const portions = Object.values(portionsByFood).flat();
  const workbook = XLSX.read(await readFile(AUSNUT_PATH), { type: 'buffer' });
  const sourceRows = XLSX.utils.sheet_to_json(workbook.Sheets['AUSNUT 2023'], {
    range: 2,
    defval: null
  });
  const sourceByMeasureId = new Map(
    sourceRows.map((row) => [String(row['Measure ID']), row])
  );

  assert.equal(Object.keys(selection).length, 400);
  for (const [id, foodPortions] of Object.entries(portionsByFood)) {
    assert(selectedIds.has(id), `${id}: portion belongs to a non-candidate food`);
    assert(foodPortions.length > 0);
    assert.equal(foodPortions.filter((item) => item.is_default).length, 1);
    assert(
      foodPortions.filter((item) => item.review_status === 'ready').length <= 6,
      `${id}: more than six ready portions`
    );
    for (const portion of foodPortions) {
      assert.equal(portion.external_food_id, id);
      assert.equal(portion.source_food_key, id, `${id}: not an exact-key link`);
      assert(portion.source_measure_id, `${id}: missing source measure ID`);
      const source = sourceByMeasureId.get(portion.source_measure_id);
      assert(source, `${id}: source measure does not exist`);
      assert.equal(String(source['Public food key']), id);
      assert.equal(Number(source['Gram amount']), portion.grams);
      assert(Number.isFinite(portion.grams) && portion.grams > 0);
      assert(
        portion.volume_ml === null
        || (Number.isFinite(portion.volume_ml) && portion.volume_ml > 0)
      );
      assert(portion.label_en?.trim());
      assert(portion.label_zh?.trim());
      assert(PORTION_TYPES.includes(portion.portion_type));
      assert(['ready', 'needs_review'].includes(portion.review_status));
      if (portion.review_status === 'needs_review') {
        assert(portion.review_note?.trim(), `${id}: review note is required`);
      } else {
        assert.equal(portion.review_note, null);
      }
      assert(!/(\bundefined\b|\bnull\b|\bNaN\b|\(\s*\)|（\s*）)/i.test(portion.label_en));
      assert(!/(\bundefined\b|\bnull\b|\bNaN\b|\(\s*\)|（\s*）)/i.test(portion.label_zh));
      assert(
        !/^(1|100)\s*(g|gram|grams|millilitre|millilitres)$/i.test(
          portion.label_en
        ),
        `${id}: generic weight portion retained`
      );
    }
  }

  const exactKeys = new Set();
  for (const portion of portions) {
    const key = [
      portion.external_food_id,
      semanticLabelKey(portion),
      portion.grams,
      portion.volume_ml ?? ''
    ].join('|');
    assert(!exactKeys.has(key), `${portion.external_food_id}: exact duplicate`);
    exactKeys.add(key);
  }

  assert.equal(audit.source.data_rows, 9816);
  assert.equal(sourceRows.length, 9816);
  assert.equal(audit.source.valid_public_food_key_rows, 9816);
  assert.equal(audit.partition.candidate_foods, 400);
  assert.equal(
    audit.partition.exact_key_match_foods + audit.partition.unmatched_foods,
    400
  );
  assert.equal(
    audit.partition.foods_with_portions
      + audit.partition.matched_but_empty_foods,
    audit.partition.exact_key_match_foods
  );
  assert.equal(
    audit.partition.unmatched_foods
      + audit.partition.matched_but_empty_foods,
    audit.partition.foods_without_portions
  );
  assert.equal(
    audit.rows.excluded_before_dedup + audit.rows.pre_dedup_valid_rows,
    audit.rows.matched_raw_measure_rows
  );
  assert.equal(
    audit.rows.duplicate_exact_excluded
      + audit.rows.duplicate_semantic_excluded
      + audit.rows.portion_limit_excluded
      + audit.rows.final_total,
    audit.rows.pre_dedup_valid_rows
  );
  assert.equal(audit.rows.ready + audit.rows.needs_review, audit.rows.final_total);
  assert.equal(portions.length, audit.rows.final_total);
  assert.equal(Object.keys(portionsByFood).length, audit.partition.foods_with_portions);
  assert.equal(audit.matched_but_empty.length, audit.partition.matched_but_empty_foods);
  assert(
    audit.matched_but_empty.every(
      (item) =>
        item.raw_measure_count > 0
        && item.excluded_measures.length === item.raw_measure_count
        && item.excluded_measures.every((row) => row.reason)
        && item.final_reason
    )
  );
  assert(audit.similar_groups_reviewed.length >= 10);
  assert.equal(audit.source.grams_source, 'Gram amount column only');
  assert.match(audit.source.volume_policy, /never used to calculate grams/);

  const requiredCommon = Object.values(audit.common_foods);
  assert.equal(Object.keys(audit.common_foods).length, 35);
  assert(requiredCommon.every((item) => item.external_food_id));
  assert(
    requiredCommon.every(
      (item) =>
        item.raw_measure_count
        === item.source_measures.length
    )
  );
  assert(
    requiredCommon.every(
      (item) =>
        item.ready_count + item.needs_review_count === item.retained.length
    )
  );
  assert(audit.common_foods.bread.retained.some((item) => item.label_zh.includes('片')));
  assert(audit.common_foods.egg.retained.some((item) => item.label_zh.includes('个')));
  assert(audit.common_foods.milk.retained.some((item) => item.label_zh.includes('杯')));
  assert(audit.common_foods.butter.retained.some((item) => item.label_zh.includes('汤匙')));
  assert(audit.common_foods.sugar.retained.some((item) => item.label_zh.includes('杯')));
  assert(
    audit.common_foods.water.retained.length === 0
    || audit.common_foods.water.retained.some(
      (item) => item.label_zh.includes('瓶') || item.label_zh.includes('杯')
    )
  );

  // The generated result must be stable and exactly match both committed files.
  const generatedA = await buildAusnutPortions();
  const generatedB = await buildAusnutPortions();
  assert.equal(canonical(generatedA.portionsByFood), outputText);
  assert.equal(canonical(generatedA.audit), auditText);
  assert.deepEqual(generatedB, generatedA);
  assert.deepEqual(await hashes(), before, 'stage 6 modified an input file');

  console.log(JSON.stringify({
    status: 'passed',
    input_sha256_before_and_after: before,
    food_portions_sha256: hash(outputText),
    partition: audit.partition,
    rows: audit.rows,
    excluded_reason_counts: audit.excluded_reason_counts,
    matched_but_empty_reason_counts: audit.matched_but_empty.reduce(
      (counts, item) => {
        counts[item.final_reason] = (counts[item.final_reason] || 0) + 1;
        return counts;
      },
      {}
    ),
    duplicate_groups: audit.duplicate_groups,
    common_foods: audit.common_foods
  }, null, 2));
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
