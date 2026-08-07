import { supabase } from '../lib/supabaseClient';
import { timelineService } from './timelineService';

jest.mock('../lib/supabaseClient', () => ({
  supabase: { from: jest.fn() },
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

  test('临时固定餐次复用已有数据库餐次并只新增food entry', async () => {
    const existingMealQuery = createQuery({ maybeSingle: { data: mealRow, error: null } });
    const foodInsertQuery = createQuery({ single: { data: entryRow, error: null } });
    supabase.from
      .mockReturnValueOnce(existingMealQuery)
      .mockReturnValueOnce(foodInsertQuery);

    const result = await timelineService.createFoodEntryForMeal({
      userId: 'user-1',
      dateStr: '2026-07-28',
      meal: { id: 'm1-local', subtype: 'breakfast', title: '早餐', time: '08:00' },
      food: { foodId: entryRow.source_food_id, name: '测试燕麦', grams: 50, cal: 190, p: 6.5, f: 3.5, c: 32 },
    });

    expect(result.error).toBeNull();
    expect(result.data.meal.id).toBe(mealRow.id);
    expect(result.data.foodEntry.entryId).toBe(entryRow.id);
    expect(foodInsertQuery.insert).toHaveBeenCalledWith([expect.objectContaining({
      timeline_item_id: mealRow.id,
      user_id: 'user-1',
      quantity: 50,
    })]);
  });

  test('食品写入失败时清理本次新建餐次，不留下孤立餐次', async () => {
    const noExistingMealQuery = createQuery({ maybeSingle: { data: null, error: null } });
    const mealInsertQuery = createQuery({ single: { data: mealRow, error: null } });
    const foodInsertQuery = createQuery({ single: { data: null, error: new Error('food insert failed') } });
    const cleanupQuery = createQuery({ awaited: { data: null, error: null } });
    supabase.from
      .mockReturnValueOnce(noExistingMealQuery)
      .mockReturnValueOnce(mealInsertQuery)
      .mockReturnValueOnce(foodInsertQuery)
      .mockReturnValueOnce(cleanupQuery);

    const result = await timelineService.createFoodEntryForMeal({
      userId: 'user-1',
      dateStr: '2026-07-28',
      meal: { id: 'm1-local', subtype: 'breakfast', title: '早餐', time: '08:00' },
      food: { foodId: entryRow.source_food_id, name: '测试燕麦', grams: 50, cal: 190, p: 6.5, f: 3.5, c: 32 },
    });

    expect(result.error.message).toBe('food insert failed');
    expect(cleanupQuery.delete).toHaveBeenCalledTimes(1);
    expect(cleanupQuery.eq).toHaveBeenCalledWith('id', mealRow.id);
    expect(cleanupQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
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
