import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('./029_copy_public_food_to_personal.sql', import.meta.url), 'utf8');

test('copy RPC trusts auth.uid and only accepts approved active public foods', () => {
  assert.match(sql, /caller_id UUID := auth\.uid\(\)/);
  assert.match(sql, /visibility = 'public'[\s\S]*review_status = 'approved'[\s\S]*is_active = TRUE/);
  assert.doesNotMatch(sql, /p_user_id/);
});

test('copy RPC creates one private food linked to its public source', () => {
  assert.match(sql, /idx_foods_one_private_copy_per_public_source/);
  assert.match(sql, /caller_id, 'private'/);
  assert.match(sql, /source_food\.id, 'approved'/);
  assert.match(sql, /source_public_food_id = source_food\.id/);
  assert.match(sql, /already_exists', TRUE/);
});

test('copy RPC preserves nullable canonical nutrients and copies children atomically', () => {
  for (const field of ['energy_kcal', 'fiber_g', 'saturated_fat_g', 'total_sugar_g', 'sodium_mg', 'potassium_mg']) {
    assert.match(sql, new RegExp(`source_food\\.${field}`));
  }
  assert.match(sql, /INSERT INTO public\.food_private_aliases/);
  assert.match(sql, /INSERT INTO public\.food_portions/);
  assert.doesNotMatch(sql, /COALESCE\(source_food\.(?:fiber_g|total_sugar_g|sodium_mg|potassium_mg),\s*0/);
});

test('copy RPC is authenticated-only and service role cannot impersonate a user', () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.copy_public_food_to_personal/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.copy_public_food_to_personal\(UUID, TEXT\) TO authenticated/);
  assert.match(sql, /IF caller_id IS NULL THEN[\s\S]*authentication required/);
});
