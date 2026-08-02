#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { afcdAdapter } from './adapters.mjs';
import { runFoodImport } from './importer.mjs';
import { createSupabaseImportRepository } from './repository.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const datasetPath = resolve(
  repoRoot,
  'frontend/scripts/import-foods/dataset/public-foods-afcd-initial.json'
);
const manifestPath = resolve(
  repoRoot,
  'frontend/scripts/import-foods/dataset/local-trial-import-manifest.json'
);
const auditPath = resolve(
  repoRoot,
  'frontend/scripts/import-foods/dataset/local-trial-import-audit.json'
);
const allowedModes = new Set([
  'full',
  'first-run',
  'idempotent-rerun',
  'failure-isolation',
  'verify-only',
  'cleanup',
]);
const expectedPackageHash =
  '21f03786d34b0525f3cf57234f79b60a1d9bbdc3fc96cd48642e1124b8bd15d6';
const approvedIds = ['F009034', 'F005634'];

function parseLocalStatus(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(?:"(.*)"|(.*))$/);
    if (match) values[match[1]] = match[2] ?? match[3];
  }
  return values;
}

export function assertLocalEnvironment(values) {
  const api = new URL(values.API_URL || 'invalid://missing');
  const database = new URL(values.DB_URL || 'invalid://missing');
  const localHosts = new Set(['127.0.0.1', 'localhost']);
  assert.ok(localHosts.has(api.hostname), 'trial API must be local');
  assert.ok(localHosts.has(database.hostname), 'trial database must be local');
  assert.ok(values.ANON_KEY, 'local anon key is required');
  assert.ok(values.SERVICE_ROLE_KEY, 'local service role key is required');
}

function localEnvironment() {
  const output = execFileSync(
    'npx',
    ['--no-install', 'supabase', 'status', '-o', 'env'],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const values = parseLocalStatus(output);
  assertLocalEnvironment(values);
  return values;
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function validateTrialManifest(manifest, dataset) {
  assert.equal(manifest.length, 20, 'trial manifest must contain exactly 20 foods');
  assert.equal(new Set(manifest.map((item) => item.external_food_id)).size, 20);
  const byId = new Map(dataset.map((food) => [food.external_food_id, food]));
  const categories = new Set();
  const states = new Set();
  let hasAliasesAndMultiplePortions = false;
  let hasNoAliases = false;
  let hasMultipleIntakeTypes = false;
  let hasEmptyIntakeTypes = false;
  let hasPortions = false;
  let hasNoPortions = false;
  let hasReadyTranslation = false;
  let hasReviewTranslation = false;

  for (const item of manifest) {
    const food = byId.get(item.external_food_id);
    assert.ok(food, `manifest food missing from final package: ${item.external_food_id}`);
    assert.equal(item.name_en, food.name_en);
    assert.equal(item.name_zh, food.name_zh);
    assert.equal(item.expected_alias_count, food.aliases.length);
    assert.equal(item.expected_portion_count, food.portions.length);
    assert.deepEqual(item.expected_intake_types, food.intake_types);
    assert.equal(item.expected_preparation_state, food.preparation_state);
    assert.equal(item.translation_status, food.translation_status);
    assert.ok(item.selection_reason.length > 0);
    categories.add(food.category_primary);
    states.add(food.preparation_state);
    hasAliasesAndMultiplePortions ||= food.aliases.length > 0 && food.portions.length > 1;
    hasNoAliases ||= food.aliases.length === 0;
    hasMultipleIntakeTypes ||= food.intake_types.length > 1;
    hasEmptyIntakeTypes ||= food.intake_types.length === 0;
    hasPortions ||= food.portions.length > 0;
    hasNoPortions ||= food.portions.length === 0;
    hasReadyTranslation ||= food.translation_status === 'ready';
    hasReviewTranslation ||= food.translation_status === 'needs_review';
  }

  for (const category of [
    'grains_staples',
    'meat_poultry',
    'fish_seafood',
    'dairy',
    'legumes_soy',
    'vegetables',
    'fruits',
    'oils_fats',
  ]) assert.ok(categories.has(category), `missing trial category: ${category}`);
  assert.ok(
    categories.has('condiments_sauces') || categories.has('beverages_non_alcoholic')
  );
  assert.deepEqual(states, new Set(['raw', 'cooked', 'unspecified']));
  for (const value of [
    hasAliasesAndMultiplePortions,
    hasNoAliases,
    hasMultipleIntakeTypes,
    hasEmptyIntakeTypes,
    hasPortions,
    hasNoPortions,
    hasReadyTranslation,
    hasReviewTranslation,
  ]) assert.equal(value, true);
}

function client(url, key, token = null) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

async function insertOne(db, table, payload, columns = '*') {
  const result = await db.from(table).insert(payload).select(columns).single();
  assert.ifError(result.error);
  return result.data;
}

async function createUser(service, authClient, label, role, runToken) {
  const email = `trial_${runToken}_${label}@example.test`;
  const password = `Local-${randomUUID()}-Aa1!`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  const userId = created.data.user.id;
  const profile = await service.from('profiles').upsert({
    id: userId,
    username: `trial_${randomUUID().replaceAll('-', '').slice(0, 18)}`.slice(0, 30),
    display_name: `Trial ${label}`,
    role,
  });
  assert.ifError(profile.error);
  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  return { id: userId, token: signedIn.data.session.access_token };
}

async function tempInput(rows) {
  const directory = await mkdtemp(resolve(tmpdir(), 'food-trial-'));
  const path = resolve(directory, 'trial.json');
  await writeFile(path, JSON.stringify(rows), { mode: 0o600 });
  return { path, async remove() { await rm(directory, { recursive: true, force: true }); } };
}

async function queryAll(db, table, columns, filter, values) {
  return db.from(table).select(columns).eq(filter, values);
}

function comparableNumber(value) {
  return value === null ? null : Number(value);
}

async function verifyFoodRows(service, selected) {
  const ids = selected.map((food) => food.external_food_id);
  const foodsResult = await service.from('foods').select('*')
    .eq('source_name', 'AFCD').in('external_food_id', ids);
  assert.ifError(foodsResult.error);
  assert.equal(foodsResult.data.length, 20);
  const byExternalId = new Map(
    foodsResult.data.map((food) => [food.external_food_id, food])
  );
  const nutrientFields = [
    'energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fiber_g',
    'saturated_fat_g', 'monounsaturated_fat_g', 'polyunsaturated_fat_g',
    'trans_fat_g', 'total_sugar_g', 'added_sugar_g', 'sugar_alcohol_g',
    'sodium_mg', 'potassium_mg',
  ];

  for (const expected of selected) {
    const actual = byExternalId.get(expected.external_food_id);
    assert.ok(actual);
    assert.equal(actual.visibility, 'public');
    assert.equal(actual.user_id, null);
    assert.equal(actual.source_name, 'AFCD');
    assert.equal(actual.name, expected.name_zh);
    assert.equal(actual.name_en, expected.name_en);
    assert.equal(actual.primary_category, expected.category_primary);
    assert.equal(actual.preparation_state, expected.preparation_state);
    assert.deepEqual(actual.intake_types, expected.intake_types);
    for (const field of nutrientFields) {
      assert.equal(comparableNumber(actual[field]), expected[field]);
    }
    const aliases = await service.from('food_public_aliases').select('alias')
      .eq('food_id', actual.id).order('alias');
    const portions = await service.from('food_portions')
      .select('portion_name,grams,is_default').eq('food_id', actual.id).order('portion_name');
    assert.ifError(aliases.error);
    assert.ifError(portions.error);
    assert.deepEqual(
      aliases.data.map(({ alias }) => alias).sort(),
      [...expected.aliases].sort()
    );
    assert.deepEqual(
      portions.data.map((portion) => ({
        name: portion.portion_name,
        grams: Number(portion.grams),
        is_default: portion.is_default,
      })).sort((a, b) => a.name.localeCompare(b.name)),
      expected.portions.map((portion) => ({
        name: portion.name,
        grams: portion.grams,
        is_default: portion.is_default,
      })).sort((a, b) => a.name.localeCompare(b.name))
    );
  }
  return byExternalId;
}

async function cleanupTrial(service, manifestIds, userIds = []) {
  await service.from('foods').delete().eq('source_name', 'AFCD')
    .in('external_food_id', manifestIds);
  await service.from('foods').delete().eq('source_name', 'AFCD')
    .like('external_food_id', 'LOCAL_TRIAL_%');
  await service.from('food_import_runs').delete()
    .like('input_identifier', 'local-trial-%');
  for (const userId of userIds) await service.auth.admin.deleteUser(userId);
}

async function executeFullTrial({ service, anonKey, apiUrl, selected, manifest }) {
  const runToken = randomUUID().slice(0, 8);
  const authClient = client(apiUrl, anonKey);
  const users = [];
  const importRunIds = [];
  const tempFiles = [];
  const repository = createSupabaseImportRepository({
    supabaseUrl: apiUrl,
    serviceRoleKey: localEnvironment().SERVICE_ROLE_KEY,
  });
  const manifestIds = manifest.map((item) => item.external_food_id);
  await cleanupTrial(service, manifestIds);

  try {
    const userA = await createUser(service, authClient, 'a', 'user', runToken);
    const userB = await createUser(service, authClient, 'b', 'user', runToken);
    const admin = await createUser(service, authClient, 'admin', 'admin', runToken);
    users.push(userA.id, userB.id, admin.id);
    const userAClient = client(apiUrl, anonKey, userA.token);
    const userBClient = client(apiUrl, anonKey, userB.token);
    const adminClient = client(apiUrl, anonKey, admin.token);
    const anonymousClient = client(apiUrl, anonKey);

    const initialFile = await tempInput(selected);
    tempFiles.push(initialFile);
    const initial = await runFoodImport({
      adapter: afcdAdapter,
      inputPath: initialFile.path,
      batchSize: 10,
      repository,
    });
    importRunIds.push(initial.importRunId);
    assert.deepEqual(
      { total: initial.summary.total, success: initial.summary.success,
        failed: initial.summary.failed, skipped: initial.summary.skipped,
        status: initial.summary.status },
      { total: 20, success: 20, failed: 0, skipped: 0, status: 'completed' }
    );
    const foodsById = await verifyFoodRows(service, selected);
    assert.equal(
      [...foodsById.values()].filter((food) => food.review_status === 'pending').length,
      20
    );
    const aliasCount = await service.from('food_public_aliases')
      .select('id', { count: 'exact', head: true })
      .in('food_id', [...foodsById.values()].map((food) => food.id));
    const portionCount = await service.from('food_portions')
      .select('id', { count: 'exact', head: true })
      .in('food_id', [...foodsById.values()].map((food) => food.id));
    assert.equal(aliasCount.count, 7);
    assert.equal(portionCount.count, 45);

    for (const db of [anonymousClient, userAClient, userBClient]) {
      const hidden = await db.from('foods').select('id')
        .eq('source_name', 'AFCD').in('external_food_id', manifestIds);
      assert.ifError(hidden.error);
      assert.equal(hidden.data.length, 0);
      const audit = await db.from('food_import_runs').select('id')
        .eq('id', initial.importRunId);
      assert.ok(audit.error || audit.data.length === 0);
    }
    const adminPending = await adminClient.from('foods').select('id')
      .eq('source_name', 'AFCD').in('external_food_id', manifestIds);
    assert.ifError(adminPending.error);
    assert.equal(adminPending.data.length, 20);
    const adminAudit = await adminClient.from('food_import_runs').select('id')
      .eq('id', initial.importRunId);
    assert.ifError(adminAudit.error);
    assert.equal(adminAudit.data.length, 1);

    const approval = await adminClient.from('foods')
      .update({ review_status: 'approved', is_active: true })
      .eq('source_name', 'AFCD').in('external_food_id', approvedIds)
      .select('external_food_id');
    assert.ifError(approval.error);
    assert.equal(approval.data.length, 2);
    for (const db of [userAClient, userBClient]) {
      const visible = await db.from('foods').select('external_food_id')
        .eq('source_name', 'AFCD').in('external_food_id', manifestIds);
      assert.ifError(visible.error);
      assert.deepEqual(
        new Set(visible.data.map((food) => food.external_food_id)),
        new Set(approvedIds)
      );
      const visibleIds = approval.data.map((food) => foodsById.get(food.external_food_id).id);
      const aliases = await db.from('food_public_aliases').select('id').in('food_id', visibleIds);
      const portions = await db.from('food_portions').select('id').in('food_id', visibleIds);
      assert.ifError(aliases.error);
      assert.ifError(portions.error);
      assert.equal(aliases.data.length, 2);
      assert.equal(portions.data.length, 8);
    }

    const rerun = await runFoodImport({
      adapter: afcdAdapter,
      inputPath: initialFile.path,
      batchSize: 10,
      repository,
    });
    importRunIds.push(rerun.importRunId);
    assert.deepEqual(
      { total: rerun.summary.total, success: rerun.summary.success,
        failed: rerun.summary.failed, skipped: rerun.summary.skipped,
        status: rerun.summary.status },
      { total: 20, success: 0, failed: 0, skipped: 20, status: 'completed' }
    );
    const approvedAfter = await service.from('foods').select('external_food_id,review_status')
      .eq('source_name', 'AFCD').in('external_food_id', approvedIds);
    assert.ifError(approvedAfter.error);
    assert.ok(approvedAfter.data.every((food) => food.review_status === 'approved'));
    await verifyFoodRows(service, selected);

    const makeFailureRow = (base, id) => ({
      ...base,
      food_id: id,
      external_food_id: id,
      aliases: [],
      portions: [],
    });
    const failureRows = [
      makeFailureRow(selected[0], `LOCAL_TRIAL_${runToken}_A`),
      makeFailureRow(selected[1], `LOCAL_TRIAL_${runToken}_B`),
      { ...makeFailureRow(selected[2], `LOCAL_TRIAL_${runToken}_C`), energy_kcal: -1 },
      makeFailureRow(selected[3], `LOCAL_TRIAL_${runToken}_D`),
      selected[0],
    ];
    const failureFile = await tempInput(failureRows);
    tempFiles.push(failureFile);
    const failure = await runFoodImport({
      adapter: afcdAdapter,
      inputPath: failureFile.path,
      batchSize: 5,
      repository,
    });
    importRunIds.push(failure.importRunId);
    assert.deepEqual(
      { total: failure.summary.total, success: failure.summary.success,
        failed: failure.summary.failed, skipped: failure.summary.skipped,
        status: failure.summary.status },
      { total: 5, success: 3, failed: 1, skipped: 1, status: 'partially_failed' }
    );
    const errorAudit = await service.from('food_import_errors')
      .select('external_food_id,error_code,error_message,raw_summary')
      .eq('import_run_id', failure.importRunId).single();
    assert.ifError(errorAudit.error);
    assert.equal(errorAudit.data.external_food_id, `LOCAL_TRIAL_${runToken}_C`);
    assert.equal(errorAudit.data.error_code, 'VALIDATION_ERROR');
    assert.doesNotMatch(JSON.stringify(errorAudit.data), /authorization|service.role|jwt|password/i);
    assert.equal(
      (await queryAll(service, 'foods', 'id', 'external_food_id', `LOCAL_TRIAL_${runToken}_C`)).data.length,
      0
    );
    await service.from('foods').delete().eq('source_name', 'AFCD')
      .like('external_food_id', `LOCAL_TRIAL_${runToken}_%`);

    const finalFoods = await service.from('foods').select('external_food_id')
      .eq('source_name', 'AFCD');
    assert.ifError(finalFoods.error);
    assert.deepEqual(
      new Set(finalFoods.data.map((food) => food.external_food_id)),
      new Set(manifestIds)
    );
    const allAliases = await service.from('food_public_aliases').select('food_id');
    const allPortions = await service.from('food_portions').select('food_id');
    const allFoods = await service.from('foods').select('id');
    assert.ifError(allAliases.error);
    assert.ifError(allPortions.error);
    assert.ifError(allFoods.error);
    const existingFoodIds = new Set(allFoods.data.map((food) => food.id));
    assert.ok(allAliases.data.every((row) => existingFoodIds.has(row.food_id)));
    assert.ok(allPortions.data.every((row) => existingFoodIds.has(row.food_id)));

    return {
      initial: initial.summary,
      rerun: rerun.summary,
      failure: failure.summary,
      foods: 20,
      aliases: aliasCount.count,
      portions: portionCount.count,
      approved: approvedIds,
    };
  } finally {
    for (const file of tempFiles) await file.remove();
    if (importRunIds.length > 0) {
      await service.from('food_import_runs').delete().in('id', importRunIds);
    }
    await cleanupTrial(service, manifestIds, users);
  }
}

export async function runLocalTrial(mode = 'full') {
  assert.ok(allowedModes.has(mode), `unsupported trial mode: ${mode}`);
  const packageContent = await readFile(datasetPath);
  const dataset = JSON.parse(packageContent);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const audit = JSON.parse(await readFile(auditPath, 'utf8'));
  assert.equal(dataset.length, 400);
  assert.equal(sha256(packageContent), expectedPackageHash);
  assert.equal(audit.final_package_sha256, expectedPackageHash);
  validateTrialManifest(manifest, dataset);
  const selectedIds = new Set(manifest.map((item) => item.external_food_id));
  const selected = dataset.filter((food) => selectedIds.has(food.external_food_id));
  assert.equal(selected.length, 20);

  if (mode === 'verify-only') {
    return { mode, manifest: 20, packageHash: expectedPackageHash };
  }

  const values = localEnvironment();
  const service = client(values.API_URL, values.SERVICE_ROLE_KEY);
  if (mode === 'cleanup') {
    await cleanupTrial(service, [...selectedIds]);
    return { mode, cleaned: true };
  }

  // Each public mode is an isolated, self-cleaning scenario. The complete
  // orchestration proves first-run, rerun, failure isolation, verification,
  // and cleanup without relying on state from an earlier process.
  const result = await executeFullTrial({
    service,
    anonKey: values.ANON_KEY,
    apiUrl: values.API_URL,
    selected,
    manifest,
  });
  return { mode, packageHash: sha256(await readFile(datasetPath)), ...result };
}

function selectedMode(argv) {
  const index = argv.indexOf('--mode');
  return index === -1 ? 'full' : argv[index + 1];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runLocalTrial(selectedMode(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Local trial import failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
