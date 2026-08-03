import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { timelineService } from '../services/timelineService';
import { TodayPage } from './TodayPage';

jest.mock('../store', () => ({
  useStore: jest.fn(),
}));

jest.mock('../services/timelineService', () => ({
  timelineService: {
    createTimelineItem: jest.fn(),
    updateTimelineItem: jest.fn(),
    completeRunningTimelineItem: jest.fn(),
    deleteTimelineItemByUser: jest.fn(),
    deleteFoodEntry: jest.fn(),
    deleteFoodEntryThenCustomMeal: jest.fn(),
    getTimelineByDate: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../hooks/useCurrentTime', () => ({
  useCurrentTime: () => new Date('2026-07-28T12:00:00+10:00'),
}));

jest.mock('../components/LiveClock', () => ({
  LiveClock: () => <div data-testid="live-clock" />,
}));

jest.mock('../components/NutritionSummary', () => ({
  NutritionSummary: ({ totals }) => (
    <div data-testid="nutrition-summary">
      <span data-testid="total-cal">{totals?.cal ?? 0}</span>
      <span data-testid="total-p">{totals?.p ?? 0}</span>
      <span data-testid="total-f">{totals?.f ?? 0}</span>
      <span data-testid="total-c">{totals?.c ?? 0}</span>
    </div>
  ),
}));

jest.mock('../modals/AddFoodSheet', () => ({ AddFoodSheet: () => null }));
jest.mock('../modals/AddSnackSheet', () => ({ AddSnackSheet: () => null }));
jest.mock('../modals/AddTrainingSheet', () => ({ AddTrainingSheet: () => null }));
jest.mock('../modals/AddEventSheet', () => ({ AddEventSheet: () => null }));
jest.mock('../modals/EditTimeSheet', () => ({ EditTimeSheet: () => null }));
jest.mock('../modals/EditActivitySheet', () => ({ EditActivitySheet: () => null }));

jest.mock('../components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }) => (open ? <div role="dialog">{children}</div> : null),
  AlertDialogContent: ({ children }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
  AlertDialogAction: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
}));

const baseDate = new Date('2026-07-28T09:00:00+10:00');

const breakfastId = '11111111-1111-4111-8111-111111111111';
const lunchId = '22222222-2222-4222-8222-222222222222';
const dinnerId = '33333333-3333-4333-8333-333333333333';
const snackId = '44444444-4444-4444-8444-444444444444';
const breakfastFoodA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const breakfastFoodB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const lunchFood = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const dinnerFood = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const snackFood = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const makeTimeline = () => ([
  {
    id: breakfastId,
    type: 'meal',
    subtype: 'breakfast',
    title: '早餐',
    time: '08:00',
    foods: [
      { entryId: breakfastFoodA, foodId: 'food-a', name: '鸡蛋', grams: 100, cal: 120, p: 10, f: 8, c: 1 },
      { entryId: breakfastFoodB, foodId: 'food-b', name: '燕麦', grams: 50, cal: 180, p: 6, f: 4, c: 30 },
    ],
  },
  {
    id: lunchId,
    type: 'meal',
    subtype: 'lunch',
    title: '午餐',
    time: '12:00',
    foods: [
      { entryId: lunchFood, foodId: 'food-c', name: '鸡胸肉', grams: 120, cal: 200, p: 30, f: 5, c: 0 },
    ],
  },
]);

let storeState;
let rerenderPage = null;
let lastTimelineUpdate = null;

const setTimelineMock = jest.fn((updater) => {
  const nextTimeline = typeof updater === 'function' ? updater(storeState.timeline) : updater;
  lastTimelineUpdate = nextTimeline;
  storeState.timeline = nextTimeline;
});

const setSelectedDateMock = jest.fn();
const goHomeMock = jest.fn();
const endDayMock = jest.fn(() => Promise.resolve({ success: true }));
const loadHistoryMock = jest.fn(() => Promise.resolve({ success: true }));
const markFoodEntryPendingDeleteMock = jest.fn();
const clearFoodEntryPendingDeleteMock = jest.fn();

function mountPage(timeline = makeTimeline()) {
  storeState = {
    timeline,
    setTimeline: setTimelineMock,
    plan: null,
    dateLabel: '7月28日',
    endDay: endDayMock,
    dayInitialized: true,
    currentDate: baseDate,
    recordingDateStr: '2026-07-28',
    setSelectedDate: setSelectedDateMock,
    goHome: goHomeMock,
    user: { id: 'user-1' },
    loadHistory: loadHistoryMock,
    markFoodEntryPendingDelete: markFoodEntryPendingDeleteMock,
    clearFoodEntryPendingDelete: clearFoodEntryPendingDeleteMock,
  };

  useStore.mockImplementation(() => storeState);
  const rendered = render(<TodayPage />);
  rerenderPage = () => rendered.rerender(<TodayPage />);
  return rendered;
}

async function deleteFoodAndConfirm(itemId, foodIndex, mealTitle, foodName) {
  const mealBeforeDelete = storeState.timeline.find((item) => item.id === itemId);
  const isLastFoodBeforeDelete = Array.isArray(mealBeforeDelete?.foods) && mealBeforeDelete.foods.length === 1;
  const isDefaultMeal = ['breakfast', 'lunch', 'dinner'].includes(mealBeforeDelete?.subtype);
  const targetEntryId = mealBeforeDelete?.foods?.[foodIndex]?.entryId;
  const isPersistedEntry = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetEntryId || '');

  await act(async () => {
    fireEvent.click(screen.getByTestId(`delete-food-entry-${itemId}-${foodIndex}`));
  });
  await waitFor(() => {
    expect(screen.getByText(new RegExp(`将从${mealTitle}中删除“${foodName}”`))).toBeTruthy();
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  });
  await waitFor(() => {
    if (!isPersistedEntry) {
      expect(timelineService.deleteFoodEntry).not.toHaveBeenCalled();
      expect(timelineService.deleteFoodEntryThenCustomMeal).not.toHaveBeenCalled();
    } else if (isLastFoodBeforeDelete && !isDefaultMeal) {
      expect(timelineService.deleteFoodEntryThenCustomMeal).toHaveBeenCalled();
    } else {
      expect(timelineService.deleteFoodEntry).toHaveBeenCalled();
    }
  });
  await waitFor(() => {
    expect(toast.success.mock.calls.length + toast.error.mock.calls.length).toBeGreaterThan(0);
  });
  rerenderPage();
}

describe('TodayPage 食物删除闭环', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rerenderPage = null;
    lastTimelineUpdate = null;
    setTimelineMock.mockImplementation((updater) => {
      const nextTimeline = typeof updater === 'function' ? updater(storeState.timeline) : updater;
      lastTimelineUpdate = nextTimeline;
      storeState.timeline = nextTimeline;
    });
    timelineService.deleteFoodEntry.mockResolvedValue({ error: null });
    timelineService.deleteTimelineItemByUser.mockResolvedValue({ error: null });
    timelineService.deleteFoodEntryThenCustomMeal.mockResolvedValue({ foodDeleted: true, mealDeleted: true, error: null });
    timelineService.getTimelineByDate.mockResolvedValue({ data: [], error: null });
  });

  test('删除多食物餐次中的一个食物后，餐次继续存在且汇总更新', async () => {
    mountPage();

    expect(screen.getByTestId('total-cal').textContent).toBe('500');
    expect(screen.getByTestId('total-p').textContent).toBe('46');
    expect(screen.getByTestId('total-f').textContent).toBe('17');
    expect(screen.getByTestId('total-c').textContent).toBe('31');

    await deleteFoodAndConfirm(breakfastId, 0, '早餐', '鸡蛋');

    await waitFor(() => {
      expect(timelineService.deleteFoodEntry).toHaveBeenCalledWith(breakfastFoodA, 'user-1');
      expect(storeState.timeline).toHaveLength(2);
      const breakfast = storeState.timeline.find((item) => item.id === breakfastId);
      expect(breakfast.foods).toHaveLength(1);
      expect(breakfast.foods[0].name).toBe('燕麦');
      expect(screen.getByTestId('total-cal').textContent).toBe('380');
      expect(screen.getByTestId('total-p').textContent).toBe('36');
      expect(screen.getByTestId('total-f').textContent).toBe('9');
      expect(screen.getByTestId('total-c').textContent).toBe('30');
    });

    const lunch = storeState.timeline.find((item) => item.id === lunchId);
    expect(lunch.foods).toHaveLength(1);
    expect(lunch.foods[0].name).toBe('鸡胸肉');
  });

  test('删除固定午餐最后一个食物后保留空午餐并只删除food entry', async () => {
    mountPage();

    await deleteFoodAndConfirm(lunchId, 0, '午餐', '鸡胸肉');

    await waitFor(() => {
      expect(timelineService.deleteFoodEntry).toHaveBeenCalledWith(lunchFood, 'user-1');
      expect(timelineService.deleteTimelineItemByUser).not.toHaveBeenCalled();
      expect(storeState.timeline.find((item) => item.id === lunchId)?.foods).toHaveLength(0);
      expect(storeState.timeline).toHaveLength(2);
      expect(screen.getByTestId('total-cal').textContent).toBe('300');
    });
  });

  test.each([
    ['breakfast', '早餐', breakfastId, breakfastFoodA, '鸡蛋'],
    ['lunch', '午餐', lunchId, lunchFood, '鸡胸肉'],
    ['dinner', '晚餐', dinnerId, dinnerFood, '三文鱼'],
  ])('删除固定%s最后一个食物后固定餐次继续存在', async (subtype, title, itemId, entryId, foodName) => {
    mountPage([{
      id: itemId,
      type: 'meal',
      subtype,
      title,
      time: subtype === 'breakfast' ? '08:00' : subtype === 'lunch' ? '12:00' : '19:00',
      fixed: true,
      foods: [{ entryId, name: foodName, grams: 100, cal: 100, p: 10, f: 2, c: 5 }],
    }]);

    await deleteFoodAndConfirm(itemId, 0, title, foodName);

    expect(timelineService.deleteFoodEntry).toHaveBeenCalledWith(entryId, 'user-1');
    expect(timelineService.deleteTimelineItemByUser).not.toHaveBeenCalled();
    expect(storeState.timeline).toEqual([
      expect.objectContaining({ id: itemId, subtype, foods: [] }),
    ]);
  });

  test('删除自定义加餐最后一个食物后删除整个餐次', async () => {
    mountPage([{
      id: snackId,
      type: 'meal',
      subtype: 'snack',
      title: '训练后加餐',
      time: '16:00',
      fixed: false,
      foods: [{ entryId: snackFood, name: '酸奶', grams: 100, cal: 80, p: 5, f: 2, c: 10 }],
    }]);

    await deleteFoodAndConfirm(snackId, 0, '训练后加餐', '酸奶');

    expect(timelineService.deleteFoodEntryThenCustomMeal).toHaveBeenCalledWith(snackFood, snackId, 'user-1');
    expect(storeState.timeline).toHaveLength(0);
  });

  test('自定义餐次食品已删除但空餐次删除失败时保留空餐并明确报错', async () => {
    timelineService.deleteFoodEntryThenCustomMeal.mockResolvedValue({
      foodDeleted: true,
      mealDeleted: false,
      error: new Error('餐次删除失败'),
    });
    mountPage([{
      id: snackId,
      type: 'meal',
      subtype: 'snack',
      title: '训练后加餐',
      time: '16:00',
      foods: [{ entryId: snackFood, name: '酸奶', grams: 100, cal: 80 }],
    }]);

    await deleteFoodAndConfirm(snackId, 0, '训练后加餐', '酸奶');

    expect(storeState.timeline).toEqual([expect.objectContaining({ id: snackId, foods: [] })]);
    expect(toast.error).toHaveBeenCalledWith('食物已删除，但空餐次清理失败，请稍后重试');
    expect(clearFoodEntryPendingDeleteMock).toHaveBeenCalledWith(snackFood);
  });

  test('删除尚未同步的临时食品只更新本地且不发送无效远程delete', async () => {
    mountPage([{
      id: breakfastId,
      type: 'meal',
      subtype: 'breakfast',
      title: '早餐',
      foods: [{ entryId: 'pending-op-delete-local', clientMutationId: 'op-delete-local', name: '待同步食品', cal: 50, sync_status: 'pending' }],
    }]);

    await deleteFoodAndConfirm(breakfastId, 0, '早餐', '待同步食品');

    expect(timelineService.deleteFoodEntry).not.toHaveBeenCalled();
    expect(timelineService.deleteFoodEntryThenCustomMeal).not.toHaveBeenCalled();
    expect(storeState.timeline[0].foods).toHaveLength(0);
  });

  test('删除失败时保留原页面数据并提示错误', async () => {
    timelineService.deleteFoodEntry.mockResolvedValue({ error: new Error('删除失败') });
    mountPage();

    await deleteFoodAndConfirm(breakfastId, 0, '早餐', '鸡蛋');

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('删除失败');
      const breakfast = storeState.timeline.find((item) => item.id === breakfastId);
      expect(breakfast.foods).toHaveLength(2);
      expect(screen.getByTestId('total-cal').textContent).toBe('500');
    });
  });

  test('连续确认删除不会触发重复删除请求', async () => {
    let resolveDelete;
    timelineService.deleteFoodEntry.mockReturnValue(new Promise((resolve) => {
      resolveDelete = resolve;
    }));

    mountPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId(`delete-food-entry-${breakfastId}-0`));
    });
    await waitFor(() => {
      expect(screen.getByText(/固定餐次会继续保留/)).toBeTruthy();
    });
    const confirmButton = screen.getByRole('button', { name: '确认删除' });

    await act(async () => {
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
    });

    expect(timelineService.deleteFoodEntry).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDelete({ error: null });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        '食物已删除',
        expect.objectContaining({ duration: 2000 })
      );
    });
    rerenderPage();

    await waitFor(() => {
      const breakfast = storeState.timeline.find((item) => item.id === breakfastId);
      expect(breakfast.foods).toHaveLength(1);
    });
  });

  test('删除一个餐次食物不会影响其他餐次内容', async () => {
    mountPage();

    await deleteFoodAndConfirm(breakfastId, 1, '早餐', '燕麦');

    await waitFor(() => {
      const breakfast = storeState.timeline.find((item) => item.id === breakfastId);
      const lunch = storeState.timeline.find((item) => item.id === lunchId);

      expect(breakfast.foods).toHaveLength(1);
      expect(breakfast.foods[0].name).toBe('鸡蛋');
      expect(lunch.foods).toHaveLength(1);
      expect(lunch.foods[0].name).toBe('鸡胸肉');
    });
  });
});
