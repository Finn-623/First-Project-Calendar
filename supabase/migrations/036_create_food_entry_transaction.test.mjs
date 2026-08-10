import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('./036_create_food_entry_transaction.sql', import.meta.url), 'utf8');

test('food record creation is one authenticated transaction with ownership from auth.uid', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_food_entry_for_meal/);
  assert.match(sql, /caller_id UUID := auth\.uid\(\)/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated/);
  assert.doesNotMatch(sql, /service_role/);
});

test('mutation id prevents duplicate food entries and default meals are locked', () => {
  assert.match(sql, /UNIQUE INDEX[\s\S]*user_id, client_mutation_id/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /ON CONFLICT \(user_id, client_mutation_id\)/);
  assert.match(sql, /meal_type IN \('breakfast', 'lunch', 'dinner'\)/);
});

test('record date, meal, quantity, source food, portion and snapshots are persisted', () => {
  for (const field of [
    'record_date', 'meal_type', 'source_food_id', 'food_name_snapshot', 'quantity',
    'unit_snapshot', 'calories_snapshot', 'protein_snapshot', 'fat_snapshot',
    'carbs_snapshot', 'portion_snapshot',
  ]) assert.match(sql, new RegExp(field));
});
