import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('./025_block_disabled_food_entries.sql', import.meta.url),
  'utf8'
);

test('validates a food source only when a reference is assigned or changed', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.enforce_food_entry_source_available/);
  assert.match(sql, /BEFORE INSERT OR UPDATE OF source_food_id ON public\.food_entries/);
  assert.match(
    sql,
    /TG_OP = 'UPDATE'[\s\S]*NEW\.source_food_id IS NOT DISTINCT FROM OLD\.source_food_id[\s\S]*RETURN NEW/
  );
});

test('requires approved and active source food without role bypasses', () => {
  assert.match(sql, /review_status = 'approved'/);
  assert.match(sql, /is_active = TRUE/);
  assert.match(sql, /source food is not available for new entries/);
  assert.doesNotMatch(sql, /service_role[\s\S]*(bypass|RETURN NEW)/i);
  assert.doesNotMatch(sql, /is_app_admin/);
});

test('preserves nullable references and existing historical snapshots', () => {
  assert.match(sql, /IF NEW\.source_food_id IS NULL THEN[\s\S]*RETURN NEW/);
  assert.doesNotMatch(sql, /DELETE FROM public\.food_entries/);
  assert.doesNotMatch(sql, /UPDATE public\.food_entries/);
  assert.doesNotMatch(sql, /food_name_snapshot\s*:=/);
});
