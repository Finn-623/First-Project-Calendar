import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { runFoodImport } from './importer.mjs';
import { createSupabaseImportRepository } from './repository.mjs';

function localSupabaseEnvironment() {
  const output = execFileSync(
    'npx',
    ['--no-install', 'supabase', 'status', '-o', 'env'],
    { cwd: new URL('../../../', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(?:"(.*)"|(.*))$/);
    if (match) values[match[1]] = match[2] ?? match[3];
  }

  const supabaseUrl = values.API_URL;
  const anonKey = values.ANON_KEY;
  const serviceRoleKey = values.SERVICE_ROLE_KEY;
  assert.match(supabaseUrl || '', /^http:\/\/127\.0\.0\.1:54321$/);
  assert.ok(anonKey, 'local anon key is required');
  assert.ok(serviceRoleKey, 'local service role key is required');
  return { supabaseUrl, anonKey, serviceRoleKey };
}

const config = localSupabaseEnvironment();
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(config.supabaseUrl, config.serviceRoleKey, clientOptions);
const authClient = createClient(config.supabaseUrl, config.anonKey, clientOptions);
const prefix = `s8a_${Date.now()}_${randomUUID().slice(0, 8)}`;
const createdPublicFoodIds = new Set();
const createdRunIds = new Set();
const createdUserIds = new Set();
const results = [];

function clientWithToken(token) {
  return createClient(config.supabaseUrl, config.anonKey, {
    ...clientOptions,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function check(name, operation) {
  try {
    await operation();
    results.push({ name, passed: true });
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    results.push({ name, passed: false, error });
    process.stderr.write(`FAIL ${name}: ${error.message}\n`);
  }
}

function assertDatabaseError(result, pattern = null) {
  assert.ok(result.error, 'expected a database error');
  if (pattern) assert.match(result.error.message, pattern);
}

function assertNoAffectedRows(result) {
  assert.equal(result.error, null);
  assert.deepEqual(result.data, []);
}

function privateFood(userId, suffix, extra = {}) {
  return {
    user_id: userId,
    visibility: 'private',
    name: `${prefix} private ${suffix}`,
    default_quantity: 100,
    unit: 'g',
    calories: 120,
    protein: 10,
    fat: 4,
    carbs: 12,
    energy_kcal: 120,
    protein_g: 10,
    fat_g: 4,
    carbohydrate_g: 12,
    fiber_g: 2,
    primary_category: '测试',
    review_status: 'approved',
    preparation_state: 'unspecified',
    intake_types: ['protein'],
    ...extra,
  };
}

function publicFood(suffix, reviewStatus = 'approved', extra = {}) {
  return {
    user_id: null,
    visibility: 'public',
    name: `${prefix} public ${suffix}`,
    name_en: `${prefix} public ${suffix}`,
    source_name: 'STAGE8A',
    external_food_id: `${prefix}_${suffix}`,
    default_quantity: 100,
    unit: 'g',
    calories: 100,
    protein: 8,
    fat: 3,
    carbs: 14,
    energy_kcal: 100,
    protein_g: 8,
    fat_g: 3,
    carbohydrate_g: 14,
    fiber_g: 2,
    primary_category: '测试',
    review_status: reviewStatus,
    is_active: reviewStatus !== 'disabled',
    preparation_state: 'unspecified',
    intake_types: ['protein'],
    notes: 'Local stage 8A integration test only.',
    ...extra,
  };
}

function importFood(suffix, extra = {}) {
  return {
    source_name: 'STAGE8A',
    external_food_id: `${prefix}_${suffix}`,
    name_zh: `${prefix} 导入 ${suffix}`,
    name_en: `${prefix} import ${suffix}`,
    brand: null,
    preparation_state: 'unspecified',
    category_primary: '测试',
    category_secondary: null,
    intake_types: ['protein'],
    energy_kcal: 110,
    protein_g: 9,
    carbohydrate_g: 13,
    fat_g: 3,
    fiber_g: 2,
    saturated_fat_g: null,
    monounsaturated_fat_g: null,
    polyunsaturated_fat_g: null,
    trans_fat_g: null,
    total_sugar_g: null,
    added_sugar_g: null,
    sugar_alcohol_g: null,
    sodium_mg: null,
    potassium_mg: null,
    portions: [],
    aliases: [],
    ...extra,
  };
}

async function createTestUser(label, role = 'user') {
  const email = `${prefix}_${label}@example.test`;
  const password = `Local-${randomUUID()}-Aa1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(error);
  const userId = data.user.id;
  createdUserIds.add(userId);

  const { error: profileError } = await service.from('profiles').upsert({
    id: userId,
    username: `s8a_${randomUUID().replaceAll('-', '').slice(0, 16)}_${label}`.slice(0, 30),
    display_name: `Stage 8A ${label}`,
    role,
  });
  assert.ifError(profileError);

  const { data: session, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  assert.ifError(signInError);
  return { id: userId, client: clientWithToken(session.session.access_token) };
}

async function insertOne(client, table, payload, columns = '*') {
  const result = await client.from(table).insert(payload).select(columns).single();
  assert.ifError(result.error);
  return result.data;
}

async function startRun(client, suffix, totalCount = 1) {
  const run = await insertOne(client, 'food_import_runs', {
    source_name: 'STAGE8A',
    input_identifier: `${prefix}_${suffix}.json`,
    status: 'running',
    total_count: totalCount,
  }, 'id,created_by,executor_role,status,total_count');
  createdRunIds.add(run.id);
  return run;
}

async function countRows(table, filters = []) {
  let query = service.from(table).select('id', { count: 'exact', head: true });
  for (const [column, value] of filters) query = query.eq(column, value);
  const result = await query;
  assert.ifError(result.error);
  return result.count;
}

async function assertAtomicFailure({ suffix, food, portions = [], aliases = [], pattern }) {
  const run = await startRun(service, `${suffix}_run`);
  const result = await service.rpc('import_public_food_item', {
    p_import_run_id: run.id,
    p_food: food,
    p_portions: portions,
    p_aliases: aliases,
  });
  assertDatabaseError(result, pattern);
  assert.equal(await countRows('foods', [['external_food_id', food.external_food_id]]), 0);
  assert.equal(
    await countRows('food_public_aliases', [['alias', `${prefix}_${suffix}_alias`]]),
    0
  );
}

let userA;
let userB;
let admin;
let approvedPublic;
let pendingPublic;
let disabledPublic;
let userAFood;
let userBFood;

try {
  userA = await createTestUser('user_a');
  userB = await createTestUser('user_b');
  admin = await createTestUser('admin', 'admin');

  await check('admin identity is recognized without elevating ordinary users', async () => {
    const [adminResult, userResult] = await Promise.all([
      admin.client.rpc('is_app_admin', { p_user_id: admin.id }),
      userA.client.rpc('is_app_admin', { p_user_id: userA.id }),
    ]);
    assert.ifError(adminResult.error);
    assert.ifError(userResult.error);
    assert.equal(adminResult.data, true);
    assert.equal(userResult.data, false);
  });

  await check('administrator creates approved, pending, and disabled public foods', async () => {
    approvedPublic = await insertOne(admin.client, 'foods', publicFood('approved'), 'id,name,review_status,is_active');
    pendingPublic = await insertOne(admin.client, 'foods', publicFood('pending', 'pending'), 'id,name,review_status,is_active');
    disabledPublic = await insertOne(admin.client, 'foods', publicFood('disabled', 'disabled'), 'id,name,review_status,is_active');
    for (const food of [approvedPublic, pendingPublic, disabledPublic]) createdPublicFoodIds.add(food.id);
    assert.equal(approvedPublic.review_status, 'approved');
    assert.equal(pendingPublic.review_status, 'pending');
    assert.equal(disabledPublic.review_status, 'disabled');
    assert.equal(disabledPublic.is_active, false);
  });

  await check('user A reads only approved active public food states', async () => {
    const result = await userA.client
      .from('foods')
      .select('id')
      .in('id', [approvedPublic.id, pendingPublic.id, disabledPublic.id]);
    assert.ifError(result.error);
    assert.deepEqual(result.data.map(({ id }) => id), [approvedPublic.id]);
  });

  await check('anonymous access is limited to approved active public foods', async () => {
    const anonymousClient = createClient(config.supabaseUrl, config.anonKey, clientOptions);
    const result = await anonymousClient
      .from('foods')
      .select('id')
      .in('id', [approvedPublic.id, pendingPublic.id, disabledPublic.id]);
    assert.ifError(result.error);
    assert.deepEqual(result.data.map(({ id }) => id), [approvedPublic.id]);
  });

  await check('user A creates and reads own private food', async () => {
    userAFood = await insertOne(userA.client, 'foods', privateFood(userA.id, 'owned'), 'id,user_id,name');
    assert.equal(userAFood.user_id, userA.id);
    const result = await userA.client.from('foods').select('id').eq('id', userAFood.id);
    assert.ifError(result.error);
    assert.equal(result.data.length, 1);
  });

  await check('user B creates own private food', async () => {
    userBFood = await insertOne(userB.client, 'foods', privateFood(userB.id, 'owned'), 'id,user_id,name');
    assert.equal(userBFood.user_id, userB.id);
  });

  await check('user A cannot read user B private food', async () => {
    const result = await userA.client.from('foods').select('id').eq('id', userBFood.id);
    assert.ifError(result.error);
    assert.deepEqual(result.data, []);
  });

  await check('user B cannot read user A private food', async () => {
    const result = await userB.client.from('foods').select('id').eq('id', userAFood.id);
    assert.ifError(result.error);
    assert.deepEqual(result.data, []);
  });

  await check('ordinary user cannot create public food', async () => {
    const result = await userA.client.from('foods').insert(publicFood('user_public_attempt'));
    assertDatabaseError(result);
  });

  await check('ordinary users cannot modify or delete public food', async () => {
    const update = await userA.client.from('foods').update({ name: 'forbidden' }).eq('id', approvedPublic.id).select('id');
    assertNoAffectedRows(update);
    const removal = await userA.client.from('foods').delete().eq('id', approvedPublic.id).select('id');
    assertNoAffectedRows(removal);
    assert.equal(await countRows('foods', [['id', approvedPublic.id]]), 1);
  });

  await check('cross-user updates and deletes affect no rows in both directions', async () => {
    const aUpdateB = await userA.client.from('foods').update({ name: 'forbidden' }).eq('id', userBFood.id).select('id');
    const bDeleteA = await userB.client.from('foods').delete().eq('id', userAFood.id).select('id');
    assertNoAffectedRows(aUpdateB);
    assertNoAffectedRows(bDeleteA);
  });

  await check('user A modifies and deletes only own unreferenced private food', async () => {
    const disposable = await insertOne(userA.client, 'foods', privateFood(userA.id, 'disposable'), 'id');
    const update = await userA.client.from('foods').update({ name: `${prefix} changed` }).eq('id', disposable.id).select('name').single();
    assert.ifError(update.error);
    assert.equal(update.data.name, `${prefix} changed`);
    const removal = await userA.client.from('foods').delete().eq('id', disposable.id).select('id').single();
    assert.ifError(removal.error);
  });

  await check('private aliases are owner-isolated for create, read, update, and delete', async () => {
    const alias = await insertOne(userA.client, 'food_private_aliases', {
      food_id: userAFood.id,
      user_id: userA.id,
      alias: `${prefix}_a_private_alias`,
    }, 'id,alias');
    const bRead = await userB.client.from('food_private_aliases').select('id').eq('id', alias.id);
    assert.ifError(bRead.error);
    assert.deepEqual(bRead.data, []);
    const bUpdate = await userB.client.from('food_private_aliases').update({ alias: 'forbidden' }).eq('id', alias.id).select('id');
    assertNoAffectedRows(bUpdate);
    const ownUpdate = await userA.client.from('food_private_aliases').update({ alias: `${prefix}_a_alias_changed` }).eq('id', alias.id).select('alias').single();
    assert.ifError(ownUpdate.error);
    const ownDelete = await userA.client.from('food_private_aliases').delete().eq('id', alias.id).select('id').single();
    assert.ifError(ownDelete.error);
  });

  await check('user cannot forge another owner on a private alias', async () => {
    const result = await userA.client.from('food_private_aliases').insert({
      food_id: userBFood.id,
      user_id: userA.id,
      alias: `${prefix}_forged_alias`,
    });
    assertDatabaseError(result);
  });

  await check('public aliases are readable only with a visible public food and writable only by admin', async () => {
    const approvedAlias = await insertOne(admin.client, 'food_public_aliases', {
      food_id: approvedPublic.id,
      alias: `${prefix}_approved_alias`,
    }, 'id,alias');
    const pendingAlias = await insertOne(admin.client, 'food_public_aliases', {
      food_id: pendingPublic.id,
      alias: `${prefix}_pending_alias`,
    }, 'id,alias');
    const userRead = await userA.client.from('food_public_aliases').select('id').in('id', [approvedAlias.id, pendingAlias.id]);
    assert.ifError(userRead.error);
    assert.deepEqual(userRead.data.map(({ id }) => id), [approvedAlias.id]);
    const userInsert = await userA.client.from('food_public_aliases').insert({
      food_id: approvedPublic.id,
      alias: `${prefix}_forbidden_public_alias`,
    });
    assertDatabaseError(userInsert);
    const adminUpdate = await admin.client.from('food_public_aliases').update({
      alias: `${prefix}_approved_alias_changed`,
    }).eq('id', approvedAlias.id).select('id').single();
    assert.ifError(adminUpdate.error);
  });

  await check('portion reads follow visibility and writes follow ownership or admin status', async () => {
    const ownPortion = await insertOne(userA.client, 'food_portions', {
      food_id: userAFood.id,
      portion_name: `${prefix} own cup`,
      grams: 120,
    }, 'id');
    const publicPortion = await insertOne(admin.client, 'food_portions', {
      food_id: approvedPublic.id,
      portion_name: `${prefix} public cup`,
      grams: 150,
    }, 'id');
    const pendingPortion = await insertOne(admin.client, 'food_portions', {
      food_id: pendingPublic.id,
      portion_name: `${prefix} pending cup`,
      grams: 90,
    }, 'id');
    const visible = await userA.client.from('food_portions').select('id').in('id', [ownPortion.id, publicPortion.id, pendingPortion.id]);
    assert.ifError(visible.error);
    assert.deepEqual(new Set(visible.data.map(({ id }) => id)), new Set([ownPortion.id, publicPortion.id]));
    const forbidden = await userA.client.from('food_portions').insert({
      food_id: approvedPublic.id,
      portion_name: `${prefix} forbidden`,
      grams: 10,
    });
    assertDatabaseError(forbidden);
  });

  await check('ordinary and anonymous clients cannot access import audit data', async () => {
    const userSelect = await userA.client.from('food_import_runs').select('id');
    assert.ifError(userSelect.error);
    assert.deepEqual(userSelect.data, []);
    const anonymousClient = createClient(config.supabaseUrl, config.anonKey, clientOptions);
    const anonSelect = await anonymousClient.from('food_import_runs').select('id');
    assert.ok(anonSelect.error || anonSelect.data.length === 0);
    const userInsert = await userA.client.from('food_import_runs').insert({
      source_name: 'STAGE8A',
      input_identifier: `${prefix}_forbidden.json`,
      total_count: 1,
    });
    assertDatabaseError(userInsert);
  });

  await check('ordinary authenticated user cannot execute import RPC', async () => {
    const run = await startRun(service, 'ordinary_rpc');
    const result = await userA.client.rpc('import_public_food_item', {
      p_import_run_id: run.id,
      p_food: importFood('ordinary_rpc'),
      p_portions: [],
      p_aliases: [],
    });
    assertDatabaseError(result, /administrator or service role/i);
  });

  await check('ordinary user cannot promote own profile to administrator', async () => {
    const result = await userA.client.from('profiles').update({ role: 'admin' })
      .eq('id', userA.id).select('role');
    assertDatabaseError(result, /administrator role may only be assigned by service role/i);
    const adminCheck = await userA.client.rpc('is_app_admin', { p_user_id: userA.id });
    assert.ifError(adminCheck.error);
    assert.equal(adminCheck.data, false);
  });

  await check('administrator can create and read import audit', async () => {
    const run = await startRun(admin.client, 'admin_audit');
    assert.equal(run.created_by, admin.id);
    assert.equal(run.executor_role, 'authenticated');
    const result = await admin.client.from('food_import_runs').select('id').eq('id', run.id).single();
    assert.ifError(result.error);
  });

  await check('administrator can import pending public food atomically', async () => {
    const run = await startRun(admin.client, 'admin_rpc');
    const food = importFood('admin_rpc', {
      portions: [{ name: '1 cup', grams: 125, is_default: true }],
      aliases: [`${prefix}_admin_rpc_alias`],
    });
    const result = await admin.client.rpc('import_public_food_item', {
      p_import_run_id: run.id,
      p_food: food,
      p_portions: food.portions,
      p_aliases: food.aliases,
    });
    assert.ifError(result.error);
    assert.equal(result.data.status, 'success');
    createdPublicFoodIds.add(result.data.food_id);
    const inserted = await service.from('foods').select('review_status').eq('id', result.data.food_id).single();
    assert.ifError(inserted.error);
    assert.equal(inserted.data.review_status, 'pending');
  });

  await check('administrator modifies, approves, and disables public food', async () => {
    const update = await admin.client.from('foods').update({
      name: `${prefix} approved renamed`,
      review_status: 'approved',
      is_active: true,
    }).eq('id', pendingPublic.id).select('review_status,is_active,name').single();
    assert.ifError(update.error);
    assert.equal(update.data.review_status, 'approved');
    const disable = await admin.client.from('foods').update({
      review_status: 'disabled',
    }).eq('id', pendingPublic.id).select('review_status,is_active').single();
    assert.ifError(disable.error);
    assert.deepEqual(disable.data, { review_status: 'disabled', is_active: false });
  });

  await check('service role creates audit run and errors without RLS interference', async () => {
    const run = await startRun(service, 'service_audit', 1);
    assert.equal(run.created_by, null);
    assert.equal(run.executor_role, 'service_role');
    const errorRow = await insertOne(service, 'food_import_errors', {
      import_run_id: run.id,
      row_number: 1,
      external_food_id: `${prefix}_bad`,
      error_code: 'LOCAL_TEST',
      error_message: 'Safe local integration error',
      raw_summary: { external_food_id: `${prefix}_bad` },
    }, 'id,import_run_id');
    assert.equal(errorRow.import_run_id, run.id);
  });

  await check('service role imports one food with two aliases and two portions atomically', async () => {
    const run = await startRun(service, 'atomic_success');
    const food = importFood('atomic_success');
    const aliases = [`${prefix}_atomic_alias_1`, `${prefix}_atomic_alias_2`];
    const portions = [
      { name: '1 cup', grams: 100, is_default: true },
      { name: '1 spoon', grams: 15, is_default: false },
    ];
    const result = await service.rpc('import_public_food_item', {
      p_import_run_id: run.id,
      p_food: food,
      p_portions: portions,
      p_aliases: aliases,
    });
    assert.ifError(result.error);
    assert.equal(result.data.status, 'success');
    createdPublicFoodIds.add(result.data.food_id);
    assert.equal(await countRows('food_portions', [['food_id', result.data.food_id]]), 2);
    assert.equal(await countRows('food_public_aliases', [['food_id', result.data.food_id]]), 2);
  });

  await check('alias constraint failure rolls back food, aliases, and portions', async () => {
    const food = importFood('alias_rollback');
    await assertAtomicFailure({
      suffix: 'alias_rollback',
      food,
      portions: [{ name: '1 cup', grams: 100 }],
      aliases: [`${prefix}_alias_rollback_alias`, `${prefix}_alias_rollback_alias`],
      pattern: /duplicate key|unique/i,
    });
  });

  await check('portion constraint failure rolls back food, aliases, and portions', async () => {
    const food = importFood('portion_rollback');
    await assertAtomicFailure({
      suffix: 'portion_rollback',
      food,
      portions: [{ name: 'invalid', grams: 0 }],
      aliases: [`${prefix}_portion_rollback_alias`],
      pattern: /food_portions_grams_positive_check|check constraint/i,
    });
  });

  await check('food constraint failure creates no food or child records', async () => {
    const food = importFood('food_rollback', { energy_kcal: -1 });
    await assertAtomicFailure({
      suffix: 'food_rollback',
      food,
      portions: [{ name: '1 cup', grams: 100 }],
      aliases: [`${prefix}_food_rollback_alias`],
      pattern: /foods_nutrients_nonnegative_check|check constraint/i,
    });
  });

  await check('same source and external id rerun returns skipped without duplicates', async () => {
    const run = await startRun(service, 'idempotent');
    const food = importFood('idempotent');
    const args = {
      p_import_run_id: run.id,
      p_food: food,
      p_portions: [{ name: '1 cup', grams: 111 }],
      p_aliases: [`${prefix}_idempotent_alias`],
    };
    const first = await service.rpc('import_public_food_item', args);
    const second = await service.rpc('import_public_food_item', {
      ...args,
      p_food: { ...food, name_zh: '不得覆盖既有名称' },
    });
    assert.ifError(first.error);
    assert.ifError(second.error);
    assert.equal(first.data.status, 'success');
    assert.equal(second.data.status, 'skipped');
    createdPublicFoodIds.add(first.data.food_id);
    assert.equal(first.data.food_id, second.data.food_id);
    assert.equal(await countRows('foods', [['external_food_id', food.external_food_id]]), 1);
    assert.equal(await countRows('food_portions', [['food_id', first.data.food_id]]), 1);
    assert.equal(await countRows('food_public_aliases', [['food_id', first.data.food_id]]), 1);
    const existing = await service.from('foods').select('name').eq('id', first.data.food_id).single();
    assert.ifError(existing.error);
    assert.notEqual(existing.data.name, '不得覆盖既有名称');
  });

  await check('same external id under a different source remains a separate identity', async () => {
    const run = await insertOne(service, 'food_import_runs', {
      source_name: 'STAGE8B_LOCAL_ALT',
      input_identifier: `${prefix}_alternate_source.json`,
      total_count: 1,
    }, 'id');
    createdRunIds.add(run.id);
    const food = { ...importFood('source_identity'), source_name: 'STAGE8B_LOCAL_ALT' };
    const result = await service.rpc('import_public_food_item', {
      p_import_run_id: run.id,
      p_food: food,
      p_portions: [],
      p_aliases: [],
    });
    assert.ifError(result.error);
    assert.equal(result.data.status, 'success');
    createdPublicFoodIds.add(result.data.food_id);
  });

  await check('three-row batch isolates one database failure and closes audit counts', async () => {
    const repository = createSupabaseImportRepository({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.serviceRoleKey,
    });
    const rows = [
      importFood('batch_a'),
      importFood('batch_b', {
        portions: [
          { name: 'duplicate', grams: 100, is_default: false },
          { name: 'duplicate', grams: 120, is_default: false },
        ],
      }),
      importFood('batch_c'),
    ];
    const adapter = { sourceName: 'STAGE8A', async readRows() { return rows; }, adapt(row) { return row; } };
    const outcome = await runFoodImport({
      adapter,
      inputPath: `${prefix}_batch.json`,
      batchSize: 3,
      repository,
    });
    createdRunIds.add(outcome.importRunId);
    assert.deepEqual(
      {
        total: outcome.summary.total,
        success: outcome.summary.success,
        failed: outcome.summary.failed,
        skipped: outcome.summary.skipped,
        status: outcome.summary.status,
      },
      { total: 3, success: 2, failed: 1, skipped: 0, status: 'partially_failed' }
    );
    const run = await service.from('food_import_runs')
      .select('total_count,success_count,failed_count,skipped_count,status')
      .eq('id', outcome.importRunId)
      .single();
    assert.ifError(run.error);
    assert.deepEqual(run.data, {
      total_count: 3,
      success_count: 2,
      failed_count: 1,
      skipped_count: 0,
      status: 'partially_failed',
    });
    assert.equal(await countRows('food_import_errors', [['import_run_id', outcome.importRunId]]), 1);
    assert.equal(await countRows('foods', [['external_food_id', rows[0].external_food_id]]), 1);
    assert.equal(await countRows('foods', [['external_food_id', rows[1].external_food_id]]), 0);
    assert.equal(await countRows('foods', [['external_food_id', rows[2].external_food_id]]), 1);
    for (const row of [rows[0], rows[2]]) {
      const food = await service.from('foods').select('id').eq('external_food_id', row.external_food_id).single();
      assert.ifError(food.error);
      createdPublicFoodIds.add(food.data.id);
    }

    const rerun = await runFoodImport({
      adapter,
      inputPath: `${prefix}_batch.json`,
      batchSize: 3,
      repository,
    });
    createdRunIds.add(rerun.importRunId);
    assert.deepEqual(
      {
        total: rerun.summary.total,
        success: rerun.summary.success,
        failed: rerun.summary.failed,
        skipped: rerun.summary.skipped,
        status: rerun.summary.status,
      },
      { total: 3, success: 0, failed: 1, skipped: 2, status: 'partially_failed' }
    );
  });

  await check('public food copy belongs to user and remains independent from source', async () => {
    const copy = await insertOne(userA.client, 'foods', privateFood(userA.id, 'public_copy', {
      source_public_food_id: approvedPublic.id,
      name: `${prefix} personal copy`,
    }), 'id,user_id,source_public_food_id,name,calories');
    assert.equal(copy.user_id, userA.id);
    assert.equal(copy.source_public_food_id, approvedPublic.id);
    const copyUpdate = await userA.client.from('foods').update({ name: `${prefix} copy changed`, calories: 333 })
      .eq('id', copy.id).select('name,calories').single();
    assert.ifError(copyUpdate.error);
    const sourceBefore = await service.from('foods').select('name,calories').eq('id', approvedPublic.id).single();
    assert.ifError(sourceBefore.error);
    assert.notEqual(sourceBefore.data.calories, 333);
    const sourceUpdate = await admin.client.from('foods').update({ calories: 222 }).eq('id', approvedPublic.id).select('id').single();
    assert.ifError(sourceUpdate.error);
    const copyAfter = await userA.client.from('foods').select('name,calories').eq('id', copy.id).single();
    assert.ifError(copyAfter.error);
    assert.equal(copyAfter.data.name, `${prefix} copy changed`);
    assert.equal(Number(copyAfter.data.calories), 333);
  });

  await check('referenced food cannot be hard deleted and history snapshots survive source changes', async () => {
    const timeline = await insertOne(userA.client, 'timeline_items', {
      user_id: userA.id,
      event_date: '2026-07-31',
      event_time: '12:00',
      item_type: 'lunch',
      title: `${prefix} snapshot meal`,
    }, 'id');
    const snapshot = {
      user_id: userA.id,
      timeline_item_id: timeline.id,
      source_food_id: userAFood.id,
      food_name_snapshot: `${prefix} original snapshot`,
      quantity: 100,
      unit_snapshot: 'g',
      calories_snapshot: 120,
      protein_snapshot: 10,
      fat_snapshot: 4,
      carbs_snapshot: 12,
    };
    const entry = await insertOne(userA.client, 'food_entries', snapshot, 'id');
    const update = await userA.client.from('foods').update({
      name: `${prefix} source renamed`,
      calories: 999,
      is_active: false,
    }).eq('id', userAFood.id).select('review_status,is_active').single();
    assert.ifError(update.error);
    assert.deepEqual(update.data, { review_status: 'disabled', is_active: false });
    const historical = await userA.client.from('food_entries')
      .select('food_name_snapshot,calories_snapshot,protein_snapshot,fat_snapshot,carbs_snapshot')
      .eq('id', entry.id).single();
    assert.ifError(historical.error);
    assert.deepEqual(historical.data, {
      food_name_snapshot: snapshot.food_name_snapshot,
      calories_snapshot: 120,
      protein_snapshot: 10,
      fat_snapshot: 4,
      carbs_snapshot: 12,
    });
    const removal = await userA.client.from('foods').delete().eq('id', userAFood.id);
    assertDatabaseError(removal, /referenced foods must be disabled/i);
  });

  await check('user A creates entries from active public and own private foods', async () => {
    const timeline = await insertOne(userA.client, 'timeline_items', {
      user_id: userA.id,
      event_date: '2026-08-01',
      event_time: '08:00',
      item_type: 'breakfast',
      title: `${prefix} active sources`,
    }, 'id');
    for (const [source, suffix] of [
      [approvedPublic, 'active_public'],
      [await insertOne(userA.client, 'foods', privateFood(userA.id, 'active_entry'), 'id'), 'active_private'],
    ]) {
      const entry = await insertOne(userA.client, 'food_entries', {
        user_id: userA.id,
        timeline_item_id: timeline.id,
        source_food_id: source.id,
        food_name_snapshot: `${prefix} ${suffix}`,
        quantity: 100,
        calories_snapshot: 100,
      }, 'id,source_food_id');
      assert.equal(entry.source_food_id, source.id);
    }
  });

  await check('user A cannot create an entry from disabled public food through REST', async () => {
    const timeline = await insertOne(userA.client, 'timeline_items', {
      user_id: userA.id,
      event_date: '2026-08-01',
      event_time: '09:00',
      item_type: 'snack',
      title: `${prefix} disabled public`,
    }, 'id');
    const result = await userA.client.from('food_entries').insert({
      user_id: userA.id,
      timeline_item_id: timeline.id,
      source_food_id: disabledPublic.id,
      food_name_snapshot: `${prefix} disabled public`,
      quantity: 100,
      calories_snapshot: 100,
    });
    assertDatabaseError(result, /source food is not available for new entries/i);
  });

  await check('user A cannot create an entry from disabled private food', async () => {
    const disabledPrivate = await insertOne(userA.client, 'foods', privateFood(userA.id, 'disabled_entry', {
      review_status: 'disabled',
      is_active: false,
    }), 'id');
    const timeline = await insertOne(userA.client, 'timeline_items', {
      user_id: userA.id,
      event_date: '2026-08-01',
      event_time: '10:00',
      item_type: 'snack',
      title: `${prefix} disabled private`,
    }, 'id');
    const result = await userA.client.from('food_entries').insert({
      user_id: userA.id,
      timeline_item_id: timeline.id,
      source_food_id: disabledPrivate.id,
      food_name_snapshot: `${prefix} disabled private`,
      quantity: 100,
      calories_snapshot: 100,
    });
    assertDatabaseError(result, /source food is not available for new entries/i);
  });

  await check('existing entry cannot change its source to a disabled food', async () => {
    const timeline = await insertOne(userA.client, 'timeline_items', {
      user_id: userA.id,
      event_date: '2026-08-01',
      event_time: '11:00',
      item_type: 'snack',
      title: `${prefix} source update`,
    }, 'id');
    const entry = await insertOne(userA.client, 'food_entries', {
      user_id: userA.id,
      timeline_item_id: timeline.id,
      source_food_id: approvedPublic.id,
      food_name_snapshot: `${prefix} source update`,
      quantity: 100,
      calories_snapshot: 100,
    }, 'id');
    const result = await userA.client.from('food_entries')
      .update({ source_food_id: disabledPublic.id }).eq('id', entry.id);
    assertDatabaseError(result, /source food is not available for new entries/i);
  });

  await check('disabling a used food preserves query and non-source historical edits', async () => {
    const source = await insertOne(userA.client, 'foods', privateFood(userA.id, 'disable_after_use'), 'id');
    const timeline = await insertOne(userA.client, 'timeline_items', {
      user_id: userA.id,
      event_date: '2026-08-01',
      event_time: '12:00',
      item_type: 'lunch',
      title: `${prefix} disable after use`,
    }, 'id');
    const entry = await insertOne(userA.client, 'food_entries', {
      user_id: userA.id,
      timeline_item_id: timeline.id,
      source_food_id: source.id,
      food_name_snapshot: `${prefix} stable snapshot`,
      quantity: 100,
      calories_snapshot: 120,
    }, 'id');
    const disable = await userA.client.from('foods').update({ is_active: false })
      .eq('id', source.id).select('review_status,is_active').single();
    assert.ifError(disable.error);
    assert.deepEqual(disable.data, { review_status: 'disabled', is_active: false });
    const edit = await userA.client.from('food_entries').update({ quantity: 125, notes: 'historical edit' })
      .eq('id', entry.id).select('food_name_snapshot,calories_snapshot,quantity,notes').single();
    assert.ifError(edit.error);
    assert.deepEqual(edit.data, {
      food_name_snapshot: `${prefix} stable snapshot`,
      calories_snapshot: 120,
      quantity: 125,
      notes: 'historical edit',
    });
  });

  await check('administrator cannot create an entry referencing disabled food', async () => {
    const timeline = await insertOne(admin.client, 'timeline_items', {
      user_id: admin.id,
      event_date: '2026-08-01',
      event_time: '13:00',
      item_type: 'lunch',
      title: `${prefix} admin disabled`,
    }, 'id');
    const result = await admin.client.from('food_entries').insert({
      user_id: admin.id,
      timeline_item_id: timeline.id,
      source_food_id: disabledPublic.id,
      food_name_snapshot: `${prefix} admin disabled`,
      quantity: 100,
      calories_snapshot: 100,
    });
    assertDatabaseError(result, /source food is not available for new entries/i);
  });

  await check('service role cannot create an entry referencing disabled food', async () => {
    const timeline = await insertOne(service, 'timeline_items', {
      user_id: userA.id,
      event_date: '2026-08-01',
      event_time: '14:00',
      item_type: 'snack',
      title: `${prefix} service disabled`,
    }, 'id');
    const result = await service.from('food_entries').insert({
      user_id: userA.id,
      timeline_item_id: timeline.id,
      source_food_id: disabledPublic.id,
      food_name_snapshot: `${prefix} service disabled`,
      quantity: 100,
      calories_snapshot: 100,
    });
    assertDatabaseError(result, /source food is not available for new entries/i);
  });

  await check('re-enabled food can be used for a new entry again', async () => {
    const source = await insertOne(userA.client, 'foods', privateFood(userA.id, 'reenable', {
      review_status: 'disabled',
      is_active: false,
    }), 'id');
    const reenable = await userA.client.from('foods').update({ is_active: true })
      .eq('id', source.id).select('review_status,is_active').single();
    assert.ifError(reenable.error);
    assert.deepEqual(reenable.data, { review_status: 'approved', is_active: true });
    const timeline = await insertOne(userA.client, 'timeline_items', {
      user_id: userA.id,
      event_date: '2026-08-01',
      event_time: '15:00',
      item_type: 'snack',
      title: `${prefix} reenabled`,
    }, 'id');
    const entry = await insertOne(userA.client, 'food_entries', {
      user_id: userA.id,
      timeline_item_id: timeline.id,
      source_food_id: source.id,
      food_name_snapshot: `${prefix} reenabled`,
      quantity: 100,
      calories_snapshot: 100,
    }, 'id');
    assert.ok(entry.id);
  });

  await check('timeline events without food references remain unaffected', async () => {
    const event = await insertOne(userA.client, 'timeline_items', {
      user_id: userA.id,
      event_date: '2026-08-01',
      event_time: '16:00',
      item_type: 'anaerobic_training',
      title: `${prefix} training`,
    }, 'id,item_type');
    assert.equal(event.item_type, 'anaerobic_training');
  });

  await check('disabled public food is hidden from ordinary users but remains admin-readable', async () => {
    const userResult = await userA.client.from('foods').select('id').eq('id', disabledPublic.id);
    assert.ifError(userResult.error);
    assert.deepEqual(userResult.data, []);
    const adminResult = await admin.client.from('foods').select('id').eq('id', disabledPublic.id);
    assert.ifError(adminResult.error);
    assert.equal(adminResult.data.length, 1);
  });

  await check('admin can maintain public portions and aliases but cannot hard-delete public food', async () => {
    const portion = await insertOne(admin.client, 'food_portions', {
      food_id: approvedPublic.id,
      portion_name: `${prefix} admin portion`,
      grams: 88,
    }, 'id');
    const alias = await insertOne(admin.client, 'food_public_aliases', {
      food_id: approvedPublic.id,
      alias: `${prefix}_admin_alias_final`,
    }, 'id');
    const portionDelete = await admin.client.from('food_portions').delete().eq('id', portion.id).select('id').single();
    const aliasDelete = await admin.client.from('food_public_aliases').delete().eq('id', alias.id).select('id').single();
    assert.ifError(portionDelete.error);
    assert.ifError(aliasDelete.error);
    const foodDelete = await admin.client.from('foods').delete().eq('id', approvedPublic.id).select('id');
    assertNoAffectedRows(foodDelete);
    assert.equal(await countRows('foods', [['id', approvedPublic.id]]), 1);
  });
} finally {
  for (const runId of createdRunIds) {
    await service.from('food_import_runs').delete().eq('id', runId);
  }
  for (const foodId of createdPublicFoodIds) {
    await service.from('foods').delete().eq('id', foodId);
  }
  for (const userId of createdUserIds) {
    await service.auth.admin.deleteUser(userId);
  }
}

const failed = results.filter(({ passed }) => !passed);
process.stdout.write(`\nLocal food database integration: ${results.length - failed.length}/${results.length} passed\n`);
if (failed.length > 0) process.exitCode = 1;
