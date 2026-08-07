import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useStore } from '../store';
import { timelineService } from '../services/timelineService';
import { TodayPage } from './TodayPage';

jest.mock('../store', () => ({ useStore: jest.fn() }));
jest.mock('../services/timelineService', () => ({
  timelineService: {
    updateTimelineItemByUser: jest.fn(),
    updateTimelineItem: jest.fn(),
    createTimelineItem: jest.fn(),
    completeRunningTimelineItem: jest.fn(),
    deleteTimelineItemByUser: jest.fn(),
    deleteFoodEntry: jest.fn(),
  },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../hooks/useCurrentTime', () => ({
  useCurrentTime: () => new Date('2026-07-28T12:00:00+10:00'),
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

const event = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'event',
  title: '项目会议',
  time: '10:00',
  event_time: '10:00',
  notes: '保留这段内容',
  status: 'completed',
  ended_at: null,
  foods: [],
};

const fixedMeal = (subtype) => ({
  id: `${subtype}-1`,
  type: 'meal',
  subtype,
  title: subtype === 'breakfast' ? '早餐' : subtype === 'lunch' ? '午餐' : '晚餐',
  time: '08:00',
  fixed: true,
  foods: [],
});

let storeState;

const mountPage = (selectedDate = new Date(2026, 6, 28, 12, 0), timeline = [event]) => {
  storeState = {
    timeline,
    setTimeline: jest.fn((updater) => {
      storeState.timeline = typeof updater === 'function' ? updater(storeState.timeline) : updater;
    }),
    plan: null,
    dateLabel: '7月28日',
    endDay: jest.fn(),
    dayInitialized: true,
    timelineSyncError: null,
    currentDate: selectedDate,
    recordingDateStr: '2026-07-28',
    setSelectedDate: jest.fn(),
    goHome: jest.fn(),
    user: { id: 'user-1' },
    loadHistory: jest.fn().mockResolvedValue({ success: true }),
    markFoodEntryPendingDelete: jest.fn(),
    clearFoodEntryPendingDelete: jest.fn(),
  };
  useStore.mockImplementation(() => storeState);
  return render(<TodayPage />);
};

describe('TodayPage 普通事件结束', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    timelineService.updateTimelineItemByUser.mockResolvedValue({
      data: { ...event, status: 'completed', ended_at: '2026-07-28T12:00:01.000Z' },
      error: null,
    });
  });

  test('普通事件显示结束事件，固定三餐不显示', () => {
    mountPage(new Date(2026, 6, 28, 12, 0), [event, fixedMeal('breakfast'), fixedMeal('lunch'), fixedMeal('dinner')]);

    expect(screen.getByTestId(`end-event-${event.id}`)).toBeTruthy();
    expect(screen.queryByTestId('end-event-breakfast-1')).toBeNull();
    expect(screen.queryByTestId('end-event-lunch-1')).toBeNull();
    expect(screen.queryByTestId('end-event-dinner-1')).toBeNull();
  });

  test('确认结束后保留事件、显示已结束并移除结束按钮', async () => {
    const rendered = mountPage();

    fireEvent.click(screen.getByTestId(`end-event-${event.id}`));
    expect(screen.getByRole('dialog').textContent).toContain('确定结束“项目会议”吗？');

    fireEvent.click(screen.getByRole('button', { name: '确认结束' }));

    await waitFor(() => expect(timelineService.updateTimelineItemByUser).toHaveBeenCalledWith(
      event.id,
      'user-1',
      expect.objectContaining({ status: 'completed', ended_at: expect.any(String) })
    ));
    rendered.rerender(<TodayPage />);
    expect(screen.getByText('项目会议')).toBeTruthy();
    expect(screen.getByTestId(`ended-event-${event.id}`).textContent).toContain('已结束');
    expect(screen.queryByTestId(`end-event-${event.id}`)).toBeNull();
    expect(screen.getByTestId(`delete-timeline-${event.id}`)).toBeTruthy();
  });

  test('重新挂载已结束事件仍保留状态，未来事件不会自动结束但可手动结束', async () => {
    const futureEvent = { ...event, id: '22222222-2222-4222-8222-222222222222' };
    const rendered = mountPage(new Date(2026, 6, 29, 12, 0), [futureEvent]);
    expect(screen.getByTestId(`end-event-${futureEvent.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`ended-event-${futureEvent.id}`)).toBeNull();

    fireEvent.click(screen.getByTestId(`end-event-${futureEvent.id}`));
    fireEvent.click(screen.getByRole('button', { name: '确认结束' }));
    await waitFor(() => expect(timelineService.updateTimelineItemByUser).toHaveBeenCalled());

    const endedEvent = { ...futureEvent, ended_at: '2026-07-28T12:00:01.000Z' };
    storeState.timeline = [endedEvent];
    rendered.rerender(<TodayPage />);
    expect(screen.getByTestId(`ended-event-${futureEvent.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`end-event-${futureEvent.id}`)).toBeNull();
  });
});
