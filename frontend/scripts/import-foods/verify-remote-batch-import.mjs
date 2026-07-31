#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  assertLinkedRemoteBatchProject,
  assertRemoteBatchEnvironment,
  validateRemoteBatchAssets,
} from './remote-batch-guard.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const packagePath = resolve(
  repoRoot,
  'frontend/scripts/import-foods/dataset/public-foods-afcd-initial.json'
);
const manifestPath = resolve(
  repoRoot,
  'frontend/scripts/import-foods/dataset/local-trial-import-manifest.json'
);
const linkedProjectRefPath = resolve(repoRoot, 'supabase/.temp/project-ref');
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const USERNAME_LOGIN_PATH = '/functions/v1/username-login';

function parseArgs(argv) {
  assert.equal(argv.length, 1, 'use exactly one mode: --preflight, --post-first, or --post-second');
  assert.ok(
    ['--preflight', '--post-first', '--post-second'].includes(argv[0]),
    'unsupported remote batch verification mode'
  );
  return argv[0].slice(2);
}

async function exactCount(query, label) {
  const result = await query;
  assert.ifError(result.error);
  assert.equal(typeof result.count, 'number', `${label} count is unavailable`);
  return result.count;
}

async function loadRows(query, label) {
  const result = await query;
  assert.ifError(result.error);
  assert.ok(Array.isArray(result.data), `${label} rows are unavailable`);
  return result.data;
}

async function loadRowsByFoodIds(client, table, columns, foodIds, label) {
  const rows = [];
  for (let offset = 0; offset < foodIds.length; offset += 50) {
    rows.push(...await loadRows(
      client.from(table).select(columns).in('food_id', foodIds.slice(offset, offset + 50)),
      label
    ));
  }
  return rows;
}

function canonical(value) {
  return String(value).trim().toLocaleLowerCase();
}

async function signInWithUsername({ env, clientFactory, fetchImpl = fetch }) {
  const response = await fetchImpl(`${env.SUPABASE_URL}${USERNAME_LOGIN_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      username: env.TEST_USERNAME.trim().toLowerCase(),
      password: env.TEST_USER_PASSWORD,
    }),
  });
  assert.equal(response.status, 200, 'username-login did not authenticate the test user');
  const payload = await response.json();
  assert.ok(payload?.access_token && payload?.refresh_token, 'username-login session is incomplete');

  const client = clientFactory(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, clientOptions);
  const session = await client.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  assert.ifError(session.error);
  assert.ok(session.data.user?.id, 'ordinary test user session was not created');
  return client;
}

export async function verifyRemoteBatch({
  argv = process.argv.slice(2),
  env = process.env,
  clientFactory = createClient,
  packageContent: packageOverride,
  trialManifest: manifestOverride,
  linkedProjectRefReader = () => readFile(linkedProjectRefPath, 'utf8'),
} = {}) {
  const mode = parseArgs(argv);
  assert.equal(
    resolve(process.cwd()),
    resolve(repoRoot),
    'verification must run from the repository root'
  );
  assertRemoteBatchEnvironment(env, { execute: true });
  assertLinkedRemoteBatchProject(await linkedProjectRefReader());
  assert.ok(env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY is required');
  assert.ok(env.TEST_USERNAME, 'TEST_USERNAME is required');
  assert.ok(env.TEST_USER_PASSWORD, 'TEST_USER_PASSWORD is required');

  const packageContent = packageOverride ?? await readFile(packagePath);
  const dataset = JSON.parse(packageContent);
  const trialManifest =
    manifestOverride ?? JSON.parse(await readFile(manifestPath, 'utf8'));
  const assets = validateRemoteBatchAssets({ packageContent, dataset, trialManifest });
  const service = clientFactory(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, clientOptions);
  const anonymous = clientFactory(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, clientOptions);
  const ordinary = await signInWithUsername({ env, clientFactory });
  const adminCheck = await ordinary.rpc('is_app_admin');
  assert.ifError(adminCheck.error);
  assert.equal(adminCheck.data, false, 'permission test account must not be an administrator');

  try {
    const expectedFoods = mode === 'preflight' ? 20 : 400;
    const afcdFoods = await loadRows(
      service.from('foods').select([
        'id', 'external_food_id', 'review_status', 'is_active', 'visibility',
        'energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fiber_g',
        'saturated_fat_g', 'monounsaturated_fat_g', 'polyunsaturated_fat_g',
        'trans_fat_g', 'total_sugar_g', 'added_sugar_g', 'sugar_alcohol_g',
        'sodium_mg', 'potassium_mg',
      ].join(',')).eq('source_name', 'AFCD'),
      'AFCD foods'
    );
    assert.equal(afcdFoods.length, expectedFoods, `AFCD food count must be ${expectedFoods}`);
    const externalIds = afcdFoods.map((food) => food.external_food_id);
    assert.equal(new Set(externalIds).size, afcdFoods.length, 'duplicate AFCD identities found');
    assert.ok(externalIds.every((id) => assets.scope.externalFoodIds.includes(id)));
    assert.ok(assets.trialFoodIds.every((id) => externalIds.includes(id)));
    assert.ok(afcdFoods.every((food) =>
      food.review_status === 'pending'
      && food.is_active === true
      && food.visibility === 'public'
    ));

    const foodIds = afcdFoods.map((food) => food.id);
    const aliases = await loadRowsByFoodIds(
      service, 'food_public_aliases', 'id,food_id,alias', foodIds,
      'public aliases'
    );
    const portions = await loadRowsByFoodIds(
      service, 'food_portions', 'id,food_id,portion_name,grams', foodIds,
      'portions'
    );
    const expectedAliases = mode === 'preflight' ? 7 : 100;
    const expectedPortions = mode === 'preflight' ? 45 : 501;
    assert.equal(aliases.length, expectedAliases);
    assert.equal(portions.length, expectedPortions);
    assert.equal(
      new Set(aliases.map((row) => `${row.food_id}\0${canonical(row.alias)}`)).size,
      aliases.length,
      'duplicate public aliases found'
    );
    assert.equal(
      new Set(portions.map((row) => `${row.food_id}\0${canonical(row.portion_name)}`)).size,
      portions.length,
      'duplicate portions found'
    );
    const knownFoodIds = new Set(foodIds);
    assert.ok(aliases.every((row) => knownFoodIds.has(row.food_id)));
    assert.ok(portions.every((row) => knownFoodIds.has(row.food_id)));
    assert.ok(portions.every((row) => Number(row.grams) > 0));

    const nutrientFields = [
      'energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fiber_g',
      'saturated_fat_g', 'monounsaturated_fat_g', 'polyunsaturated_fat_g',
      'trans_fat_g', 'total_sugar_g', 'added_sugar_g', 'sugar_alcohol_g',
      'sodium_mg', 'potassium_mg',
    ];
    const invalidNutrients = afcdFoods.filter((food) =>
      nutrientFields.some((field) =>
        food[field] !== null && (!Number.isFinite(Number(food[field])) || Number(food[field]) < 0)
      )
      || (
        food.total_sugar_g !== null
        && Number(food.total_sugar_g) > Number(food.carbohydrate_g)
      )
      || (
        food.added_sugar_g !== null
        && Number(food.added_sugar_g) > Number(food.total_sugar_g)
      )
    );
    assert.equal(invalidNutrients.length, 0, 'invalid nutrient rows found');

    const anonymousFoods = await loadRows(
      anonymous.from('foods').select('id').eq('source_name', 'AFCD'),
      'anonymous AFCD foods'
    );
    const ordinaryFoods = await loadRows(
      ordinary.from('foods').select('id').eq('source_name', 'AFCD'),
      'ordinary AFCD foods'
    );
    const anonymousAliases = await loadRowsByFoodIds(
      anonymous, 'food_public_aliases', 'id', foodIds,
      'anonymous aliases'
    );
    const ordinaryAliases = await loadRowsByFoodIds(
      ordinary, 'food_public_aliases', 'id', foodIds,
      'ordinary aliases'
    );
    const anonymousPortions = await loadRowsByFoodIds(
      anonymous, 'food_portions', 'id', foodIds,
      'anonymous portions'
    );
    const ordinaryPortions = await loadRowsByFoodIds(
      ordinary, 'food_portions', 'id', foodIds,
      'ordinary portions'
    );
    assert.equal(anonymousFoods.length, 0, 'anonymous user can read pending AFCD foods');
    assert.equal(ordinaryFoods.length, 0, 'ordinary user can read pending AFCD foods');
    assert.equal(anonymousAliases.length, 0, 'anonymous user can read pending aliases');
    assert.equal(ordinaryAliases.length, 0, 'ordinary user can read pending aliases');
    assert.equal(anonymousPortions.length, 0, 'anonymous user can read pending portions');
    assert.equal(ordinaryPortions.length, 0, 'ordinary user can read pending portions');
    const anonymousAudit = await anonymous.from('food_import_runs').select('id').limit(1);
    const ordinaryAudit = await ordinary.from('food_import_runs').select('id').limit(1);
    assert.ok(anonymousAudit.error || anonymousAudit.data.length === 0);
    assert.ok(ordinaryAudit.error || ordinaryAudit.data.length === 0);

    const totalFoods = await exactCount(
      service.from('foods').select('id', { count: 'exact', head: true }),
      'total foods'
    );
    const legacyFoods = await exactCount(
      service.from('foods').select('id', { count: 'exact', head: true })
        .is('source_name', null),
      'legacy foods'
    );
    const privateFoods = await exactCount(
      service.from('foods').select('id', { count: 'exact', head: true })
        .eq('visibility', 'private'),
      'private foods'
    );
    assert.equal(legacyFoods, 2, 'the two legacy foods must remain');
    if (env.REMOTE_BATCH_BASELINE_PRIVATE_FOODS !== undefined) {
      assert.equal(privateFoods, Number(env.REMOTE_BATCH_BASELINE_PRIVATE_FOODS));
    }

    const expectedRuns = mode === 'post-second' ? 2 : mode === 'post-first' ? 1 : 0;
    let runs = [];
    if (expectedRuns > 0) {
      const result = await service.from('food_import_runs')
        .select([
          'id', 'status', 'total_count', 'success_count', 'failed_count',
          'skipped_count', 'started_at',
        ].join(','))
        .eq('source_name', 'AFCD')
        .eq('input_identifier', 'public-foods-afcd-initial.json')
        .order('started_at', { ascending: false })
        .limit(expectedRuns);
      assert.ifError(result.error);
      assert.equal(result.data.length, expectedRuns, `${mode} audit run count is incomplete`);
      runs = [...result.data].reverse();
    }
    if (mode !== 'preflight') {
      assert.deepEqual(
        {
          status: runs[0].status,
          total: runs[0].total_count,
          success: runs[0].success_count,
          failed: runs[0].failed_count,
          skipped: runs[0].skipped_count,
        },
        { status: 'completed', total: 400, success: 380, failed: 0, skipped: 20 }
      );
    }
    if (mode === 'post-second') {
      assert.deepEqual(
        {
          status: runs[1].status,
          total: runs[1].total_count,
          success: runs[1].success_count,
          failed: runs[1].failed_count,
          skipped: runs[1].skipped_count,
        },
        { status: 'completed', total: 400, success: 0, failed: 0, skipped: 400 }
      );
    }

    return {
      mode,
      target_project_ref_matches: true,
      credentials: {
        anonymous: 'usable',
        ordinary_username_login: 'usable',
        ordinary_is_admin: false,
        service: 'usable',
      },
      foods: {
        total: totalFoods,
        afcd: afcdFoods.length,
        legacy: legacyFoods,
        private: privateFoods,
        pending: afcdFoods.filter((food) => food.review_status === 'pending').length,
        approved: afcdFoods.filter((food) => food.review_status === 'approved').length,
        disabled: afcdFoods.filter((food) => food.review_status === 'disabled').length,
      },
      children: {
        aliases: aliases.length,
        portions: portions.length,
        duplicate_aliases: 0,
        duplicate_portions: 0,
        orphan_aliases: 0,
        orphan_portions: 0,
      },
      invalid_nutrient_rows: 0,
      trial_foods_retained: 20,
      permissions: {
        anonymous_pending_visible: 0,
        ordinary_pending_visible: 0,
        anonymous_pending_aliases_visible: 0,
        ordinary_pending_aliases_visible: 0,
        anonymous_pending_portions_visible: 0,
        ordinary_pending_portions_visible: 0,
        anonymous_audit_visible: 0,
        ordinary_audit_visible: 0,
      },
      import_runs: runs.map((run) => ({
        id: `${run.id.slice(0, 8)}…`,
        status: run.status,
        total: run.total_count,
        success: run.success_count,
        failed: run.failed_count,
        skipped: run.skipped_count,
      })),
    };
  } finally {
    await ordinary.auth.signOut();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyRemoteBatch();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Remote batch verification stopped: ${error.message}\n`);
    process.exitCode = 1;
  }
}
