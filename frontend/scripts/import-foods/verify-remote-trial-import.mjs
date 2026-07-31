#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  assertLinkedRemoteTrialProject,
  assertRemoteTrialEnvironment,
  REMOTE_TRIAL_PACKAGE_HASH,
  validateRemoteTrialAssets,
} from './remote-trial-guard.mjs';

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

export async function verifyRemoteTrial({
  env = process.env,
  clientFactory = createClient,
  packageContent: packageOverride,
  manifest: manifestOverride,
  linkedProjectRefReader = () => readFile(linkedProjectRefPath, 'utf8'),
} = {}) {
  assertRemoteTrialEnvironment(env, { execute: true });
  assertLinkedRemoteTrialProject(await linkedProjectRefReader());
  const importRunId = env.REMOTE_TRIAL_IMPORT_RUN_ID;
  assert.match(
    importRunId || '',
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'REMOTE_TRIAL_IMPORT_RUN_ID must be the exact trial run UUID'
  );

  const packageContent = packageOverride ?? await readFile(packagePath);
  const dataset = JSON.parse(packageContent);
  const manifest =
    manifestOverride ?? JSON.parse(await readFile(manifestPath, 'utf8'));
  const assets = validateRemoteTrialAssets({ packageContent, dataset, manifest });
  const db = clientFactory(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const run = await db.from('food_import_runs')
    .select('id,total_count,success_count,failed_count,skipped_count,status')
    .eq('id', importRunId).eq('source_name', 'AFCD').single();
  assert.ifError(run.error);
  const foods = await db.from('foods')
    .select('id,external_food_id,review_status,source_name')
    .eq('source_name', assets.scope.sourceName)
    .in('external_food_id', assets.scope.externalFoodIds);
  assert.ifError(foods.error);
  const foodIds = foods.data.map((food) => food.id);
  const aliases = foodIds.length
    ? await db.from('food_public_aliases').select('id,food_id').in('food_id', foodIds)
    : { data: [], error: null };
  const portions = foodIds.length
    ? await db.from('food_portions').select('id,food_id').in('food_id', foodIds)
    : { data: [], error: null };
  assert.ifError(aliases.error);
  assert.ifError(portions.error);

  const knownFoodIds = new Set(foodIds);
  const duplicateFoods =
    foods.data.length - new Set(foods.data.map((food) => food.external_food_id)).size;
  return {
    import_run: `${run.data.id.slice(0, 8)}…`,
    total: run.data.total_count,
    success: run.data.success_count,
    failed: run.data.failed_count,
    skipped: run.data.skipped_count,
    status: run.data.status,
    foods: foods.data.length,
    aliases: aliases.data.length,
    portions: portions.data.length,
    pending: foods.data.filter((food) => food.review_status === 'pending').length,
    approved: foods.data.filter((food) => food.review_status === 'approved').length,
    unique_source_identities:
      new Set(foods.data.map((food) => `${food.source_name}\0${food.external_food_id}`))
        .size,
    duplicate_foods: duplicateFoods,
    orphan_aliases: aliases.data.filter((row) => !knownFoodIds.has(row.food_id)).length,
    orphan_portions: portions.data.filter((row) => !knownFoodIds.has(row.food_id)).length,
    final_package_sha256: REMOTE_TRIAL_PACKAGE_HASH,
    final_package_sha256_matches: true,
    verification_scope: {
      source_name: assets.scope.sourceName,
      external_food_ids: assets.scope.externalFoodIds.length,
      import_run: `${run.data.id.slice(0, 8)}…`,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyRemoteTrial();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Remote trial verification stopped: ${error.message}\n`);
    process.exitCode = 1;
  }
}
