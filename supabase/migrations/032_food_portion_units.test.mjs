import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('./032_food_portion_units.sql', import.meta.url), 'utf8');

assert.match(sql, /ALTER TABLE public\.food_portions[\s\S]*ALTER COLUMN grams DROP NOT NULL/);
assert.match(sql, /ADD COLUMN IF NOT EXISTS amount NUMERIC\(10, 2\)/);
assert.match(sql, /ADD COLUMN IF NOT EXISTS unit TEXT/);
assert.match(sql, /SET amount = grams[\s\S]*unit = 'g'/);
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.sync_food_portion_unit_defaults/);
assert.match(sql, /NEW\.amount := NEW\.grams/);
assert.match(sql, /CREATE TRIGGER sync_food_portion_unit_defaults/);
assert.match(sql, /unit IN \('g', 'ml'\)/);
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_personal_food/);
assert.match(sql, /portion_unit NOT IN \('g', 'ml'\)/);
assert.match(sql, /portion_unit = 'g'[\s\S]*portion_grams := portion_amount/);
assert.match(sql, /INSERT INTO public\.food_portions \(food_id, portion_name, amount, unit, grams, is_default\)/);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.save_personal_food[\s\S]*TO authenticated/);

console.log('032 food portion units contract passed');