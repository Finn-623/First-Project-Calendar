import { supabase } from '../lib/supabaseClient';
import { timelineService } from './timelineService';

jest.mock('../lib/supabaseClient', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

const createQuery = ({ awaited, maybeSingle, single } = {}) => {
  const query = {
    select: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    eq: jest.fn(() => query),
    in: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    maybeSingle: jest.fn().mockResolvedValue(maybeSingle),
    single: jest.fn().mockResolvedValue(single),
    then: (resolve, reject) => Promise.resolve(awaited).then(resolve, reject),
  };
  return query;
};

const mealRow = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'user-1',
  event_date: '2026-07-28',
  event_time: '08:00:00',
  item_type: 'breakfast',
  title: '早餐',
  details: {},
};

const entryRow = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  user_id: 'user-1',
  timeline_item_id: mealRow.id,
  source_food_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  food_name_snapshot: '测试燕麦',
  quantity: '50.00',
  unit_snapshot: 'g',
  calories_snapshot: '190.00',
  protein_snapshot: '6.50',
  fat_snapshot: '3.50',
  carbs_snapshot: '32.00',
};

describe('timelineService 食品记录持久化与恢复', () => {
  beforeEach(() => jest.clearAllMocks());

  test('刷新、导航返回或重新登录时从food_entries恢复餐次食品与真实ID', async () => {
    const timelineQuery = createQuery({ awaited: { data: [mealRow], error: null } });
    const foodQuery = createQuery({ awaited: { data: [entryRow], error: null } });
    supabase.from
      .mockReturnValueOnce(timelineQuery)
      .mockReturnValueOnce(foodQuery);

    const result = await timelineService.getTimelineByDate('user-1', '2026-07-28');

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].foods).toEqual([expect.objectContaining({
      entryId: entryRow.id,
      foodId: entryRow.source_food_id,
      name: '测试燕麦',
      grams: 50,
      cal: 190,
    })]);
    expect(foodQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(foodQuery.in).toHaveBeenCalledWith('timeline_item_id', [mealRow.id]);
  });

  test('使用事务RPC新增food entry并提交日期、餐次、数量与分量快照', async () => {
    supabase.rpc.mockResolvedValue({
      data: { meal: mealRow, food_entry: { ...entryRow, portion_snapshot: { name: '碗', quantity: 1 } } },
      error: null,
    });

    const result = await timelineService.createFoodEntryForMeal({
      userId: 'user-1',
      dateStr: '2026-07-28',
      meal: { id: 'm1-local', subtype: 'breakfast', title: '早餐', time: '08:00' },
      food: { foodId: entryRow.source_food_id, name: '测试燕麦', grams: 50, unit: 'g', portion: { name: '碗', quantity: 1 }, cal: 190, p: 6.5, f: 3.5, c: 32 },
      operationId: 'op-create-1',
    });

    expect(result.error).toBeNull();
    expect(result.data.meal.id).toBe(mealRow.id);
    expect(result.data.foodEntry.entryId).toBe(entryRow.id);
    expect(supabase.rpc).toHaveBeenCalledWith('create_food_entry_for_meal', expect.objectContaining({
      record_date: '2026-07-28',
      meal: expect.objectContaining({ subtype: 'breakfast', time: '08:00' }),
      food: expect.objectContaining({ quantity: 50, unit: 'g', portion: { name: '碗', quantity: 1 } }),
      mutation_id: 'op-create-1',
    }));
  });

  test('事务RPC失败时返回Supabase真实错误且不执行客户端半完成写入或清理', async () => {
    const databaseError = Object.assign(new Error('food insert failed'), { code: '23503', details: 'source food missing' });
    supabase.rpc.mockResolvedValue({ data: null, error: databaseError });

    const result = await timelineService.createFoodEntryForMeal({
      userId: 'user-1',
      dateStr: '2026-07-28',
      meal: { id: 'm1-local', subtype: 'breakfast', title: '早餐', time: '08:00' },
      food: { foodId: entryRow.source_food_id, name: '测试燕麦', grams: 50, cal: 190, p: 6.5, f: 3.5, c: 32 },
      operationId: 'op-failed-1',
    });

    expect(result.error.message).toBe('food insert failed');
    expect(result.error.code).toBe('23503');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('相同mutation id重试由RPC幂等返回同一记录', async () => {
    supabase.rpc.mockResolvedValue({ data: { meal: mealRow, food_entry: entryRow }, error: null });
    const input = {
      userId: 'user-1', dateStr: '2026-07-28',
      meal: { id: 'm1-local', subtype: 'breakfast', title: '早餐', time: '08:00' },
      food: { foodId: entryRow.source_food_id, name: '测试燕麦', grams: 50, cal: 190, p: 6.5, f: 3.5, c: 32 },
      operationId: 'op-retry-1',
    };

    const first = await timelineService.createFoodEntryForMeal(input);
    const retry = await timelineService.createFoodEntryForMeal(input);

    expect(first.data.foodEntry.entryId).toBe(entryRow.id);
    expect(retry.data.foodEntry.entryId).toBe(entryRow.id);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.rpc.mock.calls[0][1].mutation_id).toBe(supabase.rpc.mock.calls[1][1].mutation_id);
  });

  test.each([
    [{ dateStr: '28/07/2026' }, '记录日期格式无效'],
    [{ food: { name: '测试燕麦', grams: 0 } }, '请输入有效的食品克重'],
    [{ meal: { subtype: 'invalid', title: '无效餐次' } }, '目标餐次类型无效'],
  ])('无效字段在调用Supabase前失败：%s', async (override, expectedMessage) => {
    const result = await timelineService.createFoodEntryForMeal({
      userId: 'user-1',
      dateStr: '2026-07-28',
      meal: { id: 'm1-local', subtype: 'breakfast', title: '早餐', time: '08:00' },
      food: { name: '测试燕麦', grams: 50 },
      operationId: 'op-validation',
      ...override,
    });

    expect(result.error.message).toBe(expectedMessage);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('自定义空餐次清理严格先删除food entry再删除meal', async () => {
    const calls = [];
    const foodSpy = jest.spyOn(timelineService, 'deleteFoodEntry').mockImplementation(async () => {
      calls.push('food');
      return { error: null };
    });
    const mealSpy = jest.spyOn(timelineService, 'deleteTimelineItemByUser').mockImplementation(async () => {
      calls.push('meal');
      return { error: null };
    });

    const result = await timelineService.deleteFoodEntryThenCustomMeal('entry-1', 'meal-1', 'user-1');

    expect(result).toEqual({ foodDeleted: true, mealDeleted: true, error: null });
    expect(calls).toEqual(['food', 'meal']);
    foodSpy.mockRestore();
    mealSpy.mockRestore();
  });

  test('food entry删除失败时绝不继续删除meal', async () => {
    const foodSpy = jest.spyOn(timelineService, 'deleteFoodEntry').mockResolvedValue({ error: new Error('food delete failed') });
    const mealSpy = jest.spyOn(timelineService, 'deleteTimelineItemByUser').mockResolvedValue({ error: null });

    const result = await timelineService.deleteFoodEntryThenCustomMeal('entry-1', 'meal-1', 'user-1');

    expect(result.foodDeleted).toBe(false);
    expect(mealSpy).not.toHaveBeenCalled();
    foodSpy.mockRestore();
    mealSpy.mockRestore();
  });

  test('普通事件结束复用status和ended_at并保留用户归属条件', async () => {
    const updateQuery = createQuery({ maybeSingle: {
      data: {
        ...mealRow,
        item_type: 'other',
        title: '项目会议',
        status: 'completed',
        ended_at: '2026-07-28T12:00:01.000Z',
      },
      error: null,
    } });
    supabase.from.mockReturnValueOnce(updateQuery);

    const result = await timelineService.updateTimelineItemByUser(
      '11111111-1111-4111-8111-111111111111',
      'user-1',
      { status: 'completed', ended_at: '2026-07-28T12:00:01.000Z' },
    );

    expect(result.error).toBeNull();
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      ended_at: '2026-07-28T12:00:01.000Z',
    }));
    expect(updateQuery.eq).toHaveBeenCalledWith('id', '11111111-1111-4111-8111-111111111111');
    expect(updateQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
