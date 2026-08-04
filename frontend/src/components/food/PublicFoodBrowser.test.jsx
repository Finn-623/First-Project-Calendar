import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { foodService } from '../../services/foodService';
import { PublicFoodBrowser } from './PublicFoodBrowser';

jest.mock('../../services/foodService', () => ({
  foodService: {
    listVisiblePublicFoods: jest.fn(),
    loadVisiblePublicFoodFacets: jest.fn(),
    getVisiblePublicFoodDetail: jest.fn(),
    copyPublicFoodToPersonal: jest.fn(),
  },
}));
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));
jest.mock('../../lib/notifications', () => ({ showSuccess: jest.fn() }));

jest.mock('../ui/dialog', () => ({
  Dialog: ({ open, children }) => open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

jest.mock('../ui/input', () => ({
  Input: (props) => <input {...props} />,
}));

jest.mock('../ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

const broccoli = {
  id: 'food-1', name: '西兰花', nameEn: 'Broccoli, raw', brand: '', sourceName: 'AFCD',
  primaryCategory: 'vegetables', secondaryCategory: '', intakeTypes: ['fiber'],
  nutrients: { energyKcal: 34, proteinG: 2.8, carbohydrateG: 6.6, fatG: 0.4, fiberG: 2.6, saturatedFatG: null, totalSugarG: 1.7, sodiumMg: 33, potassiumMg: 316 },
  aliases: [], portions: [],
};
const milk = {
  id: 'food-2', name: '低脂牛奶（约1%）', nameEn: 'Milk, cow, fluid, reduced fat', brand: '', sourceName: 'AFCD',
  primaryCategory: 'dairy', secondaryCategory: '', intakeTypes: ['protein'],
  nutrients: { energyKcal: 43, proteinG: 3.3, carbohydrateG: 4.8, fatG: 1, fiberG: null, saturatedFatG: 0.6, totalSugarG: 4.8, sodiumMg: 44, potassiumMg: 150 },
  aliases: ['低脂奶'], portions: [{ id: 'portion-1', name: '1杯', grams: 250, isDefault: true }],
};

describe('PublicFoodBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    foodService.loadVisiblePublicFoodFacets.mockResolvedValue({ categories: ['dairy', 'vegetables'], intakeTypes: ['fiber', 'protein'], error: null });
    foodService.listVisiblePublicFoods.mockResolvedValue({ data: [broccoli, milk], count: 136, error: null });
    foodService.getVisiblePublicFoodDetail.mockResolvedValue({ data: milk, error: null });
    foodService.copyPublicFoodToPersonal.mockResolvedValue({ data: { food_id: 'mine-copy', created: true }, error: null });
  });

  test('显示只读公共食品列表、结果数和分页，不暴露编辑或审核入口', async () => {
    foodService.listVisiblePublicFoods.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, index) => ({ ...(index % 2 ? milk : broccoli), id: `food-${index + 1}` })),
      count: 136,
      error: null,
    });
    render(<PublicFoodBrowser />);
    await waitFor(() => expect(screen.getAllByText('西兰花')).toHaveLength(5));
    expect(screen.getByTestId('public-food-count').textContent).toContain('136');
    expect(screen.getAllByText('Broccoli, raw')).toHaveLength(5);
    expect(screen.getAllByLabelText('公共食品，只读')).toHaveLength(10);
    expect(screen.queryByText('编辑')).toBeNull();
    expect(screen.queryByText('审核')).toBeNull();
    expect(screen.getByTestId('public-food-list').querySelectorAll('article')).toHaveLength(10);
    expect(screen.getByText('1 / 14')).toBeTruthy();
    expect(screen.getByTestId('public-food-list').className).toContain('grid-cols-1');
    expect(screen.getByTestId('public-food-list').className).not.toMatch(/(?:sm|md|lg|xl):grid-cols-[2-9]/);
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(foodService.listVisiblePublicFoods).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 10 })));
  });

  test('搜索会去除空格并防抖，中文英文品牌或alias均交给服务端统一搜索', async () => {
    jest.useFakeTimers();
    render(<PublicFoodBrowser />);
    await act(async () => Promise.resolve());
    fireEvent.change(screen.getByTestId('public-food-search'), { target: { value: '  低脂奶  ' } });
    expect(foodService.listVisiblePublicFoods).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(300); await Promise.resolve(); });
    expect(foodService.listVisiblePublicFoods).toHaveBeenLastCalledWith(expect.objectContaining({ query: '低脂奶', page: 0 }));
    jest.useRealTimers();
  });

  test('分类和摄入类型可以组合，清除后恢复全部条件', async () => {
    render(<PublicFoodBrowser />);
    await waitFor(() => expect(screen.getByRole('button', { name: '蔬菜' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '蔬菜' }));
    fireEvent.click(screen.getByRole('button', { name: '膳食纤维' }));
    await waitFor(() => expect(foodService.listVisiblePublicFoods).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'vegetables', intakeType: 'fiber', page: 0 })));
    fireEvent.click(screen.getByRole('button', { name: /清除筛选/ }));
    await waitFor(() => expect(foodService.listVisiblePublicFoods).toHaveBeenLastCalledWith(expect.objectContaining({ category: '', intakeType: '' })));
  });

  test('翻页保留当前分类和摄入类型筛选', async () => {
    render(<PublicFoodBrowser />);
    await waitFor(() => expect(screen.getByRole('button', { name: '蔬菜' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '蔬菜' }));
    fireEvent.click(screen.getByRole('button', { name: '膳食纤维' }));
    await waitFor(() => expect(foodService.listVisiblePublicFoods).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, category: 'vegetables', intakeType: 'fiber' })));
    fireEvent.click(await screen.findByRole('button', { name: '下一页' }));
    await waitFor(() => expect(foodService.listVisiblePublicFoods).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, category: 'vegetables', intakeType: 'fiber', pageSize: 10 })));
  });

  test('搜索、分类、摄入类型和清除筛选都会回到第一页', async () => {
    render(<PublicFoodBrowser />);
    fireEvent.click(await screen.findByRole('button', { name: '下一页' }));
    await waitFor(() => expect(foodService.listVisiblePublicFoods).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));

    fireEvent.change(screen.getByTestId('public-food-search'), { target: { value: ' milk ' } });
    await waitFor(() => expect(foodService.listVisiblePublicFoods).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, query: 'milk' })));

    fireEvent.click(await screen.findByRole('button', { name: '下一页' }));
    fireEvent.click(screen.getByRole('button', { name: '蔬菜' }));
    await waitFor(() => expect(foodService.listVisiblePublicFoods).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, category: 'vegetables' })));

    fireEvent.click(await screen.findByRole('button', { name: '下一页' }));
    fireEvent.click(screen.getByRole('button', { name: '膳食纤维' }));
    await waitFor(() => expect(foodService.listVisiblePublicFoods).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, intakeType: 'fiber' })));

    fireEvent.click(await screen.findByRole('button', { name: '下一页' }));
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    await waitFor(() => expect(foodService.listVisiblePublicFoods).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, query: '', category: '', intakeType: '' })));
  });

  test('请求失败显示重试，空结果显示明确空状态', async () => {
    foodService.listVisiblePublicFoods.mockResolvedValueOnce({ data: [], count: 0, error: new Error('network') });
    render(<PublicFoodBrowser />);
    await waitFor(() => expect(screen.getByText('公共食品加载失败')).toBeTruthy());
    foodService.listVisiblePublicFoods.mockResolvedValueOnce({ data: [], count: 0, error: null });
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(screen.getByText('没有找到符合条件的公共食品')).toBeTruthy());
  });

  test('详情按需读取公开alias和portion，缺失营养不伪装为0', async () => {
    render(<PublicFoodBrowser />);
    await waitFor(() => expect(screen.getByTestId('public-food-food-2')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('button', { name: '查看详情 ›' })[1]);
    await waitFor(() => expect(screen.getByTestId('public-food-detail')).toBeTruthy());
    expect(foodService.getVisiblePublicFoodDetail).toHaveBeenCalledWith('food-2');
    expect(screen.getByText('1杯 · 250g')).toBeTruthy();
    expect(screen.getByText('低脂奶')).toBeTruthy();
    expect(screen.getAllByText('暂无数据').length).toBeGreaterThan(0);
    expect(screen.queryByText('保存')).toBeNull();
  });

  test('不可见食品详情返回安全的食品不可用', async () => {
    foodService.getVisiblePublicFoodDetail.mockResolvedValue({ data: null, error: new Error('not visible') });
    render(<PublicFoodBrowser />);
    await waitFor(() => expect(screen.getByTestId('public-food-food-1')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('button', { name: '查看详情 ›' })[0]);
    await waitFor(() => expect(screen.getByText('食品不可用')).toBeTruthy());
  });

  test('公共食品只读但可改名后原子复制，提交期间防止重复', async () => {
    let resolveCopy;
    foodService.copyPublicFoodToPersonal.mockReturnValue(new Promise((resolve) => { resolveCopy = resolve; }));
    const onCopied = jest.fn();
    render(<PublicFoodBrowser onCopied={onCopied} />);
    fireEvent.click((await screen.findAllByRole('button', { name: '复制到我的食品' }))[0]);
    expect(screen.getByRole('dialog')).toBeTruthy();
    const nameInput = screen.getByDisplayValue('西兰花');
    fireEvent.change(nameInput, { target: { value: '我的西兰花' } });
    const confirm = screen.getByRole('button', { name: '确认复制' });
    fireEvent.click(confirm);
    expect(screen.getByRole('button', { name: '复制中…' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '复制中…' }));
    expect(foodService.copyPublicFoodToPersonal).toHaveBeenCalledTimes(1);
    expect(foodService.copyPublicFoodToPersonal).toHaveBeenCalledWith('food-1', '我的西兰花');
    resolveCopy({ data: { food_id: 'mine-copy', created: true }, error: null });
    await waitFor(() => expect(onCopied).toHaveBeenCalledTimes(1));
  });
});
