import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('./030_restore_inactive_personal_food_copy.sql', import.meta.url), 'utf8');

test('restore RPC keeps auth.uid security and approved active public source checks', () => {
  assert.match(sql, /caller_id UUID := auth\.uid\(\)/);
  assert.match(sql, /visibility = 'public'[\s\S]*review_status = 'approved'[\s\S]*is_active = TRUE/);
  assert.doesNotMatch(sql, /p_user_id/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.copy_public_food_to_personal/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.copy_public_food_to_personal\(UUID, TEXT\) TO authenticated/);
});

test('inactive existing copy is restored for the current owner and renamed', () => {
  assert.match(sql, /copied_food\.is_active = FALSE/);
  assert.match(sql, /SET is_active = TRUE,[\s\S]*name = final_name,[\s\S]*updated_by = caller_id/);
  assert.match(sql, /AND user_id = caller_id[\s\S]*AND visibility = 'private'/);
  assert.match(sql, /'restored', TRUE/);
});

test('active existing copy remains idempotent and restore does not duplicate children', () => {
  assert.match(sql, /'already_exists', TRUE/);
  assert.match(sql, /'restored', FALSE/);
  const restoreBlock = sql.slice(sql.indexOf('IF copied_food.is_active = FALSE'), sql.indexOf('END IF;', sql.indexOf('IF copied_food.is_active = FALSE')));
  assert.doesNotMatch(restoreBlock, /food_private_aliases|food_portions/);
  assert.match(sql, /INSERT INTO public\.food_private_aliases/);
  assert.match(sql, /INSERT INTO public\.food_portions/);
});

test('new copies preserve nullable nutrients and copy aliases and portions atomically', () => {
  for (const field of ['energy_kcal', 'fiber_g', 'saturated_fat_g', 'total_sugar_g', 'sodium_mg', 'potassium_mg']) {
    assert.match(sql, new RegExp(`source_food\\.${field}`));
  }
  assert.doesNotMatch(sql, /COALESCE\(source_food\.(?:fiber_g|total_sugar_g|sodium_mg|potassium_g),\s*0/);
});
