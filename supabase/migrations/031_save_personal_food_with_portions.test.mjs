import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sql = fs.readFileSync(new URL('./031_save_personal_food_with_portions.sql', import.meta.url), 'utf8');

test('031 saves personal food and portions in one security-definer RPC', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_personal_food/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /visibility = 'private'/);
  assert.match(sql, /user_id = caller_id/);
  assert.match(sql, /DELETE FROM public\.food_portions/);
  assert.match(sql, /INSERT INTO public\.food_portions/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.save_personal_food/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.save_personal_food[\s\S]*TO authenticated/);
});

test('031 validates names, positive grams, unique names and one default', () => {
  assert.match(sql, /food name is required/);
  assert.match(sql, /portion name is required/);
  assert.match(sql, /portion grams must be greater than zero/);
  assert.match(sql, /portion names must be unique/);
  assert.match(sql, /only one default portion is allowed/);
  assert.match(sql, /p_calories IS NULL OR p_calories < 0/);
});

test('031 keeps writes scoped to private foods and does not mutate entries', () => {
  assert.match(sql, /AND visibility = 'private'/);
  assert.doesNotMatch(sql, /food_entries/);
  assert.doesNotMatch(sql, /source_public_food_id\s*=/);
});
