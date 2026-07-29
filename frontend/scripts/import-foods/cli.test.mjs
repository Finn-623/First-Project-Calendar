import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseArgs, runCli } from './cli.mjs';

const usdaFixture = fileURLToPath(new URL('./fixtures/usda.sample.json', import.meta.url));

function captureOutput() {
  const logs = [];
  const errors = [];
  return {
    logs,
    errors,
    output: {
      log(value) {
        logs.push(value);
      },
      error(value) {
        errors.push(value);
      },
    },
  };
}

test('CLI parses source input dry-run and batch size', () => {
  assert.deepEqual(
    parseArgs([
      '--source',
      'AFCD',
      '--input',
      'foods.json',
      '--dry-run',
      '--batch-size',
      '25',
    ]),
    {
      source: 'AFCD',
      inputPath: 'foods.json',
      dryRun: true,
      batchSize: 25,
    }
  );
});

test('dry-run succeeds without Supabase environment variables', async () => {
  const captured = captureOutput();
  const exitCode = await runCli(
    ['--source', 'USDA', '--input', usdaFixture, '--dry-run'],
    {},
    captured.output
  );
  assert.equal(exitCode, 0);
  assert.ok(captured.logs.some((line) => line.includes('"success": 1')));
  assert.deepEqual(captured.errors, []);
});

test('write import fails fast when service environment is missing', async () => {
  const captured = captureOutput();
  const exitCode = await runCli(
    ['--source', 'USDA', '--input', usdaFixture],
    {},
    captured.output
  );
  assert.equal(exitCode, 1);
  assert.match(captured.errors[0], /SUPABASE_URL is required/);
  assert.doesNotMatch(captured.errors[0], /service_role.*[A-Za-z0-9_-]{20}/);
});

test('unknown arguments including implicit update mode return a nonzero exit', async () => {
  const captured = captureOutput();
  const exitCode = await runCli(
    [
      '--source',
      'USDA',
      '--input',
      usdaFixture,
      '--update-existing',
    ],
    {},
    captured.output
  );
  assert.equal(exitCode, 1);
  assert.match(captured.errors[0], /Unknown argument/);
});
