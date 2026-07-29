import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { afcdAdapter, usdaAdapter } from './adapters.mjs';
import { runFoodImport } from './importer.mjs';
import { createImportFood, importKey } from './model.mjs';

const afcdFixture = fileURLToPath(new URL('./fixtures/afcd.sample.json', import.meta.url));
const usdaFixture = fileURLToPath(new URL('./fixtures/usda.sample.json', import.meta.url));

function createMemoryRepository(shared = {}) {
  const state = {
    foods: shared.foods || new Map(),
    portions: shared.portions || new Map(),
    aliases: shared.aliases || new Map(),
    runs: [],
    errors: [],
    calls: [],
    failIds: shared.failIds || new Set(),
  };
  return {
    state,
    async startRun(input) {
      state.calls.push('startRun');
      const id = `run-${state.runs.length + 1}`;
      state.runs.push({ id, ...input });
      return id;
    },
    async findExistingKeys(source, ids) {
      state.calls.push('findExistingKeys');
      return new Set(
        [...state.foods.keys()].filter((key) => {
          const [keySource, externalId] = key.split('\u0000');
          return keySource === source && ids.includes(externalId);
        })
      );
    },
    async importFoodAtomic(_runId, food) {
      state.calls.push(`import:${food.external_food_id}`);
      const key = importKey(food);
      if (state.foods.has(key)) return { status: 'skipped', food_id: key };
      if (state.failIds.has(food.external_food_id)) {
        const error = new Error('simulated accessory transaction failure');
        error.code = 'ATOMIC_WRITE_FAILED';
        throw error;
      }
      state.foods.set(key, food);
      state.portions.set(key, food.portions);
      state.aliases.set(key, food.aliases);
      return { status: 'success', food_id: key };
    },
    async recordErrors(errors) {
      state.calls.push('recordErrors');
      state.errors.push(...errors);
    },
    async finishRun(id, summary) {
      state.calls.push('finishRun');
      state.runs.find((run) => run.id === id).summary = summary;
    },
  };
}

function simpleAdapter(rows, sourceName = 'AFCD') {
  return {
    sourceName,
    async readRows() {
      return rows;
    },
    adapt(row) {
      return createImportFood({ source_name: sourceName, ...row });
    },
  };
}

const validRow = {
  external_food_id: 'valid-one',
  name_zh: '同名测试食品',
  category_primary: '其他',
  intake_types: ['protein'],
  energy_kcal: 100,
  protein_g: 10,
  carbohydrate_g: 5,
  fat_g: 2,
  fiber_g: 1,
};

test('dry-run validates and counts without any repository writes', async () => {
  const repository = new Proxy(
    {},
    {
      get() {
        throw new Error('dry-run accessed repository');
      },
    }
  );
  const result = await runFoodImport({
    adapter: usdaAdapter,
    inputPath: usdaFixture,
    dryRun: true,
    repository,
  });
  assert.deepEqual(result.summary, {
    source: 'USDA',
    input: 'usda.sample.json',
    dryRun: true,
    total: 1,
    success: 1,
    skipped: 0,
    failed: 0,
    status: 'completed',
  });
});

test('one invalid row does not block another valid food', async () => {
  const repository = createMemoryRepository();
  const adapter = simpleAdapter([
    validRow,
    { ...validRow, external_food_id: 'bad', fat_g: -1 },
  ]);
  const { summary } = await runFoodImport({
    adapter,
    inputPath: '/tmp/artificial.json',
    repository,
    batchSize: 2,
  });
  assert.equal(summary.success, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.status, 'partially_failed');
  assert.equal(repository.state.foods.size, 1);
  assert.equal(repository.state.errors.length, 1);
});

test('success failed and skipped counts include input duplicates', async () => {
  const repository = createMemoryRepository();
  const { summary } = await runFoodImport({
    adapter: afcdAdapter,
    inputPath: afcdFixture,
    repository,
    batchSize: 2,
  });
  assert.equal(summary.total, 6);
  assert.equal(summary.success, 2);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.failed, 3);
  assert.equal(summary.status, 'partially_failed');
});

test('repeating the same fixture is idempotent', async () => {
  const shared = { foods: new Map(), portions: new Map(), aliases: new Map() };
  const first = createMemoryRepository(shared);
  const firstResult = await runFoodImport({
    adapter: usdaAdapter,
    inputPath: usdaFixture,
    repository: first,
  });
  const second = createMemoryRepository(shared);
  const secondResult = await runFoodImport({
    adapter: usdaAdapter,
    inputPath: usdaFixture,
    repository: second,
  });
  assert.equal(firstResult.summary.success, 1);
  assert.equal(secondResult.summary.success, 0);
  assert.equal(secondResult.summary.skipped, 1);
  assert.equal(shared.foods.size, 1);
});

test('same name from AFCD and USDA is never merged', async () => {
  const shared = { foods: new Map(), portions: new Map(), aliases: new Map() };
  await runFoodImport({
    adapter: simpleAdapter([validRow], 'AFCD'),
    inputPath: '/tmp/afcd.json',
    repository: createMemoryRepository(shared),
  });
  await runFoodImport({
    adapter: simpleAdapter([{ ...validRow, external_food_id: 'valid-one' }], 'USDA'),
    inputPath: '/tmp/usda.json',
    repository: createMemoryRepository(shared),
  });
  assert.equal(shared.foods.size, 2);
});

test('atomic write failure leaves no orphan portions or aliases', async () => {
  const shared = {
    foods: new Map(),
    portions: new Map(),
    aliases: new Map(),
    failIds: new Set(['atomic-fail']),
  };
  const repository = createMemoryRepository(shared);
  const adapter = simpleAdapter([
    {
      ...validRow,
      external_food_id: 'atomic-fail',
      portions: [{ name: '1份', grams: 20 }],
      aliases: ['原子测试'],
    },
  ]);
  const { summary } = await runFoodImport({
    adapter,
    inputPath: '/tmp/atomic.json',
    repository,
  });
  assert.equal(summary.failed, 1);
  assert.equal(shared.foods.size, 0);
  assert.equal(shared.portions.size, 0);
  assert.equal(shared.aliases.size, 0);
});

test('existing source identity is skipped before atomic writes', async () => {
  const shared = { foods: new Map(), portions: new Map(), aliases: new Map() };
  shared.foods.set('AFCD\u0000valid-one', validRow);
  const repository = createMemoryRepository(shared);
  const { summary } = await runFoodImport({
    adapter: simpleAdapter([validRow], 'AFCD'),
    inputPath: '/tmp/existing.json',
    repository,
  });
  assert.equal(summary.skipped, 1);
  assert.equal(
    repository.state.calls.filter((call) => call.startsWith('import:')).length,
    0
  );
});
