import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddFoodSheet } from './AddFoodSheet';

const mockRefreshFoods = jest.fn();
const mockFoods = [
  { id: 'public-1', name: '燕麦', brand: '公共牌', visibility: 'public', is_active: true, cal100: 100, p100: 10, f100: 2, c100: 20, portions: [] },
  { id: 'mine-1', name: '燕麦', brand: '我的品牌', visibility: 'private', user_id: 'user-1', is_active: true, cal100: 200, p100: 20, f100: 4, c100: 40, portions: [{ id: 'portion-1', name: '1杯', grams: 250, isDefault: true }] },
  { id: 'other-1', name: '不应出现', brand: '别人', visibility: 'private', user_id: 'user-2', is_active: true, portions: [] },
  { id: 'inactive-1', name: '停用食品', visibility: 'private', user_id: 'user-1', is_active: false, portions: [] },
];

jest.mock('../store', () => ({
  useStore: () => ({ foods: mockFoods, user: { id: 'user-1' }, refreshFoods: mockRefreshFoods }),
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

describe('AddFoodSheet personal food priority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshFoods.mockResolvedValue({ data: mockFoods, error: null });
  });

  test('personal group appears before public group and hides other users/inactive foods', async () => {
    render(<AddFoodSheet open onOpenChange={jest.fn()} onConfirm={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('food-group-personal')).toBeTruthy());
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
});
