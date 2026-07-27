import assert from 'node:assert/strict';
import test from 'node:test';
import { createAutoArchiveHandler } from './handler.ts';

const VALID_SECRET = 'server-only-secret-value';
const FIXED_NOW = new Date('2026-07-27T02:00:00.000Z');

function createRepository(overrides = {}) {
  return {
    listEnabledSettings: async () => [],
    archiveUser: async () => ({ result_status: 'archived', deleted_count: 0 }),
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

test('未到用户归档时间时不调用事务 RPC', async () => {
  let rpcCalls = 0;
  const repository = createRepository({
    listEnabledSettings: async () => [{
      user_id: 'user-1',
      auto_archive_enabled: true,
      auto_archive_time: '23:59:00',
      timezone: 'Australia/Sydney',
    }],
    archiveUser: async () => {
      rpcCalls += 1;
      return { result_status: 'archived', deleted_count: 1 };
    },
  });
  const response = await createHarness(repository).handler(postRequest(VALID_SECRET));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processed: 0, skipped: 1, failed: 0 });
  assert.equal(rpcCalls, 0);
});

test('满足条件时只把目标用户和前一日交给事务 RPC', async () => {
  const calls = [];
  const repository = createRepository({
    listEnabledSettings: async () => [{
      user_id: 'user-1',
      auto_archive_enabled: true,
      auto_archive_time: '00:00:00',
      timezone: 'Australia/Sydney',
    }],
    archiveUser: async (userId, archiveDate) => {
      calls.push([userId, archiveDate]);
      return { result_status: 'archived', deleted_count: 1 };
    },
  });
  const response = await createHarness(repository).handler(postRequest(VALID_SECRET));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processed: 1, skipped: 0, failed: 0 });
  assert.deepEqual(calls, [['user-1', '2026-07-26']]);
});

test('RPC 判定重复执行时计为跳过，不重复归档', async () => {
  const repository = createRepository({
    listEnabledSettings: async () => [{
      user_id: 'user-1',
      auto_archive_enabled: true,
      auto_archive_time: '00:00:00',
      timezone: 'Australia/Sydney',
    }],
    archiveUser: async () => ({
      result_status: 'already_processed',
      deleted_count: 0,
    }),
  });
  const response = await createHarness(repository).handler(postRequest(VALID_SECRET));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processed: 0, skipped: 1, failed: 0 });
});

test('事务 RPC 异常时返回部分失败，不在函数层执行补偿删除', async () => {
  let rpcCalls = 0;
  const repository = createRepository({
    listEnabledSettings: async () => [{
      user_id: 'user-1',
      auto_archive_enabled: true,
      auto_archive_time: '00:00:00',
      timezone: 'Australia/Sydney',
    }],
    archiveUser: async () => {
      rpcCalls += 1;
      throw new Error('transaction rolled back');
    },
  });
  const response = await createHarness(repository).handler(postRequest(VALID_SECRET));

  assert.equal(response.status, 207);
  assert.deepEqual(await response.json(), { processed: 0, skipped: 0, failed: 1 });
  assert.equal(rpcCalls, 1);
});
