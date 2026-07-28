import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { historyService } from '../services/historyService';
import { HistoryDetailPage } from './HistoryDetailPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: () => ({ dateStr: '2026-07-27' }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}), { virtual: true });

jest.mock('../store', () => ({
  useStore: jest.fn(),
}));

jest.mock('../services/historyService', () => ({
  historyService: {
    deleteFullDayRecords: jest.fn(),
    updateDayArchive: jest.fn(),
  },
}));

jest.mock('../services/timelineService', () => ({
  timelineService: {
    completeRunningTimelineItem: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../hooks/useCurrentTime', () => ({
  useCurrentTime: () => new Date('2026-07-27T12:00:00+10:00'),
}));

jest.mock('../components/TimelineItem', () => ({
  TimelineItem: () => <div data-testid="timeline-item" />,
}));

jest.mock('../components/NutritionSummary', () => ({
  NutritionSummary: () => <div data-testid="nutrition-summary" />,
}));

jest.mock('../modals/AddFoodSheet', () => ({
  AddFoodSheet: () => null,
}));

jest.mock('../modals/EditTimeSheet', () => ({
  EditTimeSheet: () => null,
}));

jest.mock('../modals/EditActivitySheet', () => ({
  EditActivitySheet: () => null,
}));

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

const loadHistoryMock = jest.fn();
const resetDeletedDateStateMock = jest.fn();

const historyEntry = {
  dateStr: '2026-07-27',
  dateLabel: '7月27日 · 周一',
  timeline: [],
  totals: {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  },
  isEmptyDay: true,
  isCompleted: true,
};

function mockStore(overrides = {}) {
  useStore.mockReturnValue({
    history: [historyEntry],
    plan: null,
    user: { id: 'user-1' },
    loadHistory: loadHistoryMock,
    resetDeletedDateState: resetDeletedDateStateMock,
    ...overrides,
  });
}

function renderPage() {
  return render(<HistoryDetailPage />);
}

function openDeleteDialog() {
  fireEvent.click(screen.getByTestId('history-delete-day'));
}

function confirmDelete() {
  fireEvent.click(screen.getByRole('button', { name: '删除整天记录' }));
}

describe('HistoryDetailPage 删除整天记录', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore();
    historyService.deleteFullDayRecords.mockResolvedValue({ data: null, error: null });
    loadHistoryMock.mockResolvedValue({ success: true, data: [] });
  });

  test('默认查看模式下按钮可点击并打开二次确认弹窗', () => {
    renderPage();

    const deleteButton = screen.getByTestId('history-delete-day');
    expect(deleteButton.disabled).toBe(false);

    openDeleteDialog();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('删除整天记录？')).toBeTruthy();
    expect(screen.getByText(/确定删除2026-07-27的全部记录吗/)).toBeTruthy();
  });

  test('取消确认时不调用删除服务', () => {
    renderPage();
    openDeleteDialog();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(historyService.deleteFullDayRecords).not.toHaveBeenCalled();
    expect(resetDeletedDateStateMock).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('确认后删除路由日期并完成刷新、状态清理和导航', async () => {
    renderPage();
    openDeleteDialog();
    confirmDelete();

    await waitFor(() => {
      expect(historyService.deleteFullDayRecords).toHaveBeenCalledWith('2026-07-27');
      expect(loadHistoryMock).toHaveBeenCalledWith('user-1');
      expect(resetDeletedDateStateMock).toHaveBeenCalledWith('2026-07-27');
      expect(mockNavigate).toHaveBeenCalledWith('/history', { state: { fallbackTo: 'settings' } });
      expect(toast.success).toHaveBeenCalledWith('历史记录已删除');
    });
  });

  test('删除服务失败时提示错误且不刷新、清理或导航', async () => {
    historyService.deleteFullDayRecords.mockResolvedValue({
      data: null,
      error: new Error('删除请求失败'),
    });

    renderPage();
    openDeleteDialog();
    confirmDelete();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('删除请求失败');
    });
    expect(loadHistoryMock).not.toHaveBeenCalled();
    expect(resetDeletedDateStateMock).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('缺少用户信息时提供错误反馈且不调用删除服务', async () => {
    mockStore({ user: null });

    renderPage();
    openDeleteDialog();
    confirmDelete();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('无法确认当前用户，请重新登录后重试');
    });
    expect(historyService.deleteFullDayRecords).not.toHaveBeenCalled();
    expect(resetDeletedDateStateMock).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('删除成功但历史刷新失败时不宣称完整成功', async () => {
    loadHistoryMock.mockResolvedValue({ success: false, error: new Error('刷新失败') });

    renderPage();
    openDeleteDialog();
    confirmDelete();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('记录已删除，但历史列表刷新失败，请稍后重试');
      expect(resetDeletedDateStateMock).toHaveBeenCalledWith('2026-07-27');
      expect(mockNavigate).toHaveBeenCalledWith('/history', { state: { fallbackTo: 'settings' } });
    });
    expect(toast.success).not.toHaveBeenCalled();
  });
});
