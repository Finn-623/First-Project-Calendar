import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('./022_food_database_foundation.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('extends foods in place with identity, provenance, status and nutrient fields', () => {
  for (const column of [
    'name_en',
    'source_name',
    'external_food_id',
    'source_public_food_id',
    'review_status',
    'preparation_state',
    'primary_category',
    'secondary_category',
    'intake_types',
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
  ]) {
    assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`));
  }

  assert.match(sql, /review_status IN \('pending', 'approved', 'disabled'\)/);
  assert.match(sql, /intake_types <@ ARRAY\['carbohydrate', 'protein', 'fat', 'fiber'\]/);
  assert.match(sql, /source_public_food_id[\s\S]*REFERENCES public\.foods\(id\) ON DELETE RESTRICT/);
});

test('backfills legacy core nutrients without inventing missing fiber values', () => {
  assert.match(sql, /energy_kcal = COALESCE\(energy_kcal, calories\)/);
  assert.match(sql, /protein_g = COALESCE\(protein_g, protein\)/);
  assert.match(sql, /carbohydrate_g = COALESCE\(carbohydrate_g, carbs\)/);
  assert.match(sql, /fat_g = COALESCE\(fat_g, fat\)/);
  assert.doesNotMatch(sql, /fiber_g\s*=\s*COALESCE\(fiber_g,\s*0/);
  assert.match(sql, /NULL means unknown/);
});

test('enforces public source identity uniqueness only when both source fields exist', () => {
  assert.match(
    sql,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_public_source_external_unique[\s\S]*ON public\.foods\(source_name, external_food_id\)[\s\S]*WHERE visibility = 'public'[\s\S]*source_name IS NOT NULL[\s\S]*external_food_id IS NOT NULL/
  );
});

test('enforces nutrient nonnegative and sugar relationship constraints', () => {
  assert.match(sql, /foods_nutrients_nonnegative_check/);
  for (const nutrient of [
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
  ]) {
    assert.match(sql, new RegExp(`${nutrient} IS NULL OR ${nutrient} >= 0`));
  }
  assert.match(sql, /total_sugar_g <= carbohydrate_g/);
  assert.match(sql, /added_sugar_g <= total_sugar_g/);
});

test('creates positive portions and isolated public and private alias structures', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.food_portions/);
  assert.match(sql, /food_portions_grams_positive_check[\s\S]*grams > 0/);
  assert.match(sql, /idx_food_portions_one_default[\s\S]*WHERE is_default = TRUE/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.food_public_aliases/);
  assert.match(sql, /idx_food_public_aliases_food_alias_unique/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.food_private_aliases/);
  assert.match(sql, /idx_food_private_aliases_user_food_alias_unique/);
});

test('ordinary users can only read and mutate their own private foods', () => {
  assert.match(sql, /CREATE POLICY foods_select_own_private[\s\S]*visibility = 'private'[\s\S]*user_id = auth\.uid\(\)/);
  assert.match(sql, /CREATE POLICY foods_insert_own_private[\s\S]*visibility = 'private'[\s\S]*user_id = auth\.uid\(\)/);
  assert.match(sql, /CREATE POLICY foods_update_own_private[\s\S]*visibility = 'private'[\s\S]*user_id = auth\.uid\(\)/);
  assert.match(sql, /CREATE POLICY foods_delete_unreferenced_own_private[\s\S]*visibility = 'private'[\s\S]*user_id = auth\.uid\(\)/);
  assert.doesNotMatch(sql, /CREATE POLICY foods_delete_public_admin/);
});

test('existing visibility ownership constraint remains the food identity contract', async () => {
  const visibilitySql = await readFile(
    new URL('./003_food_library_visibility.sql', import.meta.url),
    'utf8'
  );

  assert.match(
    visibilitySql,
    /visibility = 'public' AND user_id IS NULL[\s\S]*visibility = 'private' AND user_id IS NOT NULL/
  );
  assert.doesNotMatch(sql, /DROP CONSTRAINT foods_visibility_user_id_consistency_check/);
});

test('approved public foods are default-readable while admins manage every public state', () => {
  assert.match(sql, /CREATE POLICY foods_select_approved_public[\s\S]*TO anon, authenticated[\s\S]*review_status = 'approved'[\s\S]*is_active = TRUE/);
  assert.match(sql, /CREATE POLICY foods_select_public_admin[\s\S]*visibility = 'public'[\s\S]*is_app_admin/);
  assert.match(sql, /CREATE POLICY foods_insert_public_admin[\s\S]*user_id IS NULL[\s\S]*is_app_admin/);
  assert.match(sql, /CREATE POLICY foods_update_public_admin[\s\S]*user_id IS NULL[\s\S]*is_app_admin/);
});

test('service role remains available for controlled imports and maintenance', () => {
  assert.doesNotMatch(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/);
});

test('private aliases are owner-isolated and public aliases are admin-managed', () => {
  assert.match(sql, /CREATE POLICY food_private_aliases_select_own[\s\S]*user_id = auth\.uid\(\)/);
  assert.match(sql, /CREATE POLICY food_private_aliases_insert_own[\s\S]*user_id = auth\.uid\(\)/);
  assert.match(sql, /CREATE POLICY food_private_aliases_update_own[\s\S]*user_id = auth\.uid\(\)/);
  assert.match(sql, /CREATE POLICY food_private_aliases_delete_own[\s\S]*user_id = auth\.uid\(\)/);
  assert.match(sql, /CREATE POLICY food_public_aliases_insert_admin[\s\S]*is_app_admin/);
  assert.match(sql, /CREATE POLICY food_public_aliases_update_admin[\s\S]*is_app_admin/);
  assert.match(sql, /CREATE POLICY food_public_aliases_delete_admin[\s\S]*is_app_admin/);
});

test('portion writes follow related food ownership or public-food admin permission', () => {
  for (const operation of ['insert', 'update', 'delete']) {
    assert.match(
      sql,
      new RegExp(
        `CREATE POLICY food_portions_${operation}_follow_food[\\s\\S]*foods\\.visibility = 'private'[\\s\\S]*foods\\.user_id = auth\\.uid\\(\\)[\\s\\S]*foods\\.visibility = 'public'[\\s\\S]*is_app_admin`
      )
    );
  }
});

test('referenced foods and ordinary public food deletes are rejected', () => {
  assert.match(sql, /prevent_referenced_food_delete/);
  assert.match(sql, /FROM public\.food_entries[\s\S]*source_food_id = OLD\.id/);
  assert.match(sql, /referenced foods must be disabled, not deleted/);
  assert.match(sql, /OLD\.visibility = 'public'[\s\S]*auth\.role\(\)[\s\S]*service_role/);
});

test('existing food entry and archive snapshots remain the historical contract', async () => {
  const initialSql = await readFile(new URL('./001_initial_schema.sql', import.meta.url), 'utf8');
  const archiveSql = await readFile(new URL('./020_auto_archive_transaction.sql', import.meta.url), 'utf8');

  assert.match(initialSql, /source_food_id UUID REFERENCES foods\(id\) ON DELETE SET NULL/);
  for (const snapshot of [
    'food_name_snapshot',
    'calories_snapshot',
    'protein_snapshot',
    'fat_snapshot',
    'carbs_snapshot',
  ]) {
    assert.match(initialSql, new RegExp(`${snapshot}\\b`));
    assert.match(archiveSql, new RegExp(`fe\\.${snapshot}\\b`));
  }
  assert.doesNotMatch(sql, /ALTER TABLE public\.food_entries[\s\S]*DROP COLUMN/);
  assert.doesNotMatch(sql, /ALTER TABLE public\.daily_archives[\s\S]*DROP COLUMN/);
});
