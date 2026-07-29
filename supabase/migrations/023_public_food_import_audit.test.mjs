import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('./023_public_food_import_audit.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('creates run and row-error audit structures with bounded statuses and counts', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.food_import_runs/);
  assert.match(sql, /status IN \('running', 'completed', 'partially_failed', 'failed'\)/);
  for (const field of [
    'source_name',
    'input_identifier',
    'total_count',
    'success_count',
    'skipped_count',
    'failed_count',
    'started_at',
    'completed_at',
    'created_by',
    'executor_role',
    'error_summary',
    'metadata',
  ]) {
    assert.match(sql, new RegExp(`\\b${field}\\b`));
  }

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.food_import_errors/);
  for (const field of [
    'import_run_id',
    'row_number',
    'external_food_id',
    'error_code',
    'error_message',
    'raw_summary',
  ]) {
    assert.match(sql, new RegExp(`\\b${field}\\b`));
  }
  assert.match(sql, /set_food_import_audit_identity/);
  assert.match(sql, /NEW\.created_by := auth\.uid\(\)/);
  assert.match(sql, /NEW\.executor_role := COALESCE\(auth\.role\(\), 'unknown'\)/);
});

test('ordinary and anonymous users cannot read or mutate import audit', () => {
  assert.match(sql, /ALTER TABLE public\.food_import_runs ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /ALTER TABLE public\.food_import_errors ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /food_import_runs_admin_all[\s\S]*is_app_admin\(auth\.uid\(\)\)/);
  assert.match(sql, /food_import_errors_admin_all[\s\S]*is_app_admin\(auth\.uid\(\)\)/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.food_import_runs FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.food_import_errors FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(sql, /TO anon[\s\S]*food_import_runs/);
});

test('service role retains controlled audit and import capability', () => {
  assert.match(sql, /GRANT ALL ON TABLE public\.food_import_runs TO service_role/);
  assert.match(sql, /GRANT ALL ON TABLE public\.food_import_errors TO service_role/);
  assert.match(sql, /caller_is_service BOOLEAN := auth\.role\(\) = 'service_role'/);
  assert.match(sql, /public food import requires administrator or service role/);
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.import_public_food_item\(UUID, JSONB, JSONB, JSONB\)[\s\S]*TO authenticated, service_role/
  );
});

test('atomic RPC writes pending public food, portions, and aliases together', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.import_public_food_item/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /INSERT INTO public\.foods/);
  assert.match(sql, /'public',[\s\S]*NULL,[\s\S]*display_name_value/);
  assert.match(sql, /'pending'/);
  assert.match(sql, /INSERT INTO public\.food_portions/);
  assert.match(sql, /INSERT INTO public\.food_public_aliases/);
  assert.match(sql, /EXCEPTION[\s\S]*WHEN unique_violation/);
  assert.match(sql, /five core nutrients are required for public import/);
});

test('source and external id drive skips without updating existing foods', () => {
  assert.match(
    sql,
    /WHERE visibility = 'public'[\s\S]*source_name = source_value[\s\S]*external_food_id = external_id_value/
  );
  assert.match(sql, /'status', 'skipped'/);
  assert.doesNotMatch(sql, /ON CONFLICT[\s\S]*DO UPDATE/);
  assert.doesNotMatch(sql, /UPDATE public\.foods/);
  assert.match(sql, /food source must match the import run source/);
  assert.match(sql, /status = 'running'/);
});

test('audit comments prohibit credentials and complete raw source rows', () => {
  assert.match(sql, /never store credentials/);
  assert.match(sql, /never store keys or authorization headers/);
  assert.match(sql, /not the complete source row/);
  assert.match(sql, /octet_length\(metadata::TEXT\) <= 16384/);
  assert.match(sql, /octet_length\(raw_summary::TEXT\) <= 4096/);
});
