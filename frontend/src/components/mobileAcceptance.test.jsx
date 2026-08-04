import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { BottomNav } from './BottomNav';
import { TimelineItem } from './TimelineItem';
import { AddFoodSheet } from '../modals/AddFoodSheet';
import { LoginPage } from '../pages/LoginPage';

jest.mock('@/lib/utils', () => ({
  cn: (...values) => values.filter(Boolean).join(' '),
}), { virtual: true });

jest.mock('@/components/ui/button', () => ({
  buttonVariants: () => '',
}), { virtual: true });

const LONG_FOOD_NAME = '超长食物名称用于验证三百二十像素窄屏换行时删除按钮仍然完整可点击';
const mockGoHome = jest.fn();
const mockNavigate = jest.fn();
const mockRefreshFoods = jest.fn();
const mockFoods = [{
  id: 'food-mobile',
  user_id: 'user-mobile',
  visibility: 'private',
  name: LONG_FOOD_NAME,
  cal100: 120,
  p100: 10,
  f100: 4,
  c100: 12,
}];

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => mockNavigate,
  NavLink: ({ to, end: _end, className, children, ...props }) => {
    const isActive = to === '/';
    return (
      <a href={to} className={className({ isActive })} {...props}>
        {typeof children === 'function' ? children({ isActive }) : children}
      </a>
    );
  },
}), { virtual: true });

jest.mock('../store', () => ({
  useStore: () => ({
    foods: mockFoods,
    user: { id: 'user-mobile' },
    refreshFoods: mockRefreshFoods,
    goHome: mockGoHome,
  }),
}));

jest.mock('../services/authService', () => ({
  authService: {
    signInWithUsername: jest.fn(),
  },
}));

const VIEWPORTS = [
  [320, 568],
  [375, 667],
  [390, 844],
  [430, 932],
];

const setViewport = (width, height) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
};

describe.each(VIEWPORTS)('手机端关键结构 %d × %d', (width, height) => {
  beforeEach(() => {
    jest.clearAllMocks();
    setViewport(width, height);
    mockRefreshFoods.mockResolvedValue({ data: mockFoods, error: null });
  });

  test('底部导航只保留三个可点击入口，页面预留底部空间', () => {
    render(
      <main className="pb-32" data-testid="mobile-page-content">
        <button type="button">页面最后一个操作</button>
        <BottomNav />
      </main>
    );

    expect(screen.getByTestId('mobile-page-content').className).toContain('pb-32');
    expect(screen.getByTestId('bottom-nav')).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByTestId('nav-home')).toBeTruthy();
    expect(screen.getByTestId('nav-library')).toBeTruthy();
    expect(screen.getByTestId('nav-settings')).toBeTruthy();
    expect(screen.queryByText('历史')).toBeNull();
    expect(screen.getByRole('button', { name: '页面最后一个操作' }).disabled).toBe(false);
  });

  test('超长食物名称换行后删除入口仍存在且可操作', () => {
    const onDeleteFood = jest.fn();
    render(
      <TimelineItem
        item={{
          id: 'meal-mobile',
          type: 'meal',
          title: '早餐',
          time: '08:00',
          foods: [{
            entryId: 'entry-mobile',
            foodId: 'food-mobile',
            name: LONG_FOOD_NAME,
            grams: 100,
            cal: 120,
            p: 10,
            f: 4,
            c: 12,
          }],
        }}
        onDeleteFood={onDeleteFood}
      />
    );

    expect(screen.getByText(LONG_FOOD_NAME).className).toContain('break-words');
    const deleteButton = screen.getByRole('button', { name: `删除早餐中的${LONG_FOOD_NAME}` });
    expect(deleteButton.className).toContain('h-10');
    expect(deleteButton.disabled).toBe(false);
    fireEvent.click(deleteButton);
    expect(onDeleteFood).toHaveBeenCalledTimes(1);
  });

  test('添加食物 Sheet 可滚动并保留克重、返回和确认操作', async () => {
    const onConfirm = jest.fn();
    render(
      <AddFoodSheet
        open
        onOpenChange={jest.fn()}
        targetTitle="早餐"
        onConfirm={onConfirm}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(LONG_FOOD_NAME)).toBeTruthy();
    });
    expect(screen.getByLabelText('个人食品')).toBeTruthy();
    fireEvent.click(screen.getByText(LONG_FOOD_NAME));

    const sheet = screen.getByTestId('add-food-sheet');
    expect(sheet.className).toContain('max-h-[calc(100dvh-16px)]');
    expect(screen.getByText(LONG_FOOD_NAME).className).toContain('break-words');
    expect(screen.getByRole('spinbutton')).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: '确认添加' }).disabled).toBe(false);
  });

  test('确认弹窗完整提供取消和确认操作并受动态视口高度约束', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent data-testid="mobile-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个食物记录？</AlertDialogTitle>
            <AlertDialogDescription>确认后将删除当前食物。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    const dialog = screen.getByTestId('mobile-confirm-dialog');
    expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]');
    expect(dialog.className).toContain('overflow-y-auto');
    expect(screen.getByRole('button', { name: '取消' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: '确认删除' }).disabled).toBe(false);
  });

  test('普通登录页关键控件完整且不存在账号切换文案', () => {
    render(<LoginPage onLoginSuccess={jest.fn()} />);

    expect(screen.getByTestId('login-username-input')).toBeTruthy();
    expect(screen.getByTestId('login-password-input')).toBeTruthy();
    expect(screen.getByTestId('login-submit-btn').disabled).toBe(false);
    expect(screen.queryByText('切换账号')).toBeNull();
    expect(screen.queryByText(/正在切换账号|请登录其他账号/)).toBeNull();
  });
});
