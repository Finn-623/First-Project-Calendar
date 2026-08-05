import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sql = fs.readFileSync(new URL('./033_permanent_delete_personal_food.sql', import.meta.url), 'utf8');

test('033 exposes authenticated permanent personal-food deletion RPC', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.delete_personal_food_permanently\(\s*p_food_id UUID/s);
  assert.match(sql, /caller_id UUID := auth\.uid\(\)/);
  assert.match(sql, /visibility = 'private'/);
  assert.match(sql, /user_id = caller_id/);
  assert.match(sql, /FROM public\.food_entries/);
  assert.match(sql, /historical records and cannot be permanently deleted/);
  assert.match(sql, /DELETE FROM public\.favorite_foods/);
  assert.match(sql, /DELETE FROM public\.food_private_aliases/);
  assert.match(sql, /DELETE FROM public\.food_portions/);
  assert.match(sql, /DELETE FROM public\.foods/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.delete_personal_food_permanently\(UUID\) TO authenticated/);
});

test('033 returns deleted marker only after the foods row delete', () => {
  assert.ok(sql.indexOf("DELETE FROM public.foods") < sql.indexOf("RETURN jsonb_build_object('deleted', TRUE"));
  assert.match(sql, /IF usage_count > 0 THEN[\s\S]*RAISE EXCEPTION/);
});
