#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const ACTIONS_PATH = resolve(ROOT, 'docs/food-data-quality/manual-review/afcd-400-client-review-actions.json');
const PACKAGE_PATH = resolve(ROOT, 'frontend/scripts/import-foods/dataset/public-foods-afcd-initial.json');
const PROJECT_REF_PATH = resolve(ROOT, 'supabase/.temp/project-ref');
const TARGET_PROJECT_REF = 'ragxhkzvaaoembqudnux';
const USERNAME_LOGIN_PATH = '/functions/v1/username-login';
const DISABLE_NOTE = 'AFCD client manual review: disabled by explicit user publication decision.';
const RESTORE_NOTE = 'AFCD client manual review: restored for client publication with confirmed display name.';
const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } };
const FINAL_NAMES = {
  F001905: '西兰花',
  F005599: '无乳糖全脂牛奶（约3.5%）',
  F005614: '低脂牛奶（约1%）',
  F000561: '瘦牛肉丁（生）',
  F004928: '瘦羊肉丁（生）',
};

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function canonical(value) {
  return String(value).trim().toLocaleLowerCase();
}

function client(url, key) {
  return createClient(url, key, CLIENT_OPTIONS);
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

async function loginWithUsername(env, username, password) {
  const response = await fetch(`${env.SUPABASE_URL}${USERNAME_LOGIN_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
    body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
  });
  assert.equal(response.status, 200, 'username-login failed');
  const payload = await response.json();
  assert.ok(payload?.access_token && payload?.refresh_token, 'username-login session incomplete');
  const result = client(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const session = await result.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  assert.ifError(session.error);
  return result;
}

function requiredEnvironment(env, execute) {
  for (const name of [
    'SUPABASE_URL', 'SUPABASE_PROJECT_REF', 'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY', 'TEST_USERNAME', 'TEST_USER_PASSWORD',
    'TEST_ADMIN_USERNAME', 'TEST_ADMIN_PASSWORD',
  ]) assert.ok(env[name], `${name} is required`);
  assert.equal(env.SUPABASE_PROJECT_REF, TARGET_PROJECT_REF, 'remote project ref mismatch');
  if (execute) assert.equal(env.CONFIRM_REMOTE_BATCH_IMPORT, 'true', 'remote execution confirmation missing');
}

async function snapshotHash(service) {
  const entries = await rows(service.from('food_entries').select(
    'id,food_name_snapshot,unit_snapshot,calories_snapshot,protein_snapshot,fat_snapshot,carbs_snapshot'
  ).order('id'), 'food entry snapshots');
  const archives = await rows(service.from('daily_archives').select(
    'id,timeline,totals'
  ).order('id'), 'archive snapshots');
  return { food_entries: hash(entries), daily_archives: hash(archives) };
}

async function loadChildren(service, table, columns, foodIds) {
  const result = [];
  for (let offset = 0; offset < foodIds.length; offset += 50) {
    result.push(...await rows(
      service.from(table).select(columns).in('food_id', foodIds.slice(offset, offset + 50)),
      table
    ));
  }
  return result;
}

async function baseline(env) {
  assert.equal(resolve(process.cwd()), ROOT, 'run from repository root');
  assert.equal((await readFile(PROJECT_REF_PATH, 'utf8')).trim(), TARGET_PROJECT_REF, 'linked project mismatch');
  const actions = JSON.parse(await readFile(ACTIONS_PATH, 'utf8'));
  const packageFoods = JSON.parse(await readFile(PACKAGE_PATH, 'utf8'));
  assert.equal(actions.length, 400);
  assert.equal(packageFoods.length, 400);
  assert.equal(new Set(actions.map((row) => row.external_food_id)).size, 400);
  assert.equal(actions.filter((row) => row.publish_decision === 'publish').length, 136);
  assert.equal(actions.filter((row) => row.publish_decision === 'disable').length, 264);
  assert.ok(actions.every((row) => row.publish_decision && row.final_chinese_name));
  assert.deepEqual(
    Object.fromEntries(Object.keys(FINAL_NAMES).map((id) => [id, actions.find((row) => row.external_food_id === id)?.final_chinese_name])),
    FINAL_NAMES
  );
  assert.deepEqual(
    Object.fromEntries(Object.keys(FINAL_NAMES).map((id) => [id, packageFoods.find((row) => row.external_food_id === id)?.name_zh])),
    FINAL_NAMES
  );

  const service = client(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const anonymous = client(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const ordinary = await loginWithUsername(env, env.TEST_USERNAME, env.TEST_USER_PASSWORD);
  const admin = await loginWithUsername(env, env.TEST_ADMIN_USERNAME, env.TEST_ADMIN_PASSWORD);
  const ordinaryRole = await ordinary.rpc('is_app_admin');
  const adminRole = await admin.rpc('is_app_admin');
  assert.ifError(ordinaryRole.error);
  assert.ifError(adminRole.error);
  assert.equal(ordinaryRole.data, false, 'ordinary account is administrator');
  assert.equal(adminRole.data, true, 'administrator role not confirmed server-side');

  const foods = await rows(service.from('foods').select('*').eq('source_name', 'AFCD'), 'AFCD foods');
  assert.equal(foods.length, 400);
  const byExternal = new Map(foods.map((food) => [food.external_food_id, food]));
  assert.equal(byExternal.size, 400);
  const currentCounts = Object.fromEntries(['approved', 'pending', 'disabled'].map(
    (status) => [status, foods.filter((food) => food.review_status === status).length]
  ));
  assert.deepEqual(currentCounts, { approved: 395, pending: 3, disabled: 2 });

  const groups = {
    disable_from_approved: actions.filter((row) => row.current_status === 'approved' && row.target_status === 'disabled'),
    disable_from_pending: actions.filter((row) => row.current_status === 'pending' && row.target_status === 'disabled'),
    restore_to_approved: actions.filter((row) => row.current_status === 'disabled' && row.target_status === 'approved'),
    keep_approved: actions.filter((row) => row.current_status === 'approved' && row.target_status === 'approved'),
    keep_disabled: actions.filter((row) => row.current_status === 'disabled' && row.target_status === 'disabled'),
  };
  assert.deepEqual(Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.length])), {
    disable_from_approved: 260, disable_from_pending: 3, restore_to_approved: 1,
    keep_approved: 135, keep_disabled: 1,
  });
  assert.equal(groups.restore_to_approved[0].external_food_id, 'F001905');
  assert.equal(groups.keep_disabled[0].external_food_id, 'F004256');
  for (const action of actions) {
    const remote = byExternal.get(action.external_food_id);
    assert.ok(remote, `remote food missing: ${action.external_food_id}`);
    assert.equal(remote.review_status, action.current_status, `remote status drift: ${action.external_food_id}`);
  }

  const foodIds = foods.map((food) => food.id);
  const aliases = await loadChildren(service, 'food_public_aliases', 'id,food_id,alias', foodIds);
  const portions = await loadChildren(service, 'food_portions', 'id,food_id,portion_name,grams', foodIds);
  assert.equal(aliases.length, 100);
  assert.equal(portions.length, 501);
  assert.equal(new Set(aliases.map((row) => `${row.food_id}\0${canonical(row.alias)}`)).size, 100);
  assert.equal(new Set(portions.map((row) => `${row.food_id}\0${canonical(row.portion_name)}`)).size, 501);
  const known = new Set(foodIds);
  assert.ok(aliases.every((row) => known.has(row.food_id)));
  assert.ok(portions.every((row) => known.has(row.food_id) && Number(row.grams) > 0));
  assert.equal(await count(service.from('food_review_events').select('id', { count: 'exact', head: true }), 'review events'), 400);

  const deniedId = byExternal.get('F004256').id;
  for (const [label, actor] of [['anonymous', anonymous], ['ordinary', ordinary], ['service', service]]) {
    const denied = await actor.rpc('review_public_foods', {
      p_food_ids: [deniedId], p_target_status: 'disabled', p_review_note: 'permission preflight',
    });
    assert.ok(denied.error, `${label} unexpectedly called review RPC`);
  }

  return {
    actions, foods, byExternal, groups, aliases, portions, service, anonymous, ordinary, admin,
    history: await snapshotHash(service),
    baselineNames: new Map(foods.map((food) => [food.external_food_id, food.name])),
    summary: {
      project_ref_matches: true,
      credentials: { ordinary_is_admin: false, admin_is_admin: true, service_review_rpc_denied: true },
      foods: currentCounts,
      aliases: aliases.length,
      portions: portions.length,
      review_events: 400,
      groups: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.length])),
    },
  };
}

function batchPlan(actions) {
  const sorted = [...actions].sort((a, b) => a.external_food_id.localeCompare(b.external_food_id));
  const batches = [];
  for (let offset = 0; offset < sorted.length; offset += 50) batches.push(sorted.slice(offset, offset + 50));
  return batches;
}

async function reviewBatch(admin, batch, target, note) {
  const response = await admin.rpc('review_public_foods', {
    p_food_ids: batch.map((row) => row.food_id), p_target_status: target, p_review_note: note,
  });
  assert.ifError(response.error);
  assert.deepEqual(
    { requested: response.data.requested, success: response.data.success, skipped: response.data.skipped, failed: response.data.failed },
    { requested: batch.length, success: batch.length, skipped: 0, failed: 0 }
  );
  return { requested: batch.length, success: batch.length, skipped: 0, failed: 0 };
}

async function execute(env, state) {
  const disableActions = [...state.groups.disable_from_approved, ...state.groups.disable_from_pending]
    .map((action) => ({ ...action, food_id: state.byExternal.get(action.external_food_id).id }));
  const batches = batchPlan(disableActions);
  assert.deepEqual(batches.map((batch) => batch.length), [50, 50, 50, 50, 50, 13]);
  const batchResults = [];
  for (const [index, batch] of batches.entries()) {
    const beforeEvents = await count(state.service.from('food_review_events').select('id', { count: 'exact', head: true }), 'review events');
    const result = await reviewBatch(state.admin, batch, 'disabled', DISABLE_NOTE);
    const afterEvents = await count(state.service.from('food_review_events').select('id', { count: 'exact', head: true }), 'review events');
    assert.equal(afterEvents - beforeEvents, batch.length, `batch ${index + 1} audit mismatch`);
    const changed = await rows(state.service.from('foods').select('external_food_id,review_status,is_active')
      .in('id', batch.map((row) => row.food_id)), `batch ${index + 1} foods`);
    assert.ok(changed.every((food) => food.review_status === 'disabled' && food.is_active === false));
    batchResults.push({ batch: index + 1, first: batch[0].external_food_id, last: batch.at(-1).external_food_id, ...result });
  }
  const middle = await rows(state.service.from('foods').select('review_status').eq('source_name', 'AFCD'), 'middle status');
  assert.deepEqual(Object.fromEntries(['approved', 'pending', 'disabled'].map(
    (status) => [status, middle.filter((food) => food.review_status === status).length]
  )), { approved: 135, pending: 0, disabled: 265 });

  const restoreAction = state.groups.restore_to_approved[0];
  const restore = await reviewBatch(state.admin, [{ ...restoreAction, food_id: state.byExternal.get('F001905').id }], 'approved', RESTORE_NOTE);

  const nameResults = [];
  for (const [externalId, finalName] of Object.entries(FINAL_NAMES)) {
    const food = state.byExternal.get(externalId);
    const result = await state.admin.from('foods').update({ name: finalName }).eq('id', food.id)
      .select('external_food_id,name,review_status');
    assert.ifError(result.error);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].name, finalName);
    nameResults.push({ external_food_id: externalId, previous_name: food.name, final_name: finalName, status: result.data[0].review_status });
  }

  const finalFoods = await rows(state.service.from('foods').select('*').eq('source_name', 'AFCD'), 'final AFCD foods');
  const finalByExternal = new Map(finalFoods.map((food) => [food.external_food_id, food]));
  const finalCounts = Object.fromEntries(['approved', 'pending', 'disabled'].map(
    (status) => [status, finalFoods.filter((food) => food.review_status === status).length]
  ));
  assert.deepEqual(finalCounts, { approved: 136, pending: 0, disabled: 264 });
  assert.equal(await count(state.service.from('food_review_events').select('id', { count: 'exact', head: true }), 'final review events'), 664);
  for (const [externalId, name] of Object.entries(FINAL_NAMES)) assert.equal(finalByExternal.get(externalId).name, name);
  for (const food of finalFoods) {
    if (!(food.external_food_id in FINAL_NAMES)) assert.equal(food.name, state.baselineNames.get(food.external_food_id), `unexpected name change: ${food.external_food_id}`);
  }

  const anonymousFoods = await rows(state.anonymous.from('foods').select('id').eq('source_name', 'AFCD'), 'anonymous foods');
  const ordinaryFoods = await rows(state.ordinary.from('foods').select('id').eq('source_name', 'AFCD'), 'ordinary foods');
  const adminFoods = await rows(state.admin.from('foods').select('id').eq('source_name', 'AFCD'), 'admin foods');
  assert.equal(anonymousFoods.length, 136);
  assert.equal(ordinaryFoods.length, 136);
  assert.equal(adminFoods.length, 400);
  const approvedIds = finalFoods.filter((food) => food.review_status === 'approved' && food.is_active).map((food) => food.id);
  const expectedVisibleAliases = state.aliases.filter((row) => approvedIds.includes(row.food_id)).length;
  const expectedVisiblePortions = state.portions.filter((row) => approvedIds.includes(row.food_id)).length;
  const ordinaryAliases = await loadChildren(state.ordinary, 'food_public_aliases', 'id,food_id', finalFoods.map((food) => food.id));
  const ordinaryPortions = await loadChildren(state.ordinary, 'food_portions', 'id,food_id', finalFoods.map((food) => food.id));
  assert.equal(ordinaryAliases.length, expectedVisibleAliases);
  assert.equal(ordinaryPortions.length, expectedVisiblePortions);
  assert.ok(ordinaryAliases.every((row) => approvedIds.includes(row.food_id)));
  assert.ok(ordinaryPortions.every((row) => approvedIds.includes(row.food_id)));

  assert.deepEqual(await snapshotHash(state.service), state.history, 'historical snapshots changed');
  assert.equal(await count(state.service.from('foods').select('id', { count: 'exact', head: true }), 'total foods'), 402);
  assert.equal(await count(state.service.from('foods').select('id', { count: 'exact', head: true }).is('source_name', null), 'legacy foods'), 2);
  assert.equal(await count(state.service.from('foods').select('id', { count: 'exact', head: true }).eq('visibility', 'private'), 'private foods'), 1);
  assert.equal(state.aliases.length, 100);
  assert.equal(state.portions.length, 501);

  return {
    batches: batchResults,
    restore,
    names: nameResults,
    final: {
      statuses: finalCounts,
      review_events: 664,
      visible_foods: { anonymous: 136, ordinary: 136, admin: 400 },
      aliases: { total: 100, ordinary_visible: expectedVisibleAliases },
      portions: { total: 501, ordinary_visible: expectedVisiblePortions, held_not_imported: 43 },
      history_snapshots_unchanged: true,
      total_foods: 402,
      legacy_foods: 2,
      private_foods: 1,
    },
  };
}

const mode = process.argv[2] || '--preflight';
assert.ok(['--preflight', '--execute'].includes(mode), 'use --preflight or --execute');
const executeMode = mode === '--execute';
requiredEnvironment(process.env, executeMode);
const state = await baseline(process.env);
const disablePlan = batchPlan([...state.groups.disable_from_approved, ...state.groups.disable_from_pending]);
const output = {
  mode: executeMode ? 'execute' : 'preflight',
  preflight: state.summary,
  batches: disablePlan.map((batch, index) => ({
    batch: index + 1, count: batch.length,
    first: batch[0].external_food_id, last: batch.at(-1).external_food_id,
  })),
};
if (executeMode) output.execution = await execute(process.env, state);
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
await Promise.all([state.ordinary.auth.signOut(), state.admin.auth.signOut()]);
