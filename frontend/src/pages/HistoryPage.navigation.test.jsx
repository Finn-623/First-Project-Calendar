import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { historyService } from '../services/historyService';
import { HistoryPage } from './HistoryPage';

const mockNavigate = jest.fn();
let mockLocation;
let mockHistory;
const mockSetHistory = jest.fn();
const mockResetDeletedDateState = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}), { virtual: true });

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('../store', () => ({
  useStore: jest.fn(),
}));

jest.mock('../services/historyService', () => ({
  historyService: {
    deleteHistoryDays: jest.fn(),
  },
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

const historyEntry = {
  dateStr: '2026-07-27',
  dateLabel: '2026年7月27日',
  totals: { cal: 600, p: 30, f: 20, c: 70 },
  timeline: [],
};

const renderPage = () => render(<HistoryPage />);

describe('HistoryPage 返回导航', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation = { pathname: '/history', state: null };
    mockHistory = [historyEntry];
    window.history.replaceState({ idx: 0 }, '');
    historyService.deleteHistoryDays.mockResolvedValue({ data: null, error: null });
    useStore.mockImplementation(() => ({
      history: mockHistory,
      plan: { calories: 2000 },
      setHistory: mockSetHistory,
      resetDeletedDateState: mockResetDeletedDateState,
    }));
  });

  test('历史列表顶部始终显示适合手机点击的返回按钮', () => {
    renderPage();

    const backButton = screen.getByRole('button', { name: '返回上一页' });
    expect(backButton).toBeTruthy();
    expect(backButton.className).toContain('min-h-11');
    expect(backButton.className).toContain('min-w-11');
  });

  test('从设置页进入时返回设置页且不修改历史或日期状态', () => {
    mockLocation = { pathname: '/history', state: { returnTo: 'settings' } };
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '返回上一页' }));

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
    expect(mockSetHistory).not.toHaveBeenCalled();
    expect(mockResetDeletedDateState).not.toHaveBeenCalled();
  });

  test('存在有效应用内上一页时优先返回上一页', () => {
    window.history.replaceState({ idx: 2 }, '');
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '返回上一页' }));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  test('直接访问或刷新且没有有效上一页时回退设置页', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '返回上一页' }));

    expect(mockNavigate).toHaveBeenCalledWith('/settings', { replace: true });
  });

  test('单条删除返回空历史列表后返回按钮仍存在', () => {
    const { rerender } = renderPage();
    mockHistory = [];

    rerender(<HistoryPage />);

    expect(screen.getByText('暂无历史记录')).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回上一页' })).toBeTruthy();
  });

  test('批量删除完成后返回按钮仍存在', async () => {
    renderPage();

    fireEvent.click(screen.getByTestId('history-batch-delete-toggle'));
    fireEvent.click(screen.getByTestId('history-item-0'));
    fireEvent.click(screen.getByTestId('history-batch-delete-selected'));
    fireEvent.click(screen.getByTestId('history-batch-confirm-delete'));

    await waitFor(() => {
      expect(historyService.deleteHistoryDays).toHaveBeenCalledWith(['2026-07-27']);
      expect(mockSetHistory).toHaveBeenCalled();
      expect(mockResetDeletedDateState).toHaveBeenCalledWith('2026-07-27');
      expect(toast.success).toHaveBeenCalledWith('已删除 1 天历史记录');
    });
    expect(screen.getByRole('button', { name: '返回上一页' })).toBeTruthy();
  });
});
