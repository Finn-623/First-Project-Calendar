import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { useStore } from '../store';
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
  useCurrentTime: () => new Date(),
}));
jest.mock('../components/LiveClock', () => ({ LiveClock: () => null }));
jest.mock('../components/NutritionSummary', () => ({ NutritionSummary: () => null }));
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

let storeState;

const formatDateLabel = (date) => `${date.getMonth() + 1}月${date.getDate()}日`;

const mountPage = (selectedDate = new Date(2026, 6, 28, 12, 0)) => {
  storeState = {
    timeline: [],
    setTimeline: jest.fn(),
    plan: null,
    dateLabel: formatDateLabel(selectedDate),
    endDay: jest.fn().mockResolvedValue({ success: true }),
    dayInitialized: true,
    currentDate: selectedDate,
    recordingDateStr: '2026-07-28',
    setSelectedDate: jest.fn(),
    goHome: jest.fn(),
    user: { id: 'user-1' },
    loadHistory: jest.fn().mockResolvedValue({ success: true }),
  };
  useStore.mockImplementation(() => storeState);
  return render(<TodayPage />);
};

const updateSelectedDate = (rendered, date) => {
  storeState.currentDate = date;
  storeState.dateLabel = formatDateLabel(date);
  rendered.rerender(<TodayPage />);
};

describe('TodayPage 非本日日期固定提示', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 28, 23, 55));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('真实本日不显示，过去与未来日期显示实际日期，返回本日后消失', () => {
    const rendered = mountPage();
    expect(screen.queryByTestId('non-today-date-notice')).toBeNull();

    updateSelectedDate(rendered, new Date(2026, 6, 27, 12, 0));
    expect(screen.getByTestId('non-today-date-notice').textContent)
      .toContain('你已离开本日，当前正在查看和修改 7月27日的记录与计划。');

    updateSelectedDate(rendered, new Date(2026, 6, 29, 12, 0));
    expect(screen.getByTestId('non-today-date-notice').textContent).toContain('7月29日');

    updateSelectedDate(rendered, new Date(2026, 6, 28, 12, 0));
    expect(screen.queryByTestId('non-today-date-notice')).toBeNull();
  });

  test('结束本日或刷新恢复到下一记录日时持续显示且不会自动消失', () => {
    mountPage(new Date(2026, 6, 29, 12, 0));
    expect(screen.getByTestId('non-today-date-notice')).toBeTruthy();
    expect(screen.getByText(/7月29日的记录与计划/)).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId('non-today-date-notice')).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('设备本地午夜前后只按本地年月日比较，不受 UTC 日期影响', () => {
    jest.setSystemTime(new Date(2026, 6, 28, 0, 5));
    mountPage(new Date(2026, 6, 28, 18, 0));
    expect(screen.queryByTestId('non-today-date-notice')).toBeNull();
  });

  test('其他年份显示年份以避免歧义', () => {
    mountPage(new Date(2027, 0, 2, 12, 0));
    expect(screen.getByTestId('non-today-date-notice').textContent)
      .toContain('2027年1月2日的记录与计划');
  });
});
