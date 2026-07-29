#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getAdapter } from './adapters.mjs';
import { runFoodImport } from './importer.mjs';
import { createSupabaseImportRepository } from './repository.mjs';

const HELP = `Usage:
  npm run import:foods -- --source AFCD|USDA --input <file.json> [--dry-run] [--batch-size 50]

Options:
  --source       Source adapter (AFCD or USDA)
  --input        JSON fixture or source file
  --dry-run      Parse, normalize, validate, and count without database writes
  --batch-size   Read/write batch size from 1 to 100 (default: 50)
`;

export function parseArgs(argv) {
  const options = { dryRun: false, batchSize: 50 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--source') {
      options.source = argv[++index];
    } else if (argument === '--input') {
      options.inputPath = argv[++index];
    } else if (argument === '--batch-size') {
      options.batchSize = Number(argv[++index]);
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!options.help && (!options.source || !options.inputPath)) {
    throw new Error('--source and --input are required');
  }
  return options;
}

export async function runCli(argv, env = process.env, output = console) {
  let options;
  try {
    options = parseArgs(argv);
    if (options.help) {
      output.log(HELP);
      return 0;
    }

    const adapter = getAdapter(options.source);
    const repository = options.dryRun
      ? null
      : createSupabaseImportRepository({
          supabaseUrl: env.SUPABASE_URL,
          serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
        });
    const { summary } = await runFoodImport({
      adapter,
      inputPath: resolve(options.inputPath),
      dryRun: options.dryRun,
      batchSize: options.batchSize,
      repository,
    });

    output.log(JSON.stringify(summary, null, 2));
    if (summary.failed > 0) {
      output.error(
        summary.status === 'partially_failed'
          ? 'Import completed with errors.'
          : 'Import failed.'
      );
      return 2;
    }
    output.log(options.dryRun ? 'Dry run completed.' : 'Import completed.');
    return 0;
  } catch (error) {
    output.error(`Food import error: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
