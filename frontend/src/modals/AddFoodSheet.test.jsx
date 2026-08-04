import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddFoodSheet } from './AddFoodSheet';

const mockRefreshFoods = jest.fn();
const mockEnsureMyFoodsLoaded = jest.fn();
let mockMyFoods;
const mockFoods = [
  { id: 'public-1', name: '燕麦', brand: '公共牌', visibility: 'public', is_active: true, cal100: 100, p100: 10, f100: 2, c100: 20, portions: [] },
  { id: 'mine-1', name: '燕麦', brand: '我的品牌', visibility: 'private', user_id: 'user-1', is_active: true, cal100: 200, p100: 20, f100: 4, c100: 40, portions: [{ id: 'portion-1', name: '1杯', amount: 250, unit: 'g', grams: 250, isDefault: true }] },
  { id: 'other-1', name: '不应出现', brand: '别人', visibility: 'private', user_id: 'user-2', is_active: true, portions: [] },
  { id: 'inactive-1', name: '停用食品', visibility: 'private', user_id: 'user-1', is_active: false, portions: [] },
];

jest.mock('../store', () => ({
  useStore: () => ({ foods: mockFoods, myFoods: mockMyFoods, myFoodsStatus: mockMyFoods ? 'success' : 'idle', user: { id: 'user-1' }, refreshFoods: mockRefreshFoods, ensureMyFoodsLoaded: mockEnsureMyFoodsLoaded }),
}));
jest.mock('../services/foodService', () => ({
  foodService: { listVisiblePublicFoods: jest.fn() },
}));
jest.mock('../components/ui/sheet', () => ({
  Sheet: ({ children }) => <div>{children}</div>,
  SheetContent: ({ children, overlayClassName, ...props }) => <div {...props}>{children}</div>,
  SheetHeader: ({ children }) => <div>{children}</div>,
  SheetTitle: ({ children }) => <h2>{children}</h2>,
  SheetDescription: ({ children }) => <p>{children}</p>,
}));
jest.mock('../components/ui/input', () => ({ Input: (props) => <input {...props} /> }));
jest.mock('../components/ui/button', () => ({ Button: ({ children, ...props }) => <button {...props}>{children}</button> }));
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));

describe('AddFoodSheet personal food priority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMyFoods = undefined;
    mockFoods[1].cal100 = 200;
    mockFoods[1].p100 = 20;
    mockFoods[1].f100 = 4;
    mockFoods[1].c100 = 40;
    mockFoods[1].portions = [{ id: 'portion-1', name: '1杯', amount: 250, unit: 'g', grams: 250, isDefault: true }];
    mockRefreshFoods.mockResolvedValue({ data: mockFoods, error: null });
    mockEnsureMyFoodsLoaded.mockResolvedValue({ data: mockFoods, error: null, cached: true });
    const { foodService } = require('../services/foodService');
    foodService.listVisiblePublicFoods.mockResolvedValue({ data: [], count: 0, error: null });
  });

  test('personal group appears before public group and hides other users/inactive foods', async () => {
    render(<AddFoodSheet open onOpenChange={jest.fn()} onConfirm={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('food-group-personal')).toBeTruthy());
    expect(mockRefreshFoods).not.toHaveBeenCalled();
    const groups = screen.getByTestId('add-food-sheet').querySelectorAll('[data-testid^="food-group-"]');
    expect(groups[0].getAttribute('data-testid')).toBe('food-group-personal');
    expect(groups[1].getAttribute('data-testid')).toBe('food-group-public');
    expect(document.body.textContent).toContain('品牌：我的品牌');
    expect(screen.queryByText('不应出现')).toBeNull();
    expect(screen.queryByText('停用食品')).toBeNull();
  });

  test('searches brand and selecting default personal portion submits converted grams', async () => {
    const onConfirm = jest.fn();
    render(<AddFoodSheet open onOpenChange={jest.fn()} onConfirm={onConfirm} />);
    await waitFor(() => expect(screen.getByTestId('food-group-personal')).toBeTruthy());
    fireEvent.change(screen.getByTestId('food-search-input'), { target: { value: '我的品牌' } });
    expect(screen.getByText('燕麦')).toBeTruthy();
    fireEvent.click(screen.getByTestId('food-select-mine-1'));
    expect(screen.getByText('1杯 · 250g · 默认')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ foodId: 'mine-1', grams: 250 })));
  });

  test('does not treat an unknown ml portion as grams', async () => {
    const onConfirm = jest.fn();
    mockFoods[1].portions = [{ id: 'portion-ml', name: '1杯', amount: 250, unit: 'ml', grams: null, isDefault: true }];
    render(<AddFoodSheet open onOpenChange={jest.fn()} onConfirm={onConfirm} />);
    await waitFor(() => expect(screen.getByTestId('food-group-personal')).toBeTruthy());
    fireEvent.click(screen.getByTestId('food-select-mine-1'));
    expect(screen.getByText('该食品未设置毫升与克的换算关系，请按克记录')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ foodId: 'mine-1', grams: 120 })));
  });

  test('keeps the query when returning and synchronizes portion quantity with grams', async () => {
    render(<AddFoodSheet open targetTitle="早餐" onOpenChange={jest.fn()} onConfirm={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('food-group-personal')).toBeTruthy());
    fireEvent.change(screen.getByTestId('food-search-input'), { target: { value: '我的品牌' } });
    fireEvent.click(screen.getByTestId('food-select-mine-1'));
    expect(screen.getByRole('button', { name: '增加数量' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '增加数量' }));
    expect(screen.getByRole('spinbutton').value).toBe('500');
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByTestId('food-search-input').value).toBe('我的品牌');
    expect(screen.queryByRole('button', { name: '加入早餐' })).toBeNull();
  });

  test('shows dynamic add action and keeps null nutrients as unavailable', async () => {
    mockFoods[1].cal100 = null;
    mockFoods[1].p100 = null;
    mockFoods[1].f100 = null;
    mockFoods[1].c100 = null;
    render(<AddFoodSheet open targetTitle="午餐" onOpenChange={jest.fn()} onConfirm={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('food-group-personal')).toBeTruthy());
    expect(screen.getByText('每100g · 暂无数据')).toBeTruthy();
    fireEvent.click(screen.getByTestId('food-select-mine-1'));
    expect(screen.getByText('加入午餐')).toBeTruthy();
    expect(screen.getByText('暂无数据')).toBeTruthy();
  });

  test('uses shared myFoods immediately and does not hide it while public loading fails', async () => {
    const { foodService } = require('../services/foodService');
    mockMyFoods = mockFoods.filter((food) => food.visibility !== 'public');
    foodService.listVisiblePublicFoods.mockRejectedValue(new Error('public unavailable'));
    render(<AddFoodSheet open onOpenChange={jest.fn()} onConfirm={jest.fn()} />);
    expect(screen.getByText('我的食品')).toBeTruthy();
    expect(screen.getByTestId('food-group-personal').textContent).toContain('燕麦');
    expect(mockEnsureMyFoodsLoaded).toHaveBeenCalledWith('user-1');
    await waitFor(() => expect(screen.getByTestId('food-group-personal')).toBeTruthy());
    expect(screen.queryByText('公共食品')).toBeNull();
  });
});
