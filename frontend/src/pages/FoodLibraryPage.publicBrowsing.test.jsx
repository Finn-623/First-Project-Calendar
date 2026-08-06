import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FoodLibraryPage } from './FoodLibraryPage';
import { foodService } from '../services/foodService';

let mockCurrentSearch = '';
const mockSetSearchParams = jest.fn();
const mockRefreshFoods = jest.fn(() => Promise.resolve({ data: [], error: null }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(mockCurrentSearch), mockSetSearchParams],
}), { virtual: true });

jest.mock('../services/foodService', () => ({
  foodService: {
    listVisiblePublicFoods: jest.fn(), loadVisiblePublicFoodFacets: jest.fn(),
    getVisiblePublicFoodDetail: jest.fn(), copyPublicFoodToPersonal: jest.fn(), savePersonalFood: jest.fn(), createFood: jest.fn(), updateFood: jest.fn(), deleteFood: jest.fn(), deactivatePersonalFood: jest.fn(), reactivatePersonalFood: jest.fn(), deletePersonalFoodPermanently: jest.fn(),
  },
}));
jest.mock('../store', () => ({ useStore: () => ({
  foods: [
    { id: 'mine-1', name: '我的燕麦', visibility: 'private', user_id: 'user-1', category: 'vegetables', p100: 1, f100: 1, c100: 1, cal100: 10, is_active: true },
  ],
  myFoods: [{ id: 'mine-1', name: '我的燕麦', visibility: 'private', user_id: 'user-1', category: 'vegetables', p100: 1, f100: 1, c100: 1, cal100: 10, is_active: true }],
  inactiveMyFoods: [{ id: 'inactive-1', name: '已停用燕麦', visibility: 'private', user_id: 'user-1', category: '我的', is_active: false }],
  publicFoods: [], user: { id: 'user-1' }, profile: { role: 'user' },
  refreshFoods: mockRefreshFoods, loadPublicFoods: jest.fn().mockResolvedValue(),
  createPublicFood: jest.fn(), updatePublicFood: jest.fn(), setPublicFoodActive: jest.fn(),
}) }));
jest.mock('../components/ui/input', () => ({ Input: (props) => <input {...props} /> }));
jest.mock('../components/ui/button', () => ({ Button: ({ children, ...props }) => <button {...props}>{children}</button> }));
jest.mock('../components/ui/textarea', () => ({ Textarea: (props) => <textarea {...props} /> }));
jest.mock('../components/ui/switch', () => ({ Switch: () => <button type="button">switch</button> }));
jest.mock('../components/ui/dialog', () => ({
  Dialog: ({ open, children }) => open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }) => <div>{children}</div>, DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), warning: jest.fn() } }));
jest.mock('../lib/notifications', () => ({ showSuccess: jest.fn() }));

const food = {
  id: 'public-1', name: '西兰花', nameEn: 'Broccoli, raw', brand: '', sourceName: 'AFCD',
  primaryCategory: 'vegetables', secondaryCategory: '', intakeTypes: ['fiber'],
  nutrients: { energyKcal: 34.123, proteinG: 2.8, carbohydrateG: 6.6, fatG: 0.4, fiberG: 2.6, saturatedFatG: null, totalSugarG: 1.7, sodiumMg: 33, potassiumMg: 316 },
  aliases: [], portions: [],
};

const mount = (path) => {
  mockCurrentSearch = path.split('?')[1] || '';
  return render(<FoodLibraryPage />);
};

describe('FoodLibraryPage 公共食品真实路由接入', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    foodService.loadVisiblePublicFoodFacets.mockResolvedValue({ categories: ['vegetables'], intakeTypes: ['fiber'], error: null });
    foodService.listVisiblePublicFoods.mockResolvedValue({ data: [food], count: 1, error: null });
    foodService.getVisiblePublicFoodDetail.mockResolvedValue({ data: food, error: null });
  });

  test('复制公共食品后刷新个人食品并切换到第一页的我的食品', async () => {
    foodService.copyPublicFoodToPersonal.mockResolvedValue({ data: { food_id: 'mine-copy', created: true }, error: null });
    mount('/library?tab=public');

    fireEvent.click((await screen.findAllByRole('button', { name: '复制到我的食品' }))[0]);
    fireEvent.change(screen.getByDisplayValue('西兰花'), { target: { value: 'P0-20-页面复制食品' } });
    fireEvent.click(screen.getByRole('button', { name: '确认复制' }));

    await waitFor(() => expect(mockRefreshFoods).toHaveBeenCalledWith('user-1'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'mine' }, { replace: true });
  });

  test.each(['/library', '/library?tab=public'])('%s 默认挂载完整公共食品浏览器和可见筛选', async (path) => {
    mount(path);
    expect(screen.getByRole('heading', { level: 1 }).parentElement.parentElement.parentElement.parentElement.className).toContain('overflow-x-hidden');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('食物库');
    expect(screen.queryByText('食物数据库')).toBeNull();
    expect(screen.queryByText('公共食品 + 个人食品统一管理')).toBeNull();
    expect(screen.getByRole('tab', { name: '公共食品' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('食品分类')).toBeTruthy();
    expect(screen.getByText('主要摄入类型')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('热量')).toBeTruthy());
    expect(screen.getByText('34.1kcal')).toBeTruthy();
    expect(screen.getByText('查看详情 ›')).toBeTruthy();
    expect(screen.queryByText('公共食品审核')).toBeNull();
  });

  test('/library?tab=mine 保留个人食品页面', async () => {
    mount('/library?tab=mine');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('食物库');
    expect(screen.queryByText('个人食品库')).toBeNull();
    expect(screen.getByRole('tab', { name: '我的食品' }).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('我的燕麦')).toBeTruthy();
    expect(screen.getByText('个人')).toBeTruthy();
    expect(screen.getByText('仅自己可见，可修改')).toBeTruthy();
    expect(screen.queryByText('已停用燕麦')).toBeNull();
    expect(screen.queryByText('食品分类')).toBeNull();
  });

  test('active personal food uses explicit deactivate and permanent-delete actions', async () => {
    mount('/library?tab=mine');

    expect(screen.getByTestId('deactivate-food-mine-1').textContent).toContain('停用');
    expect(screen.getByTestId('permanent-delete-food-mine-1').textContent).toContain('永久删除');
    expect(screen.queryByTestId('delete-food-mine-1')).toBeNull();
    expect(screen.getByRole('tab', { name: '使用中' }).getAttribute('aria-selected')).toBe('true');
  });

  test('inactive tab shows inactive food with reactivation and permanent-delete actions', async () => {
    mount('/library?tab=mine');
    fireEvent.click(screen.getByRole('tab', { name: '已停用' }));

    expect(await screen.findByText('已停用燕麦')).toBeTruthy();
    expect(screen.getByTestId('reactivate-food-inactive-1').textContent).toContain('重新启用');
    expect(screen.getByTestId('permanent-delete-food-inactive-1').textContent).toContain('永久删除');
    expect(screen.getAllByText('已停用').length).toBeGreaterThanOrEqual(2);
  });

  test('个人食品表单显示品牌和可用分量编辑区域', () => {
    mount('/library?tab=mine');
    expect(screen.getByTestId('cat-全部')).toBeTruthy();
    expect(screen.getByTestId('cat-vegetables').textContent).toContain('蔬菜');
    fireEvent.click(screen.getByTestId('cat-vegetables'));
    fireEvent.click(screen.getByTestId('add-custom-food'));
    expect(screen.getByTestId('private-food-brand')).toBeTruthy();
    expect(screen.getByTestId('private-portions-editor')).toBeTruthy();
    expect(screen.getAllByLabelText('分量数量 1')).toHaveLength(1);
    expect(screen.queryByLabelText('分量数量 2')).toBeNull();
    expect(screen.getByLabelText('分量单位 1').value).toBe('');
    expect(screen.getByLabelText('食品分类').value).toBe('');
    expect(screen.getByRole('option', { name: '主食与谷物' })).toBeTruthy();
    expect(screen.getByText('碳水')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '添加分量' }));
    expect(screen.getByLabelText('分量数量 2')).toBeTruthy();
    expect(screen.getByLabelText('分量克数 2')).toBeTruthy();
    const unitOptions = Array.from(screen.getByLabelText('分量单位 2').options).map((option) => option.textContent);
    expect(unitOptions).toEqual(expect.arrayContaining(['个', '份', '瓶', '片', '杯', '勺', '袋', '盒', '碗', '条']));
    fireEvent.click(screen.getByRole('button', { name: '删除分量 2' }));
    expect(screen.queryByLabelText('分量数量 2')).toBeNull();
    expect(screen.getByLabelText('分量数量 1')).toBeTruthy();
  });

  test('公共食品详情标题使用具体食品名称', async () => {
    mount('/library?tab=public');

    fireEvent.click((await screen.findAllByRole('button', { name: '查看详情 ›' }))[0]);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByRole('dialog').querySelector('h2').textContent).toBe('西兰花');
    expect(screen.queryByText('公共食品详情')).toBeNull();
  });
});
