import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  assertLinkedRemoteTrialProject,
  assertRemoteMigrationHistory,
  assertRemoteTrialEnvironment,
  parseRemoteTrialArgs,
  REMOTE_TRIAL_MIGRATIONS,
  REMOTE_TRIAL_PROJECT_REF,
  safeRemoteTrialSummary,
  validateRemoteTrialAssets,
} from './remote-trial-guard.mjs';
import { runRemoteTrial } from './run-remote-trial-import.mjs';
import { verifyRemoteTrial } from './verify-remote-trial-import.mjs';

const packageUrl = new URL(
  './dataset/public-foods-afcd-initial.json',
  import.meta.url
);
const manifestUrl = new URL(
  './dataset/local-trial-import-manifest.json',
  import.meta.url
);
const packageContent = await readFile(packageUrl);
const dataset = JSON.parse(packageContent);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const guardedEnv = {
  SUPABASE_PROJECT_REF: REMOTE_TRIAL_PROJECT_REF,
  CONFIRM_REMOTE_TRIAL_IMPORT: REMOTE_TRIAL_PROJECT_REF,
  SUPABASE_URL: `https://${REMOTE_TRIAL_PROJECT_REF}.supabase.co`,
};

test('missing explicit confirmation is rejected', () => {
  assert.throws(
    () => assertRemoteTrialEnvironment({
      ...guardedEnv,
      CONFIRM_REMOTE_TRIAL_IMPORT: undefined,
    }),
    /explicitly match/
  );
});

test('wrong project ref is rejected', () => {
  assert.throws(
    () => assertRemoteTrialEnvironment({
      ...guardedEnv,
      SUPABASE_PROJECT_REF: 'wrong-project',
    }),
    /does not match/
  );
});

test('repository link must match the guarded project', () => {
  assert.doesNotThrow(() => assertLinkedRemoteTrialProject(REMOTE_TRIAL_PROJECT_REF));
  assert.throws(
    () => assertLinkedRemoteTrialProject('different-linked-project'),
    /repository link/
  );
});

test('wrong or local Supabase URL is rejected', () => {
  assert.throws(
    () => assertRemoteTrialEnvironment({
      ...guardedEnv,
      SUPABASE_URL: 'https://other.supabase.co',
    }),
    /does not belong/
  );
  assert.throws(
    () => assertRemoteTrialEnvironment({
      ...guardedEnv,
      SUPABASE_URL: 'http://127.0.0.1:54321',
    }),
    /HTTPS/
  );
});

test('manifest must contain exactly 20 entries', () => {
  assert.throws(
    () => validateRemoteTrialAssets({
      packageContent,
      dataset,
      manifest: manifest.slice(0, 19),
    }),
    /exactly 20/
  );
});

test('manifest duplicate IDs are rejected', () => {
  const duplicated = [...manifest];
  duplicated[19] = { ...duplicated[19], external_food_id: duplicated[0].external_food_id };
  assert.throws(
    () => validateRemoteTrialAssets({ packageContent, dataset, manifest: duplicated }),
    /must be unique/
  );
});

test('manifest IDs outside the reviewed package are rejected', () => {
  const outside = [...manifest];
  outside[19] = { ...outside[19], external_food_id: 'NOT_IN_FINAL_PACKAGE' };
  assert.throws(
    () => validateRemoteTrialAssets({ packageContent, dataset, manifest: outside }),
    /outside the reviewed package/
  );
});

test('changed final package hash is rejected', () => {
  const changed = Buffer.concat([packageContent, Buffer.from(' ')]);
  assert.throws(
    () => validateRemoteTrialAssets({
      packageContent: changed,
      dataset,
      manifest,
    }),
    /SHA-256/
  );
});

test('remote trial defaults to dry-run', () => {
  assert.deepEqual(parseRemoteTrialArgs([]), { execute: false });
  assert.deepEqual(parseRemoteTrialArgs(['--execute']), { execute: true });
});

test('dry-run performs no repository writes', async () => {
  let repositoryCreated = 0;
  const result = await runRemoteTrial({
    env: guardedEnv,
    packageContent,
    manifest,
    repositoryFactory: () => {
      repositoryCreated += 1;
      throw new Error('repository must not be created');
    },
  });
  assert.equal(result.mode, 'dry-run');
  assert.equal(repositoryCreated, 0);
  assert.equal(result.database_writes, 0);
});

test('dry-run creates no import run', async () => {
  const result = await runRemoteTrial({
    env: guardedEnv,
    packageContent,
    manifest,
  });
  assert.equal(result.import_runs_created, 0);
});

test('dry-run makes no RPC or migration-list call', async () => {
  let migrationCalls = 0;
  const result = await runRemoteTrial({
    env: guardedEnv,
    packageContent,
    manifest,
    migrationReader: () => {
      migrationCalls += 1;
      throw new Error('dry-run must remain offline');
    },
  });
  assert.equal(result.rpc_calls, 0);
  assert.equal(migrationCalls, 0);
});

test('execute requires the service role key in addition to --execute', () => {
  assert.throws(
    () => assertRemoteTrialEnvironment(guardedEnv, { execute: true }),
    /required only for explicit execution/
  );
});

test('input overrides and full-package bypass arguments are rejected', () => {
  assert.throws(() => parseRemoteTrialArgs(['--input', 'all-400.json']), /unsupported/);
  assert.throws(() => parseRemoteTrialArgs(['--limit=400']), /unsupported/);
  assert.throws(() => parseRemoteTrialArgs(['cleanup']), /unsupported/);
});

test('safe logs never contain supplied secrets', () => {
  const secret = 'do-not-print-this-service-role-value';
  const summary = safeRemoteTrialSummary({
    mode: 'dry-run',
    plannedAliases: 7,
    plannedPortions: 45,
    serviceRoleProvided: Boolean(secret),
  });
  assert.equal(summary.service_role_key, 'provided');
  assert.doesNotMatch(JSON.stringify(summary), new RegExp(secret));
});

test('execute preflight requires exact local and remote migration history', () => {
  const good = REMOTE_TRIAL_MIGRATIONS.map((version) => ({
    local: version,
    remote: version,
  }));
  assert.doesNotThrow(() => assertRemoteMigrationHistory(good));
  assert.throws(
    () => assertRemoteMigrationHistory(good.slice(0, -1)),
    /migration history/
  );
});

test('verified trial assets are strictly scoped to AFCD and 20 IDs', () => {
  const assets = validateRemoteTrialAssets({ packageContent, dataset, manifest });
  assert.equal(assets.scope.sourceName, 'AFCD');
  assert.equal(assets.scope.externalFoodIds.length, 20);
  assert.equal(new Set(assets.scope.externalFoodIds).size, 20);
  assert.equal(assets.plannedAliases, 7);
  assert.equal(assets.plannedPortions, 45);
});

test('remote verifier queries only the exact run and manifest food scope', async () => {
  const calls = [];
  const runId = '123e4567-e89b-42d3-a456-426614174000';
  const responses = {
    food_import_runs: {
      id: runId, total_count: 20, success_count: 20, failed_count: 0,
      skipped_count: 0, status: 'completed',
    },
    foods: manifest.map((item, index) => ({
      id: `food-${index}`,
      external_food_id: item.external_food_id,
      review_status: 'pending',
      source_name: 'AFCD',
    })),
    food_public_aliases: [],
    food_portions: [],
  };
  const clientFactory = () => ({
    from(table) {
      const filters = [];
      const chain = {
        select() { return chain; },
        eq(column, value) { filters.push(['eq', column, value]); return chain; },
        in(column, values) { filters.push(['in', column, values]); return chain; },
        single() {
          calls.push({ table, filters });
          return Promise.resolve({ data: responses[table], error: null });
        },
        then(resolve) {
          calls.push({ table, filters });
          return Promise.resolve({ data: responses[table], error: null }).then(resolve);
        },
      };
      return chain;
    },
  });
  const result = await verifyRemoteTrial({
    env: {
      ...guardedEnv,
      SUPABASE_SERVICE_ROLE_KEY: 'test-only-secret',
      REMOTE_TRIAL_IMPORT_RUN_ID: runId,
    },
    clientFactory,
    packageContent,
    manifest,
  });
  const runCall = calls.find((call) => call.table === 'food_import_runs');
  const foodCall = calls.find((call) => call.table === 'foods');
  assert.ok(runCall.filters.some((filter) => filter[1] === 'id' && filter[2] === runId));
  assert.ok(foodCall.filters.some(
    (filter) => filter[1] === 'source_name' && filter[2] === 'AFCD'
  ));
  assert.ok(foodCall.filters.some(
    (filter) => filter[0] === 'in' && filter[2].length === 20
  ));
  assert.equal(result.foods, 20);
});

test('remote verification tool contains no cleanup, delete, or update operation', async () => {
  const source = await readFile(
    new URL('./verify-remote-trial-import.mjs', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /\.delete\s*\(/);
  assert.doesNotMatch(source, /\.update\s*\(/);
  assert.doesNotMatch(source, /cleanupTrial/);
});
