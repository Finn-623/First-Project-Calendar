#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afcdAdapter } from './adapters.mjs';
import { runFoodImport } from './importer.mjs';
import {
  assertLinkedRemoteBatchProject,
  assertRemoteBatchEnvironment,
  assertRemoteBatchMigrationHistory,
  parseRemoteBatchArgs,
  safeRemoteBatchSummary,
  validateRemoteBatchAssets,
} from './remote-batch-guard.mjs';
import { createSupabaseImportRepository } from './repository.mjs';

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

export function parseLinkedMigrationHistory(output) {
  const trimmed = output.trim();
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    assert.ok(Array.isArray(parsed.migrations), 'Supabase migration JSON is missing migrations');
    return parsed.migrations.map(({ local, remote }) => ({ local, remote }));
  }
  return output
    .split('\n')
    .map((line) => line.split('|').map((value) => value.trim().replaceAll('`', '')))
    .filter(([local, remote]) => /^\d+$/.test(local || '') || /^\d+$/.test(remote || ''))
    .map(([local, remote]) => ({
      local: /^\d+$/.test(local || '') ? local : null,
      remote: /^\d+$/.test(remote || '') ? remote : null,
    }));
}

export function readLinkedMigrationHistory() {
  const output = execFileSync(
    'npx',
    ['--no-install', 'supabase', 'migration', 'list', '--linked'],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return parseLinkedMigrationHistory(output);
}

export async function runRemoteBatch({
  argv = [],
  env = process.env,
  repositoryFactory = createSupabaseImportRepository,
  migrationReader = readLinkedMigrationHistory,
  packageContent: packageOverride,
  trialManifest: manifestOverride,
  linkedProjectRefReader = () => readFile(linkedProjectRefPath, 'utf8'),
} = {}) {
  const { execute } = parseRemoteBatchArgs(argv);
  assertRemoteBatchEnvironment(env, { execute });
  assertLinkedRemoteBatchProject(await linkedProjectRefReader());

  const packageContent = packageOverride ?? await readFile(packagePath);
  const dataset = JSON.parse(packageContent);
  const trialManifest =
    manifestOverride ?? JSON.parse(await readFile(manifestPath, 'utf8'));
  const assets = validateRemoteBatchAssets({ packageContent, dataset, trialManifest });
  assert.equal(assets.plannedAliases, 100);
  assert.equal(assets.plannedPortions, 501);

  if (!execute) {
    const result = await runFoodImport({
      adapter: afcdAdapter,
      inputPath: packagePath,
      dryRun: true,
      batchSize: 50,
      repository: null,
    });
    assert.deepEqual(
      {
        total: result.summary.total,
        success: result.summary.success,
        skipped: result.summary.skipped,
        failed: result.summary.failed,
      },
      { total: 400, success: 400, skipped: 0, failed: 0 }
    );
    return safeRemoteBatchSummary({
      mode: 'dry-run',
      serviceRoleProvided: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      plannedAliases: assets.plannedAliases,
      plannedPortions: assets.plannedPortions,
    });
  }

  assertRemoteBatchMigrationHistory(await migrationReader());
  const repository = repositoryFactory({
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const result = await runFoodImport({
    adapter: afcdAdapter,
    inputPath: packagePath,
    batchSize: 50,
    repository,
  });
  return safeRemoteBatchSummary({
    mode: 'execute',
    serviceRoleProvided: true,
    plannedAliases: assets.plannedAliases,
    plannedPortions: assets.plannedPortions,
    summary: result.summary,
    importRunId: result.importRunId,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runRemoteBatch({ argv: process.argv.slice(2) });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Remote batch guard stopped: ${error.message}\n`);
    process.exitCode = 1;
  }
}
