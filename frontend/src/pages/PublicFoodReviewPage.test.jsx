import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PublicFoodReviewPage } from './PublicFoodReviewPage';
import { foodService } from '../services/foodService';
import { useStore } from '../store';

jest.mock('../store', () => ({ useStore: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock('../services/foodService', () => ({
  foodService: {
    loadPublicFoodReviewQueue: jest.fn(),
    reviewPublicFoods: jest.fn(),
  },
}));
jest.mock('../components/settings/SettingsSubpageHeader', () => ({
  SettingsSubpageHeader: ({ title, description }) => (
    <header><h1>{title}</h1><p>{description}</p></header>
  ),
}));
jest.mock('../components/ui/button', () => ({
  Button: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
}));
jest.mock('../components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}));
jest.mock('../components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }) => (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));
jest.mock('../components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
  AlertDialogAction: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
}));
jest.mock('../components/ui/dialog', () => ({
  Dialog: ({ open, children }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

const food = {
  id: 'food-1',
  name: '西兰花（生）',
  name_en: 'Broccoli, fresh, raw',
  primary_category: 'vegetables',
  secondary_category: null,
  source_name: 'AFCD',
  external_food_id: 'F001905',
  review_status: 'pending',
  energy_kcal: 28,
  protein_g: 3.5,
  carbohydrate_g: 2,
  fat_g: 0.4,
  fiber_g: 3,
  total_sugar_g: null,
  sodium_mg: 9,
  food_public_aliases: [{ count: 1 }],
  food_portions: [{ count: 2 }],
};

function renderPage(profile = { role: 'admin', is_admin: true }) {
  useStore.mockReturnValue({ profile });
  return render(<PublicFoodReviewPage />);
}

beforeEach(() => {
  jest.clearAllMocks();
  foodService.loadPublicFoodReviewQueue.mockResolvedValue({
    data: [food],
    count: 1,
    error: null,
  });
  foodService.reviewPublicFoods.mockResolvedValue({
    data: {
      success: 1,
      failed: 0,
      skipped: 0,
      success_items: [{ food_id: food.id }],
    },
    error: null,
  });
});

test('administrator sees a paged pending review card with missing nutrients as unavailable', async () => {
  renderPage();
  expect(screen.getByText('公共食品审核')).toBeTruthy();
  expect(await screen.findByText('西兰花（生）')).toBeTruthy();
  expect(screen.getByText(/糖 暂无数据/)).toBeTruthy();
  expect(screen.getByText(/别名 1 · 份量 2/)).toBeTruthy();
  expect(foodService.loadPublicFoodReviewQueue).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'pending', page: 0, pageSize: 20 })
  );
});

test('non-admin cannot render the review page and returns to food library', async () => {
  renderPage({ role: 'user', is_admin: false });
  expect(screen.queryByText('公共食品审核')).toBeNull();
  expect(foodService.loadPublicFoodReviewQueue).not.toHaveBeenCalled();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/library', { replace: true }));
});

test('single approval requires confirmation and removes only the affected card', async () => {
  renderPage();
  await screen.findByText('西兰花（生）');
  fireEvent.click(screen.getByRole('button', { name: '批准' }));
  expect(screen.getByText('确认审核操作')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '确认' }));
  await waitFor(() => expect(foodService.reviewPublicFoods).toHaveBeenCalledWith(
    [food.id],
    'approved',
    '管理员审核页面操作'
  ));
  await waitFor(() => expect(screen.queryByText('西兰花（生）')).toBeNull());
});

test('submitting disables confirmation and duplicate submission is prevented', async () => {
  let resolveReview;
  foodService.reviewPublicFoods.mockReturnValue(new Promise((resolve) => {
    resolveReview = resolve;
  }));
  renderPage();
  await screen.findByText('西兰花（生）');
  fireEvent.click(screen.getByRole('button', { name: '批准' }));
  const confirm = screen.getByRole('button', { name: '确认' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(foodService.reviewPublicFoods).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveReview({ data: { success: 1, success_items: [{ food_id: food.id }] }, error: null });
  });
});

test('review failure keeps the pending card visible', async () => {
  foodService.reviewPublicFoods.mockResolvedValue({
    data: null,
    error: new Error('审核失败'),
  });
  renderPage();
  await screen.findByText('西兰花（生）');
  fireEvent.click(screen.getByRole('button', { name: '批准' }));
  fireEvent.click(screen.getByRole('button', { name: '确认' }));
  await waitFor(() => expect(foodService.reviewPublicFoods).toHaveBeenCalled());
  expect(screen.getByText('西兰花（生）')).toBeTruthy();
});

test.each([
  [320, 568],
  [375, 667],
  [390, 844],
  [430, 932],
])('review controls remain rendered at %ix%i', async (width, height) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  const { container, unmount } = renderPage();
  await screen.findByText('西兰花（生）');
  expect(container.querySelector('main').className).toContain('overflow-x-hidden');
  expect(screen.getByRole('button', { name: '批准' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '停用' })).toBeTruthy();
  unmount();
});
