import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const REMOTE_BATCH_PROJECT_REF = 'ragxhkzvaaoembqudnux';
export const REMOTE_BATCH_PACKAGE_HASH =
  '4b9b3f342727ff39aafa1fb189496f13a76c3e11d5c125c55b858076c5d4696b';
export const REMOTE_BATCH_MIGRATIONS = [
  '001', '003', '004', '005', '006', '007', '008', '009', '010', '011',
  '012', '013', '014', '015', '016', '017', '018', '019', '020', '021',
  '022', '023', '024', '025', '026',
];

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function assertRemoteBatchEnvironment(env, { execute = false } = {}) {
  assert.equal(
    env.SUPABASE_PROJECT_REF,
    REMOTE_BATCH_PROJECT_REF,
    'SUPABASE_PROJECT_REF does not match the guarded Calendar project'
  );
  assert.equal(
    env.CONFIRM_REMOTE_BATCH_IMPORT,
    'true',
    'CONFIRM_REMOTE_BATCH_IMPORT must be exactly true'
  );

  const url = new URL(env.SUPABASE_URL || 'invalid://missing');
  assert.equal(url.protocol, 'https:', 'remote batch URL must use HTTPS');
  assert.equal(
    url.hostname,
    `${REMOTE_BATCH_PROJECT_REF}.supabase.co`,
    'SUPABASE_URL does not belong to the guarded Calendar project'
  );
  if (execute) {
    assert.ok(
      env.SUPABASE_SERVICE_ROLE_KEY,
      'SUPABASE_SERVICE_ROLE_KEY is required only for explicit execution'
    );
  }
}

export function assertLinkedRemoteBatchProject(linkedProjectRef) {
  assert.equal(
    linkedProjectRef?.trim(),
    REMOTE_BATCH_PROJECT_REF,
    'repository link does not match the guarded Calendar project'
  );
}

export function validateRemoteBatchAssets({ packageContent, dataset, trialManifest }) {
  assert.equal(dataset.length, 400, 'final package must contain exactly 400 foods');
  assert.equal(
    sha256(packageContent),
    REMOTE_BATCH_PACKAGE_HASH,
    'final package SHA-256 does not match the reviewed package'
  );

  const ids = dataset.map((food) => food.external_food_id);
  assert.equal(new Set(ids).size, 400, 'final package external IDs must be unique');
  assert.ok(dataset.every((food) => food.source_name === 'AFCD'));
  assert.ok(
    dataset.every((food) => food.review_status === 'pending'),
    'all final package foods must remain pending'
  );

  const idSet = new Set(ids);
  assert.equal(trialManifest.length, 20, 'trial manifest must contain exactly 20 foods');
  assert.ok(
    trialManifest.every((item) => idSet.has(item.external_food_id)),
    'all 20 trial foods must belong to the final package'
  );

  return {
    scope: { sourceName: 'AFCD', externalFoodIds: ids },
    trialFoodIds: trialManifest.map((item) => item.external_food_id),
    plannedAliases: dataset.reduce(
      (total, food) => total + (food.aliases?.length || 0),
      0
    ),
    plannedPortions: dataset.reduce(
      (total, food) => total + (food.portions?.length || 0),
      0
    ),
  };
}

export function parseRemoteBatchArgs(argv) {
  const allowed = new Set(['--execute']);
  for (const argument of argv) {
    assert.ok(allowed.has(argument), `unsupported remote batch argument: ${argument}`);
  }
  return { execute: argv.includes('--execute') };
}

export function assertRemoteBatchMigrationHistory(migrations) {
  assert.ok(Array.isArray(migrations), 'remote migration list is missing');
  const local = migrations.map((migration) => migration.local).filter(Boolean);
  const remote = migrations.map((migration) => migration.remote).filter(Boolean);
  assert.deepEqual(local, REMOTE_BATCH_MIGRATIONS, 'local migration history is unexpected');
  assert.deepEqual(remote, REMOTE_BATCH_MIGRATIONS, 'remote migrations 001-026 are required');
}

export function safeRemoteBatchSummary({
  mode,
  serviceRoleProvided,
  plannedAliases,
  plannedPortions,
  summary = null,
  importRunId = null,
}) {
  return {
    mode,
    target_project_ref: REMOTE_BATCH_PROJECT_REF,
    target_project_ref_matches: true,
    selected_foods: 400,
    included_trial_foods: 20,
    final_package_sha256: REMOTE_BATCH_PACKAGE_HASH,
    final_package_sha256_matches: true,
    planned_aliases: plannedAliases,
    planned_portions: plannedPortions,
    planned_review_status: 'pending',
    service_role_key: serviceRoleProvided ? 'provided' : 'not provided',
    database_writes: mode === 'dry-run' ? 0 : summary?.success ?? null,
    import_runs_created: mode === 'dry-run' ? 0 : 1,
    ...(summary ? { import: summary } : {}),
    ...(importRunId ? { import_run: `${importRunId.slice(0, 8)}…` } : {}),
  };
}
