import { filterPendingDeletedFoodEntries, mergeRemoteTimelineWithLocalPending } from './timelinePendingMerge';

describe('mergeRemoteTimelineWithLocalPending', () => {
  const localMeal = {
    id: 'temp-breakfast',
    type: 'meal',
    subtype: 'breakfast',
    foods: [{ entryId: 'pending-op-1', clientMutationId: 'op-1', name: '燕麦', sync_status: 'pending' }],
  };

  test('空远程重载不会清除本地 pending 食品', () => {
    expect(mergeRemoteTimelineWithLocalPending([], [localMeal])).toEqual([
      expect.objectContaining({ foods: [expect.objectContaining({ entryId: 'pending-op-1' })] }),
    ]);
  });

  test('按固定餐次合并并避免相同 mutation 重复', () => {
    const remote = [{
      id: 'real-breakfast',
      type: 'meal',
      subtype: 'breakfast',
      foods: [{ entryId: 'real-entry', clientMutationId: 'op-1', name: '燕麦' }],
    }];
    const merged = mergeRemoteTimelineWithLocalPending(remote, [localMeal]);
    expect(merged).toHaveLength(1);
    expect(merged[0].foods).toHaveLength(1);
    expect(merged[0].foods[0].entryId).toBe('real-entry');
  });

  test('同步失败记录也在远程刷新中保留以供重试', () => {
    const failed = [{ ...localMeal, foods: [{ ...localMeal.foods[0], sync_status: 'failed' }] }];
    expect(mergeRemoteTimelineWithLocalPending([], failed)[0].foods[0].sync_status).toBe('failed');
  });

  test('旧远程结果不会恢复pending delete食品', () => {
    const remote = [{
      id: 'meal-1', type: 'meal', subtype: 'breakfast',
      foods: [{ entryId: 'deleted-entry', name: '已删除食品' }, { entryId: 'kept-entry', name: '保留食品' }],
    }];
    expect(filterPendingDeletedFoodEntries(remote, new Set(['deleted-entry']))[0].foods).toEqual([
      expect.objectContaining({ entryId: 'kept-entry' }),
    ]);
  });
});
