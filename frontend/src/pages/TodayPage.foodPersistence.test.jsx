import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { timelineService } from '../services/timelineService';
import { scheduleAfterPaint } from '../lib/afterPaint';
import { TodayPage } from './TodayPage';

const mockScheduledAfterPaintTasks = [];

jest.mock('../store', () => ({ useStore: jest.fn() }));
jest.mock('../services/timelineService', () => ({
  timelineService: {
    createFoodEntryForMeal: jest.fn(),
    createTimelineItem: jest.fn(),
    updateTimelineItem: jest.fn(),
    updateTimelineItemByUser: jest.fn(),
    completeRunningTimelineItem: jest.fn(),
    deleteTimelineItemByUser: jest.fn(),
    deleteFoodEntry: jest.fn(),
  },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../lib/afterPaint', () => ({
  scheduleAfterPaint: jest.fn((task) => mockScheduledAfterPaintTasks.push(task)),
}));
jest.mock('../hooks/useCurrentTime', () => ({
  useCurrentTime: () => new Date('2026-07-28T23:30:00+10:00'),
}));
jest.mock('../components/LiveClock', () => ({ LiveClock: () => null }));
jest.mock('../components/NutritionSummary', () => ({
  NutritionSummary: ({ totals }) => <div data-testid="total-calories">{totals?.cal || 0}</div>,
}));
jest.mock('../modals/AddFoodSheet', () => ({
  AddFoodSheet: ({ open, onConfirm }) => (open ? (
    <button
      type="button"
      onClick={() => onConfirm({
        foodId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: '测试燕麦',
        grams: 50,
        cal: 190,
        p: 6.5,
        f: 3.5,
        c: 32,
      })}
    >
      确认测试食品
    </button>
  ) : null),
}));
jest.mock('../modals/AddSnackSheet', () => ({ AddSnackSheet: () => null }));
jest.mock('../modals/AddTrainingSheet', () => ({ AddTrainingSheet: () => null }));
jest.mock('../modals/AddEventSheet', () => ({ AddEventSheet: () => null }));
jest.mock('../modals/EditTimeSheet', () => ({ EditTimeSheet: () => null }));
jest.mock('../modals/EditActivitySheet', () => ({ EditActivitySheet: () => null }));
jest.mock('../components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
  AlertDialogAction: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
}));

const persistedMealId = '11111111-1111-4111-8111-111111111111';
const persistedEntryId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let storeState;

const setTimeline = jest.fn((updater) => {
  storeState.timeline = typeof updater === 'function' ? updater(storeState.timeline) : updater;
});

const mountPage = () => {
  storeState = {
    timeline: [{
      id: 'm1-local',
      type: 'meal',
      subtype: 'breakfast',
      title: '早餐',
      time: '08:00',
      fixed: true,
      foods: [],
    }],
    setTimeline,
    plan: null,
    dateLabel: '7月28日',
    endDay: jest.fn().mockResolvedValue({ success: true }),
    dayInitialized: true,
    currentDate: new Date('2026-07-28T23:30:00+10:00'),
    recordingDateStr: '2026-07-28',
    setSelectedDate: jest.fn(),
    goHome: jest.fn(),
    user: { id: 'user-1' },
    loadHistory: jest.fn().mockResolvedValue({ success: true }),
  };
  useStore.mockImplementation(() => storeState);
  return render(<TodayPage />);
};

describe('TodayPage 食品记录持久化', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduledAfterPaintTasks.splice(0);
    scheduleAfterPaint.mockImplementation((task) => mockScheduledAfterPaintTasks.push(task));
    setTimeline.mockImplementation((updater) => {
      storeState.timeline = typeof updater === 'function' ? updater(storeState.timeline) : updater;
    });
    timelineService.createFoodEntryForMeal.mockResolvedValue({
      data: {
        meal: {
          id: persistedMealId,
          type: 'meal',
          subtype: 'breakfast',
          title: '早餐',
          time: '08:00',
        },
        foodEntry: {
          entryId: persistedEntryId,
          foodEntryId: persistedEntryId,
          foodId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: '测试燕麦',
          grams: 50,
          cal: 190,
          p: 6.5,
          f: 3.5,
          c: 32,
        },
      },
      error: null,
    });
  });

  test('数据库写入成功后才使用真实餐次和food entry ID更新页面及汇总', async () => {
    const rendered = mountPage();
    fireEvent.click(screen.getByTestId('add-food-m1-local'));
    fireEvent.click(screen.getByRole('button', { name: '确认测试食品' }));
    expect(screen.getByText('测试燕麦')).toBeTruthy();
    expect(screen.getByTestId('total-calories').textContent).toBe('190');
    expect(timelineService.createFoodEntryForMeal).not.toHaveBeenCalled();
    await act(async () => mockScheduledAfterPaintTasks.shift()());

    expect(timelineService.createFoodEntryForMeal).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      dateStr: '2026-07-28',
      meal: expect.objectContaining({ id: 'm1-local', subtype: 'breakfast' }),
      food: expect.objectContaining({ name: '测试燕麦', grams: 50 }),
      operationId: expect.stringMatching(/^op-/),
    }));
    await waitFor(() => {
      expect(storeState.timeline[0].id).toBe(persistedMealId);
      expect(storeState.timeline[0].foods[0].entryId).toBe(persistedEntryId);
    });

    rendered.rerender(<TodayPage />);
    expect(screen.getByText('测试燕麦')).toBeTruthy();
    expect(screen.getByTestId('total-calories').textContent).toBe('190');
    expect(toast.success).toHaveBeenCalled();
  });

  test('写入失败回滚乐观记录且不污染本地快照或显示成功提示', async () => {
    timelineService.createFoodEntryForMeal.mockResolvedValue({
      data: null,
      error: new Error('数据库写入失败'),
    });
    mountPage();
    fireEvent.click(screen.getByTestId('add-food-m1-local'));
    fireEvent.click(screen.getByRole('button', { name: '确认测试食品' }));
    await act(async () => mockScheduledAfterPaintTasks.shift()());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('数据库写入失败'));
    expect(storeState.timeline[0].id).toBe('m1-local');
    expect(storeState.timeline[0].foods).toHaveLength(0);
    expect(toast.success).not.toHaveBeenCalled();
  });

  test('远程 Promise 永久 pending 时先更新 Store 并立即关闭 Sheet', () => {
    const order = [];
    setTimeline.mockImplementation((updater) => {
      order.push('optimistic-store-update');
      storeState.timeline = typeof updater === 'function' ? updater(storeState.timeline) : updater;
    });
    timelineService.createFoodEntryForMeal.mockImplementation(() => {
      order.push('supabase-request-start');
      return new Promise(() => {});
    });
    mountPage();
    fireEvent.click(screen.getByTestId('add-food-m1-local'));
    fireEvent.click(screen.getByRole('button', { name: '确认测试食品' }));

    expect(order[0]).toBe('optimistic-store-update');
    expect(order).not.toContain('supabase-request-start');
    expect(storeState.timeline[0].foods).toEqual([
      expect.objectContaining({ name: '测试燕麦', sync_status: expect.stringMatching(/pending|syncing/) }),
    ]);
    expect(screen.queryByRole('button', { name: '确认测试食品' })).toBeNull();
    expect(screen.getByText('测试燕麦')).toBeTruthy();
    mockScheduledAfterPaintTasks.shift()();
    expect(order).toEqual(['optimistic-store-update', 'supabase-request-start']);
  });

  test('慢请求期间连续确认只发出一次写入', async () => {
    let resolveSave;
    timelineService.createFoodEntryForMeal.mockReturnValue(new Promise((resolve) => {
      resolveSave = resolve;
    }));
    mountPage();
    fireEvent.click(screen.getByTestId('add-food-m1-local'));
    const confirm = screen.getByRole('button', { name: '确认测试食品' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(mockScheduledAfterPaintTasks).toHaveLength(1);
    expect(timelineService.createFoodEntryForMeal).not.toHaveBeenCalled();
    expect(storeState.timeline[0].foods).toEqual([
      expect.objectContaining({ name: '测试燕麦', sync_status: 'pending' }),
    ]);

    await act(async () => {
      mockScheduledAfterPaintTasks.shift()();
      resolveSave({
        data: {
          meal: { id: persistedMealId, type: 'meal', subtype: 'breakfast', title: '早餐', time: '08:00' },
          foodEntry: { entryId: persistedEntryId, name: '测试燕麦', grams: 50, cal: 190, p: 6.5, f: 3.5, c: 32 },
        },
        error: null,
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(storeState.timeline[0].foods).toHaveLength(1);
      expect(storeState.timeline[0].foods[0]).toEqual(expect.objectContaining({
        entryId: persistedEntryId,
        sync_status: 'synced',
      }));
    });
  });
});
