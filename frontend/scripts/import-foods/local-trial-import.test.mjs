import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  assertLocalEnvironment,
  validateTrialManifest,
} from './run-local-trial-import.mjs';

const dataset = JSON.parse(await readFile(
  new URL('./dataset/public-foods-afcd-initial.json', import.meta.url),
  'utf8'
));
const manifest = JSON.parse(await readFile(
  new URL('./dataset/local-trial-import-manifest.json', import.meta.url),
  'utf8'
));
const source = await readFile(
  new URL('./run-local-trial-import.mjs', import.meta.url),
  'utf8'
);

test('trial manifest contains 20 stable representative final-package foods', () => {
  validateTrialManifest(manifest, dataset);
  assert.equal(manifest.length, 20);
  assert.equal(manifest.reduce((sum, item) => sum + item.expected_alias_count, 0), 7);
  assert.equal(manifest.reduce((sum, item) => sum + item.expected_portion_count, 0), 45);
});

test('local environment guard accepts only loopback API and database hosts', () => {
  assert.doesNotThrow(() => assertLocalEnvironment({
    API_URL: 'http://127.0.0.1:54321',
    DB_URL: 'postgresql://postgres@localhost:54322/postgres',
    ANON_KEY: 'runtime-only',
    SERVICE_ROLE_KEY: 'runtime-only',
  }));
  assert.throws(() => assertLocalEnvironment({
    API_URL: 'https://remote.example.com',
    DB_URL: 'postgresql://remote.example.com/postgres',
    ANON_KEY: 'runtime-only',
    SERVICE_ROLE_KEY: 'runtime-only',
  }), /must be local/);
});

test('trial runner reuses importer and repository and caps selection to manifest', () => {
  assert.match(source, /runFoodImport/);
  assert.match(source, /createSupabaseImportRepository/);
  assert.match(source, /manifest\.length, 20/);
  assert.match(source, /dataset\.filter\(\(food\) => selectedIds\.has/);
  assert.doesNotMatch(source, /supabase link|db push|--linked/);
});
