import assert from 'node:assert/strict';
import test from 'node:test';
import { createAutoArchiveHandler } from './handler.ts';

const VALID_SECRET = 'server-only-secret-value';
const FIXED_NOW = new Date('2026-07-27T02:00:00.000Z');

function createRepository(overrides = {}) {
  return {
    listEnabledSettings: async () => [],
    hasArchiveLog: async () => false,
    getExistingArchive: async () => null,
    getTimeline: async () => [],
    upsertArchive: async () => {},
    deleteTimeline: async () => 0,
    insertArchiveLog: async () => {},
    ...overrides,
  };
}

function createHarness(repository, options = {}) {
  let repositoryCreations = 0;
  const handler = createAutoArchiveHandler({
    getSecret: () => options.secret ?? VALID_SECRET,
    createRepository: () => {
      repositoryCreations += 1;
      return repository;
    },
    now: () => FIXED_NOW,
    logger: { info() {}, error() {} },
  });

  return {
    handler,
    getRepositoryCreations: () => repositoryCreations,
  };
}

function postRequest(secret) {
  const headers = secret === undefined
    ? {}
    : { authorization: `Bearer ${secret}` };
  return new Request('https://example.test/auto-archive-records', {
    method: 'POST',
    headers,
  });
}

test('无鉴权请求返回 401，且不创建数据库客户端', async () => {
  const harness = createHarness(createRepository());
  const response = await harness.handler(postRequest());

  assert.equal(response.status, 401);
  assert.equal(harness.getRepositoryCreations(), 0);
});

test('错误服务端密钥返回 403，且不创建数据库客户端', async () => {
  const harness = createHarness(createRepository());
  const response = await harness.handler(postRequest('wrong-secret'));

  assert.equal(response.status, 403);
  assert.equal(harness.getRepositoryCreations(), 0);
});

test('服务端未配置密钥时返回 503，且不创建数据库客户端', async () => {
  const harness = createHarness(createRepository(), { secret: '' });
  const response = await harness.handler(postRequest(VALID_SECRET));

  assert.equal(response.status, 503);
  assert.equal(harness.getRepositoryCreations(), 0);
});

test('正确服务端密钥可以执行归档调度', async () => {
  let listed = false;
  const harness = createHarness(createRepository({
    listEnabledSettings: async () => {
      listed = true;
      return [];
    },
  }));
  const response = await harness.handler(postRequest(VALID_SECRET));

  assert.equal(response.status, 200);
  assert.equal(listed, true);
  assert.deepEqual(await response.json(), { processed: 0, skipped: 0, failed: 0 });
});

test('未到用户归档时间时不写归档也不删除数据', async () => {
  let archiveWrites = 0;
  let deletes = 0;
  const repository = createRepository({
    listEnabledSettings: async () => [{
      user_id: 'user-1',
      auto_archive_enabled: true,
      auto_archive_time: '23:59:00',
      timezone: 'Australia/Sydney',
    }],
    upsertArchive: async () => { archiveWrites += 1; },
    deleteTimeline: async () => { deletes += 1; return 1; },
  });
  const response = await createHarness(repository).handler(postRequest(VALID_SECRET));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processed: 0, skipped: 1, failed: 0 });
  assert.equal(archiveWrites, 0);
  assert.equal(deletes, 0);
});

test('满足条件时只归档并删除目标用户的前一日本日记录', async () => {
  const calls = [];
  const repository = createRepository({
    listEnabledSettings: async () => [{
      user_id: 'user-1',
      auto_archive_enabled: true,
      auto_archive_time: '00:00:00',
      timezone: 'Australia/Sydney',
    }],
    getTimeline: async (userId, archiveDate) => {
      calls.push(['getTimeline', userId, archiveDate]);
      return [{
        id: 'timeline-1',
        item_type: 'breakfast',
        title: '早餐',
        event_time: '08:00:00',
        food_entries: [{
          id: 'entry-1',
          food_name_snapshot: '燕麦',
          quantity: 50,
          calories_snapshot: 190,
          protein_snapshot: 6,
          fat_snapshot: 3,
          carbs_snapshot: 32,
        }],
      }];
    },
    upsertArchive: async (payload) => {
      calls.push(['upsertArchive', payload.user_id, payload.archive_date]);
    },
    deleteTimeline: async (userId, archiveDate) => {
      calls.push(['deleteTimeline', userId, archiveDate]);
      return 1;
    },
    insertArchiveLog: async (payload) => {
      calls.push(['insertArchiveLog', payload.user_id, payload.archive_date]);
    },
  });
  const response = await createHarness(repository).handler(postRequest(VALID_SECRET));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processed: 1, skipped: 0, failed: 0 });
  assert.deepEqual(calls, [
    ['getTimeline', 'user-1', '2026-07-26'],
    ['upsertArchive', 'user-1', '2026-07-26'],
    ['deleteTimeline', 'user-1', '2026-07-26'],
    ['insertArchiveLog', 'user-1', '2026-07-26'],
  ]);
});

test('归档写入失败时绝不执行删除', async () => {
  let deletes = 0;
  const repository = createRepository({
    listEnabledSettings: async () => [{
      user_id: 'user-1',
      auto_archive_enabled: true,
      auto_archive_time: '00:00:00',
      timezone: 'Australia/Sydney',
    }],
    getTimeline: async () => [{ id: 'timeline-1', item_type: 'other', food_entries: [] }],
    upsertArchive: async () => {
      throw new Error('archive write failed');
    },
    deleteTimeline: async () => {
      deletes += 1;
      return 1;
    },
  });
  const response = await createHarness(repository).handler(postRequest(VALID_SECRET));

  assert.equal(response.status, 207);
  assert.deepEqual(await response.json(), { processed: 0, skipped: 0, failed: 1 });
  assert.equal(deletes, 0);
});

test('删除语句失败时保留已写归档且不写成功日志', async () => {
  let archiveWrites = 0;
  let logWrites = 0;
  const repository = createRepository({
    listEnabledSettings: async () => [{
      user_id: 'user-1',
      auto_archive_enabled: true,
      auto_archive_time: '00:00:00',
      timezone: 'Australia/Sydney',
    }],
    getTimeline: async () => [{ id: 'timeline-1', item_type: 'other', food_entries: [] }],
    upsertArchive: async () => { archiveWrites += 1; },
    deleteTimeline: async () => {
      throw new Error('delete failed');
    },
    insertArchiveLog: async () => { logWrites += 1; },
  });
  const response = await createHarness(repository).handler(postRequest(VALID_SECRET));

  assert.equal(response.status, 207);
  assert.equal(archiveWrites, 1);
  assert.equal(logWrites, 0);
});
