import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { timelineService } from '../services/timelineService';
import { TodayPage } from './TodayPage';

jest.mock('../store', () => ({ useStore: jest.fn() }));
jest.mock('../services/timelineService', () => ({
  timelineService: {
    createTimelineItem: jest.fn(),
    updateTimelineItem: jest.fn(),
    updateTimelineItemByUser: jest.fn(),
    completeRunningTimelineItem: jest.fn(),
    deleteTimelineItemByUser: jest.fn(),
    deleteFoodEntry: jest.fn(),
  },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock('../hooks/useCurrentTime', () => ({
  useCurrentTime: () => new Date('2026-07-28T10:00:00+10:00'),
}));
jest.mock('../components/LiveClock', () => ({ LiveClock: () => null }));
jest.mock('../components/NutritionSummary', () => ({ NutritionSummary: () => null }));
jest.mock('../modals/AddFoodSheet', () => ({ AddFoodSheet: () => null }));
jest.mock('../modals/AddSnackSheet', () => ({ AddSnackSheet: () => null }));
jest.mock('../modals/AddTrainingSheet', () => ({ AddTrainingSheet: () => null }));
jest.mock('../modals/AddEventSheet', () => ({ AddEventSheet: () => null }));
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
jest.mock('../modals/EditTimeSheet', () => ({
  EditTimeSheet: ({ open, item, onConfirm, onOpenChange }) => (open ? (
    <div role="dialog">
      <span>当前时间 {item.time}</span>
      <button type="button" onClick={() => onOpenChange(false)}>取消</button>
      <button
        type="button"
        onClick={async () => {
          try {
            await onConfirm('13:30');
          } catch {
            // The real sheet keeps the dialog open and renders the error.
          }
        }}
      >
        保存新时间
      </button>
    </div>
  ) : null),
}));

const breakfastId = '11111111-1111-4111-8111-111111111111';
const lunchId = '22222222-2222-4222-8222-222222222222';
const dinnerId = '33333333-3333-4333-8333-333333333333';
const baseTimeline = () => ([
  {
    id: breakfastId,
    type: 'meal',
    subtype: 'breakfast',
    title: '早餐',
    time: '08:00',
    fixed: true,
    foods: [{ entryId: 'food-1', name: '鸡蛋', grams: 100, cal: 120, p: 10, f: 8, c: 1 }],
  },
  { id: lunchId, type: 'meal', subtype: 'lunch', title: '午餐', time: '12:30', fixed: true, foods: [] },
  { id: dinnerId, type: 'meal', subtype: 'dinner', title: '晚餐', time: '19:00', fixed: true, foods: [] },
  { id: 'snack-1', type: 'meal', subtype: 'snack', title: '加餐', time: '15:00', fixed: false, foods: [] },
]);

let storeState;
let rerenderPage;

const setTimeline = jest.fn((updater) => {
  storeState.timeline = typeof updater === 'function' ? updater(storeState.timeline) : updater;
});

const mountPage = () => {
  storeState = {
    timeline: baseTimeline(),
    setTimeline,
    plan: null,
    dateLabel: '7月28日',
    endDay: jest.fn().mockResolvedValue({ success: true }),
    dayInitialized: true,
    currentDate: new Date('2026-07-28T09:00:00+10:00'),
    recordingDateStr: '2026-07-28',
    setSelectedDate: jest.fn(),
    goHome: jest.fn(),
    user: { id: 'user-1' },
    loadHistory: jest.fn().mockResolvedValue({ success: true }),
  };
  useStore.mockImplementation(() => storeState);
  const rendered = render(<TodayPage />);
  rerenderPage = () => rendered.rerender(<TodayPage />);
};

describe('TodayPage 固定三餐直接修改时间', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTimeline.mockImplementation((updater) => {
      storeState.timeline = typeof updater === 'function' ? updater(storeState.timeline) : updater;
    });
    timelineService.updateTimelineItemByUser.mockResolvedValue({
      data: { id: breakfastId, type: 'meal', subtype: 'breakfast', title: '早餐', time: '13:30' },
      error: null,
    });
  });

  test('固定三餐移除独立编辑按钮，点击当前时间显示原时间，取消不保存', () => {
    mountPage();

    expect(screen.queryByTestId(`edit-time-${breakfastId}`)).toBeNull();
    expect(screen.queryByTestId(`edit-time-${lunchId}`)).toBeNull();
    expect(screen.queryByTestId(`edit-time-${dinnerId}`)).toBeNull();
    expect(screen.getByTestId('edit-time-snack-1')).toBeTruthy();

    fireEvent.click(screen.getByTestId(`meal-time-trigger-${breakfastId}`));
    expect(screen.getByText('当前时间 08:00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(timelineService.updateTimelineItemByUser).not.toHaveBeenCalled();
    expect(storeState.timeline[0].time).toBe('08:00');
  });

  test('保存成功后按新时间重排且保留餐内食物，不创建重复餐次', async () => {
    mountPage();
    fireEvent.click(screen.getByTestId(`meal-time-trigger-${breakfastId}`));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '保存新时间' }));
    });
    await waitFor(() => {
      expect(timelineService.updateTimelineItemByUser).toHaveBeenCalledWith(
        breakfastId,
        'user-1',
        { event_time: '13:30' }
      );
      expect(storeState.timeline.find((item) => item.id === breakfastId).time).toBe('13:30');
    });
    rerenderPage();
    expect(screen.getAllByText('13:30').length).toBeGreaterThan(0);

    const breakfast = storeState.timeline.find((item) => item.subtype === 'breakfast');
    expect(breakfast.foods).toHaveLength(1);
    expect(storeState.timeline.filter((item) => item.subtype === 'breakfast')).toHaveLength(1);
    expect(screen.getByTestId(`timeline-item-${lunchId}`)
      .compareDocumentPosition(screen.getByTestId(`timeline-item-${breakfastId}`))
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('保存失败保留原时间并提示错误', async () => {
    timelineService.updateTimelineItemByUser.mockResolvedValue({
      data: null,
      error: new Error('网络错误'),
    });
    mountPage();
    fireEvent.click(screen.getByTestId(`meal-time-trigger-${breakfastId}`));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '保存新时间' }));
    });

    expect(storeState.timeline.find((item) => item.id === breakfastId).time).toBe('08:00');
    expect(toast.error).toHaveBeenCalledWith('网络错误');
  });

  test('尚未落库的固定餐次只创建一次并用数据库记录替换临时 ID', async () => {
    const temporaryId = 'm1-local';
    timelineService.createTimelineItem.mockResolvedValue({
      data: { id: breakfastId, type: 'meal', subtype: 'breakfast', title: '早餐', time: '13:30' },
      error: null,
    });
    mountPage();
    storeState.timeline[0].id = temporaryId;
    rerenderPage();

    fireEvent.click(screen.getByTestId(`meal-time-trigger-${temporaryId}`));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '保存新时间' }));
    });
    await waitFor(() => expect(timelineService.createTimelineItem).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(storeState.timeline.find((item) => item.subtype === 'breakfast').id).toBe(breakfastId);
    });
    expect(storeState.timeline.filter((item) => item.subtype === 'breakfast')).toHaveLength(1);
  });
});
