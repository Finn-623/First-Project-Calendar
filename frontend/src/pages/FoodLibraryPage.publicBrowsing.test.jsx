import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { FoodLibraryPage } from './FoodLibraryPage';
import { foodService } from '../services/foodService';

let mockCurrentSearch = '';
const mockSetSearchParams = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(mockCurrentSearch), mockSetSearchParams],
}), { virtual: true });

jest.mock('../services/foodService', () => ({
  foodService: {
    listVisiblePublicFoods: jest.fn(), loadVisiblePublicFoodFacets: jest.fn(),
    getVisiblePublicFoodDetail: jest.fn(), copyPublicFoodToPersonal: jest.fn(), createFood: jest.fn(), updateFood: jest.fn(), deleteFood: jest.fn(),
  },
}));
jest.mock('../store', () => ({ useStore: () => ({
  foods: [
    { id: 'mine-1', name: '我的燕麦', visibility: 'private', user_id: 'user-1', category: '我的', p100: 1, f100: 1, c100: 1, cal100: 10, is_active: true },
    { id: 'inactive-1', name: '已停用燕麦', visibility: 'private', user_id: 'user-1', category: '我的', is_active: false },
  ],
  publicFoods: [], user: { id: 'user-1' }, profile: { role: 'user' },
  refreshFoods: jest.fn().mockResolvedValue(), loadPublicFoods: jest.fn().mockResolvedValue(),
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

  test.each(['/library', '/library?tab=public'])('%s 默认挂载完整公共食品浏览器和可见筛选', async (path) => {
    mount(path);
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
    expect(screen.getByRole('tab', { name: '我的食品' }).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('我的燕麦')).toBeTruthy();
    expect(screen.getByText('个人')).toBeTruthy();
    expect(screen.getByText('仅自己可见，可修改')).toBeTruthy();
    expect(screen.queryByText('已停用燕麦')).toBeNull();
    expect(screen.queryByText('食品分类')).toBeNull();
  });
});
