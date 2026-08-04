import { supabase } from '../lib/supabaseClient';
import { foodService } from './foodService';

jest.mock('../lib/supabaseClient', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const query = (result) => {
  const value = {
    select: jest.fn(() => value), eq: jest.fn(() => value), ilike: jest.fn(() => value),
    limit: jest.fn(() => value), order: jest.fn(() => value), range: jest.fn(() => value),
    contains: jest.fn(() => value), or: jest.fn(() => value), maybeSingle: jest.fn().mockResolvedValue(result),
    not: jest.fn(() => value),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return value;
};

const row = {
  id: 'food-1', name: '西兰花', name_en: 'Broccoli', brand: null, source_name: 'AFCD',
  external_food_id: 'F001905', primary_category: '蔬菜', secondary_category: null,
  preparation_state: 'raw', intake_types: ['fiber'], energy_kcal: 34, protein_g: 2.8,
  carbohydrate_g: 6.6, fat_g: 0.4, fiber_g: null, saturated_fat_g: null,
  total_sugar_g: 1.7, sodium_mg: 33, potassium_mg: 316,
};

describe('foodService 普通用户公共食品查询', () => {
  beforeEach(() => jest.clearAllMocks());

  test('列表在数据库端限定approved active public并执行分页和组合筛选', async () => {
    const foods = query({ data: [row], count: 1, error: null });
    supabase.from.mockReturnValue(foods);
    const result = await foodService.listVisiblePublicFoods({ category: '蔬菜', intakeType: 'fiber', page: 1 });
    expect(supabase.from).toHaveBeenCalledWith('foods');
    expect(foods.eq).toHaveBeenCalledWith('visibility', 'public');
    expect(foods.eq).toHaveBeenCalledWith('review_status', 'approved');
    expect(foods.eq).toHaveBeenCalledWith('is_active', true);
    expect(foods.not).toHaveBeenCalledWith('source_name', 'is', null);
    expect(foods.eq).toHaveBeenCalledWith('primary_category', '蔬菜');
    expect(foods.contains).toHaveBeenCalledWith('intake_types', ['fiber']);
    expect(foods.range).toHaveBeenCalledWith(10, 19);
    expect(result.data[0].nutrients.fiberG).toBeNull();
  });

  test('复制公共食品只调用受控RPC并保留用户指定名称', async () => {
    supabase.rpc.mockResolvedValue({ data: { food_id: 'mine-1', created: true }, error: null });
    const result = await foodService.copyPublicFoodToPersonal('food-1', ' 我的西兰花 ');
    expect(supabase.rpc).toHaveBeenCalledWith('copy_public_food_to_personal', {
      p_source_food_id: 'food-1',
      p_name: '我的西兰花',
    });
    expect(result.data.food_id).toBe('mine-1');
  });

  test('136条结果的第14页使用130到139的服务端range并允许少于10条', async () => {
    const finalRows = Array.from({ length: 6 }, (_, index) => ({ ...row, id: `food-${index}` }));
    const foods = query({ data: finalRows, count: 136, error: null });
    supabase.from.mockReturnValue(foods);
    const result = await foodService.listVisiblePublicFoods({ page: 13 });
    expect(foods.range).toHaveBeenCalledWith(130, 139);
    expect(result.count).toBe(136);
    expect(result.data).toHaveLength(6);
  });

  test('alias命中去重后与名称、英文名和品牌一起交给主查询过滤', async () => {
    const aliases = query({ data: [{ food_id: 'food-1' }, { food_id: 'food-1' }], error: null });
    const foods = query({ data: [row], count: 1, error: null });
    supabase.from.mockReturnValueOnce(aliases).mockReturnValueOnce(foods);
    await foodService.listVisiblePublicFoods({ query: '  西兰花  ' });
    expect(aliases.ilike).toHaveBeenCalledWith('alias', '%西兰花%');
    expect(foods.or).toHaveBeenCalledWith(expect.stringContaining('id.in.(food-1)'));
    expect(foods.or.mock.calls[0][0].match(/food-1/g)).toHaveLength(1);
  });

  test('详情继续限定可见状态并按需读取alias和portion，隐藏食品安全返回不可用', async () => {
    const hidden = query({ data: null, error: null });
    supabase.from.mockReturnValue(hidden);
    const result = await foodService.getVisiblePublicFoodDetail('hidden-id');
    expect(hidden.eq).toHaveBeenCalledWith('review_status', 'approved');
    expect(hidden.eq).toHaveBeenCalledWith('is_active', true);
    expect(hidden.not).toHaveBeenCalledWith('source_name', 'is', null);
    expect(result.data).toBeNull();
    expect(result.error.message).toBe('食品不可用');
  });
});
