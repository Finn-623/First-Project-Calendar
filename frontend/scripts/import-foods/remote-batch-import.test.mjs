import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  assertLinkedRemoteBatchProject,
  assertRemoteBatchEnvironment,
  assertRemoteBatchMigrationHistory,
  parseRemoteBatchArgs,
  REMOTE_BATCH_MIGRATIONS,
  REMOTE_BATCH_PROJECT_REF,
  safeRemoteBatchSummary,
  validateRemoteBatchAssets,
} from './remote-batch-guard.mjs';
import {
  parseLinkedMigrationHistory,
  runRemoteBatch,
} from './run-remote-batch-import.mjs';

const packageContent = await readFile(
  new URL('./dataset/public-foods-afcd-initial.json', import.meta.url)
);
const dataset = JSON.parse(packageContent);
const trialManifest = JSON.parse(await readFile(
  new URL('./dataset/local-trial-import-manifest.json', import.meta.url),
  'utf8'
));
const guardedEnv = {
  SUPABASE_PROJECT_REF: REMOTE_BATCH_PROJECT_REF,
  CONFIRM_REMOTE_BATCH_IMPORT: 'true',
  SUPABASE_URL: `https://${REMOTE_BATCH_PROJECT_REF}.supabase.co`,
};

test('Supabase migration output supports JSON and table formats', () => {
  assert.deepEqual(
    parseLinkedMigrationHistory(
      JSON.stringify({ migrations: [{ local: '001', remote: '001', time: '001' }] })
    ),
    [{ local: '001', remote: '001' }]
  );
  assert.deepEqual(
    parseLinkedMigrationHistory('Local | Remote | Time\n`001` | `001` | `001`'),
    [{ local: '001', remote: '001' }]
  );
});

test('reviewed package is exactly 400 AFCD foods and includes all trial foods', () => {
  const assets = validateRemoteBatchAssets({ packageContent, dataset, trialManifest });
  assert.equal(assets.scope.externalFoodIds.length, 400);
  assert.equal(new Set(assets.scope.externalFoodIds).size, 400);
  assert.equal(assets.trialFoodIds.length, 20);
  assert.equal(assets.plannedAliases, 100);
  assert.equal(assets.plannedPortions, 501);
});

test('changed package, wrong target, missing confirmation, and arbitrary args are rejected', () => {
  assert.throws(
    () => validateRemoteBatchAssets({
      packageContent: Buffer.concat([packageContent, Buffer.from(' ')]),
      dataset,
      trialManifest,
    }),
    /SHA-256/
  );
  assert.throws(
    () => assertRemoteBatchEnvironment({ ...guardedEnv, SUPABASE_PROJECT_REF: 'wrong' }),
    /does not match/
  );
  assert.throws(
    () => assertRemoteBatchEnvironment({
      ...guardedEnv,
      CONFIRM_REMOTE_BATCH_IMPORT: undefined,
    }),
    /exactly true/
  );
  assert.throws(() => parseRemoteBatchArgs(['--input=other.json']), /unsupported/);
});

test('execute requires service role and exact linked project and migration chain', () => {
  assert.throws(
    () => assertRemoteBatchEnvironment(guardedEnv, { execute: true }),
    /required only/
  );
  assert.doesNotThrow(() => assertLinkedRemoteBatchProject(REMOTE_BATCH_PROJECT_REF));
  assert.throws(() => assertLinkedRemoteBatchProject('other'), /repository link/);
  const migrations = REMOTE_BATCH_MIGRATIONS.map((version) => ({
    local: version,
    remote: version,
  }));
  assert.doesNotThrow(() => assertRemoteBatchMigrationHistory(migrations));
  assert.throws(
    () => assertRemoteBatchMigrationHistory(migrations.slice(0, -1)),
    /migration history/
  );
});

test('default dry-run validates all 400 rows without repository or remote calls', async () => {
  let repositoryCalls = 0;
  let migrationCalls = 0;
  const result = await runRemoteBatch({
    env: guardedEnv,
    packageContent,
    trialManifest,
    repositoryFactory: () => {
      repositoryCalls += 1;
      throw new Error('repository must not be created');
    },
    migrationReader: () => {
      migrationCalls += 1;
      throw new Error('migration list must not be read');
    },
  });
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.database_writes, 0);
  assert.equal(result.import_runs_created, 0);
  assert.equal(repositoryCalls, 0);
  assert.equal(migrationCalls, 0);
});

test('safe batch summary does not expose a supplied secret', () => {
  const secret = 'never-print-this-value';
  const summary = safeRemoteBatchSummary({
    mode: 'dry-run',
    serviceRoleProvided: Boolean(secret),
    plannedAliases: 100,
    plannedPortions: 501,
  });
  assert.equal(summary.service_role_key, 'provided');
  assert.doesNotMatch(JSON.stringify(summary), new RegExp(secret));
});

test('two executions use existing-key checks and create distinct audit runs', async () => {
  const existing = new Set(
    trialManifest.map((item) => `AFCD\u0000${item.external_food_id}`)
  );
  const imported = new Set(existing);
  const runs = [];
  let rpcCalls = 0;
  const repository = {
    async startRun() {
      const id = `run-${runs.length + 1}`;
      runs.push({ id });
      return id;
    },
    async findExistingKeys() { return new Set(imported); },
    async importFoodAtomic(_runId, food) {
      imported.add(`AFCD\u0000${food.external_food_id}`);
      rpcCalls += 1;
      return { status: 'success' };
    },
    async recordErrors() {},
    async finishRun(id, summary) {
      runs.find((run) => run.id === id).summary = { ...summary };
    },
  };
  const options = {
    argv: ['--execute'],
    env: { ...guardedEnv, SUPABASE_SERVICE_ROLE_KEY: 'test-secret' },
    packageContent,
    trialManifest,
    repositoryFactory: () => repository,
    migrationReader: () => REMOTE_BATCH_MIGRATIONS.map((version) => ({
      local: version,
      remote: version,
    })),
  };
  const first = await runRemoteBatch(options);
  const second = await runRemoteBatch(options);
  assert.deepEqual(
    [first.import.success, first.import.skipped, first.import.failed],
    [380, 20, 0]
  );
  assert.deepEqual(
    [second.import.success, second.import.skipped, second.import.failed],
    [0, 400, 0]
  );
  assert.equal(rpcCalls, 380);
  assert.equal(runs.length, 2);
  assert.notEqual(runs[0].id, runs[1].id);
});
