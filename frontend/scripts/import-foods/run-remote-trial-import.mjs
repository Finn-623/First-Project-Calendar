#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afcdAdapter } from './adapters.mjs';
import { runFoodImport } from './importer.mjs';
import {
  assertLinkedRemoteTrialProject,
  assertRemoteMigrationHistory,
  assertRemoteTrialEnvironment,
  parseRemoteTrialArgs,
  safeRemoteTrialSummary,
  validateRemoteTrialAssets,
} from './remote-trial-guard.mjs';
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
  return output
    .split('\n')
    .map((line) =>
      line
        .split('|')
        .map((value) => value.trim().replaceAll('`', ''))
    )
    .filter(
      ([local, remote]) =>
        /^\d+$/.test(local || '') || /^\d+$/.test(remote || '')
    )
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

async function temporarySelection(selected) {
  const directory = await mkdtemp(resolve(tmpdir(), 'remote-food-trial-'));
  const path = resolve(directory, 'remote-trial-20.json');
  await writeFile(path, JSON.stringify(selected), { mode: 0o600 });
  return {
    path,
    remove: () => rm(directory, { recursive: true, force: true }),
  };
}

export async function runRemoteTrial({
  argv = [],
  env = process.env,
  repositoryFactory = createSupabaseImportRepository,
  migrationReader = readLinkedMigrationHistory,
  packageContent: packageOverride,
  manifest: manifestOverride,
  linkedProjectRefReader = () => readFile(linkedProjectRefPath, 'utf8'),
} = {}) {
  const { execute } = parseRemoteTrialArgs(argv);
  assertRemoteTrialEnvironment(env, { execute });
  assertLinkedRemoteTrialProject(await linkedProjectRefReader());

  const packageContent = packageOverride ?? await readFile(packagePath);
  const dataset = JSON.parse(packageContent);
  const manifest =
    manifestOverride ?? JSON.parse(await readFile(manifestPath, 'utf8'));
  const assets = validateRemoteTrialAssets({ packageContent, dataset, manifest });
  assert.equal(assets.plannedAliases, 7);
  assert.equal(assets.plannedPortions, 45);

  const temporary = await temporarySelection(assets.selected);
  try {
    if (!execute) {
      const result = await runFoodImport({
        adapter: afcdAdapter,
        inputPath: temporary.path,
        dryRun: true,
        batchSize: 20,
        repository: null,
      });
      assert.deepEqual(
        {
          total: result.summary.total,
          success: result.summary.success,
          skipped: result.summary.skipped,
          failed: result.summary.failed,
        },
        { total: 20, success: 20, skipped: 0, failed: 0 }
      );
      return safeRemoteTrialSummary({
        mode: 'dry-run',
        plannedAliases: assets.plannedAliases,
        plannedPortions: assets.plannedPortions,
        serviceRoleProvided: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      });
    }

    assertRemoteMigrationHistory(await migrationReader());
    const repository = repositoryFactory({
      supabaseUrl: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    });
    const result = await runFoodImport({
      adapter: afcdAdapter,
      inputPath: temporary.path,
      batchSize: 20,
      repository,
    });
    return safeRemoteTrialSummary({
      mode: 'execute',
      plannedAliases: assets.plannedAliases,
      plannedPortions: assets.plannedPortions,
      serviceRoleProvided: true,
      summary: result.summary,
      importRunId: result.importRunId,
    });
  } finally {
    await temporary.remove();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runRemoteTrial({ argv: process.argv.slice(2) });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Remote trial guard stopped: ${error.message}\n`);
    process.exitCode = 1;
  }
}
