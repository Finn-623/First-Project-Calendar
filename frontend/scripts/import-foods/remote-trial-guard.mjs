import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const REMOTE_TRIAL_PROJECT_REF = 'ragxhkzvaaoembqudnux';
export const REMOTE_TRIAL_PACKAGE_HASH =
  '30c36b5e97e45068202be829b7e1e731f638b58eb666b39772cc4c657c3fbb1d';
export const REMOTE_TRIAL_MIGRATIONS = [
  '001', '003', '004', '005', '006', '007', '008', '009', '010', '011',
  '012', '013', '014', '015', '016', '017', '018', '019', '020', '021',
  '022', '023', '024', '025', '026',
];

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function assertRemoteTrialEnvironment(env, { execute = false } = {}) {
  assert.equal(
    env.SUPABASE_PROJECT_REF,
    REMOTE_TRIAL_PROJECT_REF,
    'SUPABASE_PROJECT_REF does not match the guarded Calendar project'
  );
  assert.equal(
    env.CONFIRM_REMOTE_TRIAL_IMPORT,
    REMOTE_TRIAL_PROJECT_REF,
    'CONFIRM_REMOTE_TRIAL_IMPORT must explicitly match the guarded project'
  );

  const url = new URL(env.SUPABASE_URL || 'invalid://missing');
  assert.equal(url.protocol, 'https:', 'remote trial URL must use HTTPS');
  assert.equal(
    url.hostname,
    `${REMOTE_TRIAL_PROJECT_REF}.supabase.co`,
    'SUPABASE_URL does not belong to the guarded Calendar project'
  );
  assert.ok(!['localhost', '127.0.0.1'].includes(url.hostname));

  if (execute) {
    assert.ok(
      env.SUPABASE_SERVICE_ROLE_KEY,
      'SUPABASE_SERVICE_ROLE_KEY is required only for explicit execution'
    );
  }
}

export function assertLinkedRemoteTrialProject(linkedProjectRef) {
  assert.equal(
    linkedProjectRef?.trim(),
    REMOTE_TRIAL_PROJECT_REF,
    'repository link does not match the guarded Calendar project'
  );
}

export function validateRemoteTrialAssets({
  packageContent,
  dataset,
  manifest,
}) {
  assert.equal(dataset.length, 400, 'final package must contain exactly 400 foods');
  assert.equal(
    sha256(packageContent),
    REMOTE_TRIAL_PACKAGE_HASH,
    'final package SHA-256 does not match the reviewed package'
  );
  assert.equal(manifest.length, 20, 'remote trial manifest must contain exactly 20 foods');

  const manifestIds = manifest.map((item) => item.external_food_id);
  assert.equal(
    new Set(manifestIds).size,
    20,
    'remote trial manifest external IDs must be unique'
  );
  const byId = new Map(dataset.map((food) => [food.external_food_id, food]));
  const selected = manifestIds.map((id) => {
    const food = byId.get(id);
    assert.ok(food, `manifest food is outside the reviewed package: ${id}`);
    return food;
  });
  assert.equal(selected.length, 20);

  return {
    selected,
    scope: {
      sourceName: 'AFCD',
      externalFoodIds: [...manifestIds],
    },
    plannedAliases: selected.reduce(
      (total, food) => total + (food.aliases?.length || 0),
      0
    ),
    plannedPortions: selected.reduce(
      (total, food) => total + (food.portions?.length || 0),
      0
    ),
  };
}

export function parseRemoteTrialArgs(argv) {
  const allowed = new Set(['--execute']);
  for (const argument of argv) {
    assert.ok(allowed.has(argument), `unsupported remote trial argument: ${argument}`);
  }
  return { execute: argv.includes('--execute') };
}

export function assertRemoteMigrationHistory(migrations) {
  assert.ok(Array.isArray(migrations), 'remote migration list is missing');
  const local = migrations.map((migration) => migration.local).filter(Boolean);
  const remote = migrations.map((migration) => migration.remote).filter(Boolean);
  assert.deepEqual(local, REMOTE_TRIAL_MIGRATIONS, 'local migration history is unexpected');
  assert.deepEqual(remote, REMOTE_TRIAL_MIGRATIONS, 'remote migrations 001-026 are required');
}

export function safeRemoteTrialSummary({
  mode,
  plannedAliases,
  plannedPortions,
  serviceRoleProvided,
  summary = null,
  importRunId = null,
}) {
  return {
    mode,
    target_project_ref: REMOTE_TRIAL_PROJECT_REF,
    target_project_ref_matches: true,
    manifest: 20,
    final_package: 400,
    selected_foods: 20,
    final_package_sha256: REMOTE_TRIAL_PACKAGE_HASH,
    final_package_sha256_matches: true,
    planned_aliases: plannedAliases,
    planned_portions: plannedPortions,
    planned_review_status: 'pending',
    service_role_key: serviceRoleProvided ? 'provided' : 'not provided',
    database_writes: mode === 'dry-run' ? 0 : summary?.success ?? null,
    rpc_calls: mode === 'dry-run' ? 0 : summary?.success ?? null,
    import_runs_created: mode === 'dry-run' ? 0 : 1,
    ...(summary ? { import: summary } : {}),
    ...(importRunId ? { import_run: `${importRunId.slice(0, 8)}…` } : {}),
  };
}
