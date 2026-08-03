import { timelineCacheService, TIMELINE_CACHE_SCHEMA_VERSION } from './timelineCacheService';

describe('timelineCacheService', () => {
  beforeEach(() => timelineCacheService.__resetMemoryForTests());

  test('按用户和日期隔离并恢复完整时间线快照', async () => {
    const timeline = [{ id: 'meal-1', type: 'meal', foods: [{ entryId: 'entry-1', name: '燕麦', cal: 100 }] }];
    await timelineCacheService.putSnapshot('user-a', '2026-08-03', timeline);

    const snapshot = await timelineCacheService.getActiveSnapshot('user-a');
    expect(snapshot).toEqual(expect.objectContaining({
      userId: 'user-a',
      recordDate: '2026-08-03',
      schemaVersion: TIMELINE_CACHE_SCHEMA_VERSION,
      timeline,
    }));
    expect(await timelineCacheService.getActiveSnapshot('user-b')).toBeNull();
  });

  test('损坏或不兼容版本缓存安全降级为空', async () => {
    await timelineCacheService.putSnapshot('user-a', '2026-08-03', []);
    const snapshot = await timelineCacheService.getSnapshot('user-a', '2026-08-03');
    snapshot.schemaVersion = 0;
    expect(snapshot.schemaVersion).not.toBe(TIMELINE_CACHE_SCHEMA_VERSION);
    expect(await timelineCacheService.getSnapshot('user-a', '2026-08-03')).toBeNull();
    expect(await timelineCacheService.getSnapshot('user-b', '2026-08-03')).toBeNull();
  });

  test('缓存保存待确认删除标记，刷新时不会恢复旧远程食品', async () => {
    await timelineCacheService.putSnapshot('user-a', '2026-08-03', [], {
      pendingDeleteEntryIds: new Set(['entry-deleting']),
    });
    expect(await timelineCacheService.getSnapshot('user-a', '2026-08-03')).toEqual(
      expect.objectContaining({ pendingDeleteEntryIds: ['entry-deleting'] })
    );
  });
});
