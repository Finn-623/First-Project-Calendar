#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const TARGET_PROJECT_REF = 'ragxhkzvaaoembqudnux';
const USERNAME_LOGIN_PATH = '/functions/v1/username-login';
const OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } };
const DISABLE_NOTE = 'AFCD client manual review: disabled by explicit user publication decision.';
const RESTORE_NOTE = 'AFCD client manual review: restored for client publication with confirmed display name.';

function makeClient(env, key) {
  return createClient(env.SUPABASE_URL, key, OPTIONS);
}

async function rows(query, label) {
  const result = await query;
  assert.ifError(result.error);
  assert.ok(Array.isArray(result.data), `${label} unavailable`);
  return result.data;
}

async function count(query, label) {
  const result = await query;
  assert.ifError(result.error);
  assert.equal(typeof result.count, 'number', `${label} count unavailable`);
  return result.count;
}

async function login(env, username, password) {
  const response = await fetch(`${env.SUPABASE_URL}${USERNAME_LOGIN_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
    body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
  });
  assert.equal(response.status, 200, 'username-login failed');
  const payload = await response.json();
  assert.ok(payload?.access_token && payload?.refresh_token);
  const result = makeClient(env, env.SUPABASE_ANON_KEY);
  const session = await result.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  assert.ifError(session.error);
  return result;
}

async function children(client, table, columns, ids) {
  const result = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    result.push(...await rows(client.from(table).select(columns).in('food_id', ids.slice(offset, offset + 50)), table));
  }
  return result;
}

for (const name of [
  'SUPABASE_URL', 'SUPABASE_PROJECT_REF', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY',
  'TEST_USERNAME', 'TEST_USER_PASSWORD', 'TEST_ADMIN_USERNAME', 'TEST_ADMIN_PASSWORD',
]) assert.ok(process.env[name], `${name} is required`);
assert.equal(process.env.SUPABASE_PROJECT_REF, TARGET_PROJECT_REF);
assert.equal((await readFile(resolve(ROOT, 'supabase/.temp/project-ref'), 'utf8')).trim(), TARGET_PROJECT_REF);

const actions = JSON.parse(await readFile(resolve(ROOT, 'docs/food-data-quality/manual-review/afcd-400-client-review-actions.json'), 'utf8'));
const packageFoods = JSON.parse(await readFile(resolve(ROOT, 'frontend/scripts/import-foods/dataset/public-foods-afcd-initial.json'), 'utf8'));
const packageById = new Map(packageFoods.map((food) => [food.external_food_id, food]));
const service = makeClient(process.env, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anonymous = makeClient(process.env, process.env.SUPABASE_ANON_KEY);
const ordinary = await login(process.env, process.env.TEST_USERNAME, process.env.TEST_USER_PASSWORD);
const admin = await login(process.env, process.env.TEST_ADMIN_USERNAME, process.env.TEST_ADMIN_PASSWORD);

try {
  const ordinaryRole = await ordinary.rpc('is_app_admin');
  const adminRole = await admin.rpc('is_app_admin');
  assert.ifError(ordinaryRole.error);
  assert.ifError(adminRole.error);
  assert.equal(ordinaryRole.data, false);
  assert.equal(adminRole.data, true);

  const foods = await rows(service.from('foods').select('*').eq('source_name', 'AFCD'), 'AFCD foods');
  assert.equal(foods.length, 400);
  const byExternal = new Map(foods.map((food) => [food.external_food_id, food]));
  assert.equal(byExternal.size, 400);
  assert.deepEqual(Object.fromEntries(['approved', 'pending', 'disabled'].map(
    (status) => [status, foods.filter((food) => food.review_status === status).length]
  )), { approved: 136, pending: 0, disabled: 264 });
  assert.ok(foods.every((food) => food.is_active === (food.review_status !== 'disabled')));
  for (const action of actions) {
    const food = byExternal.get(action.external_food_id);
    assert.ok(food);
    assert.equal(food.review_status, action.target_status, `status mismatch: ${action.external_food_id}`);
    assert.equal(food.name, action.final_chinese_name, `name mismatch: ${action.external_food_id}`);
    assert.equal(food.name, packageById.get(action.external_food_id).name_zh, `package mismatch: ${action.external_food_id}`);
  }

  const ids = foods.map((food) => food.id);
  const aliases = await children(service, 'food_public_aliases', 'id,food_id,alias', ids);
  const portions = await children(service, 'food_portions', 'id,food_id,portion_name,grams', ids);
  assert.equal(aliases.length, 100);
  assert.equal(portions.length, 501);
  assert.equal(new Set(aliases.map((row) => `${row.food_id}\0${row.alias.trim().toLocaleLowerCase()}`)).size, 100);
  assert.equal(new Set(portions.map((row) => `${row.food_id}\0${row.portion_name.trim().toLocaleLowerCase()}`)).size, 501);
  const known = new Set(ids);
  assert.ok(aliases.every((row) => known.has(row.food_id)));
  assert.ok(portions.every((row) => known.has(row.food_id) && Number(row.grams) > 0));

  const nutrientFields = [
    'energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fiber_g',
    'saturated_fat_g', 'monounsaturated_fat_g', 'polyunsaturated_fat_g', 'trans_fat_g',
    'total_sugar_g', 'added_sugar_g', 'sugar_alcohol_g', 'sodium_mg', 'potassium_mg',
  ];
  assert.equal(foods.filter((food) => nutrientFields.some((field) =>
    food[field] !== null && (!Number.isFinite(Number(food[field])) || Number(food[field]) < 0)
  )).length, 0);
  assert.equal(foods.filter((food) =>
    food.total_sugar_g !== null && Number(food.total_sugar_g) > Number(food.carbohydrate_g)
  ).length, 0);
  assert.equal(foods.filter((food) =>
    food.added_sugar_g !== null && Number(food.added_sugar_g) > Number(food.total_sugar_g)
  ).length, 0);

  const anonymousFoods = await rows(anonymous.from('foods').select('id').eq('source_name', 'AFCD'), 'anonymous foods');
  const ordinaryFoods = await rows(ordinary.from('foods').select('id').eq('source_name', 'AFCD'), 'ordinary foods');
  const adminFoods = await rows(admin.from('foods').select('id').eq('source_name', 'AFCD'), 'admin foods');
  assert.equal(anonymousFoods.length, 136);
  assert.equal(ordinaryFoods.length, 136);
  assert.equal(adminFoods.length, 400);
  const approvedIds = new Set(foods.filter((food) => food.review_status === 'approved').map((food) => food.id));
  const visibleAliases = await children(ordinary, 'food_public_aliases', 'id,food_id', ids);
  const visiblePortions = await children(ordinary, 'food_portions', 'id,food_id', ids);
  assert.equal(visibleAliases.length, 28);
  assert.equal(visiblePortions.length, 203);
  assert.ok(visibleAliases.every((row) => approvedIds.has(row.food_id)));
  assert.ok(visiblePortions.every((row) => approvedIds.has(row.food_id)));

  const totalEvents = await count(service.from('food_review_events').select('id', { count: 'exact', head: true }), 'review events');
  const disabledEvents = await count(service.from('food_review_events').select('id', { count: 'exact', head: true }).eq('review_note', DISABLE_NOTE), 'manual disable events');
  const restoredEvents = await count(service.from('food_review_events').select('id', { count: 'exact', head: true }).eq('review_note', RESTORE_NOTE), 'manual restore events');
  assert.equal(totalEvents, 664);
  assert.equal(disabledEvents, 263);
  assert.equal(restoredEvents, 1);
  const ordinaryEvents = await ordinary.from('food_review_events').select('id').limit(1);
  assert.ok(ordinaryEvents.error || ordinaryEvents.data.length === 0);
  const adminEvents = await rows(admin.from('food_review_events').select('id'), 'admin review events');
  assert.equal(adminEvents.length, 664);
  for (const [label, actor] of [['anonymous', anonymous], ['ordinary', ordinary], ['service', service]]) {
    const denied = await actor.rpc('review_public_foods', {
      p_food_ids: [byExternal.get('F004256').id], p_target_status: 'disabled', p_review_note: 'permission verification',
    });
    assert.ok(denied.error, `${label} unexpectedly called review RPC`);
  }

  assert.equal(await count(service.from('foods').select('id', { count: 'exact', head: true }), 'total foods'), 402);
  assert.equal(await count(service.from('foods').select('id', { count: 'exact', head: true }).is('source_name', null), 'legacy foods'), 2);
  assert.equal(await count(service.from('foods').select('id', { count: 'exact', head: true }).eq('visibility', 'private'), 'private foods'), 1);

  process.stdout.write(`${JSON.stringify({
    status: 'passed',
    foods: { total: 402, afcd: 400, approved: 136, pending: 0, disabled: 264, legacy: 2, private: 1 },
    review_events: { total: 664, manual_disable: 263, manual_restore: 1 },
    visibility: { anonymous_foods: 136, ordinary_foods: 136, admin_foods: 400, ordinary_aliases: 28, ordinary_portions: 203 },
    integrity: { aliases: 100, portions: 501, duplicate_foods: 0, duplicate_aliases: 0, duplicate_portions: 0, orphan_aliases: 0, orphan_portions: 0, invalid_nutrients: 0, sugar_violations: 0 },
    permissions: { ordinary_is_admin: false, admin_is_admin: true, anonymous_review_denied: true, ordinary_review_denied: true, service_review_denied: true, ordinary_events_hidden: true },
  }, null, 2)}\n`);
} finally {
  await Promise.all([ordinary.auth.signOut(), admin.auth.signOut()]);
}
