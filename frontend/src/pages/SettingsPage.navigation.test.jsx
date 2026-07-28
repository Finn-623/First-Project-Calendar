import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { useStore } from '../store';
import { SettingsPage } from './SettingsPage';

const mockNavigate = jest.fn();
const mockRemoveQueries = jest.fn();
let logoutMock;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    removeQueries: mockRemoveQueries,
  }),
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

jest.mock('../store', () => ({
  useStore: jest.fn(),
}));

jest.mock('../components/settings/SettingsNavigationItem', () => ({
  SettingsNavigationItem: ({ onClick, label, testId }) => (
    <button type="button" onClick={onClick} data-testid={testId}>{label}</button>
  ),
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

describe('SettingsPage 导航与退出账号', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logoutMock = jest.fn().mockResolvedValue({ success: true });
    useStore.mockReturnValue({
      profile: { display_name: '测试用户' },
      authLoading: false,
      logout: logoutMock,
    });
  });

  test('设置中的记录历史记录入口继续导航到现有历史页面', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByTestId('settings-entry-record-history'));

    expect(mockNavigate).toHaveBeenCalledWith('/history', {
      state: { returnTo: 'settings' },
    });
  });

  test('账户区域只显示退出账号入口，点击后显示确认弹窗', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('button', { name: '退出账号' })).toBeTruthy();
    expect(screen.queryByText('切换账号')).toBeNull();
    expect(screen.queryByText(/请登录其他账号|正在切换账号/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '退出账号' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '退出账号' })).toBeTruthy();
    expect(screen.getByText('确定要退出当前账户吗？')).toBeTruthy();
  });

  test('取消确认保持登录状态且不导航', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: '退出账号' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(logoutMock).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('确认后调用现有退出方法、清理私有查询并进入普通登录页', async () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: '退出账号' }));
    fireEvent.click(screen.getByRole('button', { name: '退出' }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(mockRemoveQueries).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  test('连续确认只提交一次并显示退出加载状态', async () => {
    let resolveLogout;
    logoutMock.mockReturnValue(new Promise((resolve) => {
      resolveLogout = resolve;
    }));
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: '退出账号' }));
    const confirmButton = screen.getByRole('button', { name: '退出' });

    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '正在退出...' }).disabled).toBe(true);

    await act(async () => {
      resolveLogout({ success: true });
    });
  });

  test('退出失败时保留当前页面并显示明确错误', async () => {
    logoutMock.mockResolvedValue({ success: false, error: '网络异常，退出失败' });
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: '退出账号' }));
    fireEvent.click(screen.getByRole('button', { name: '退出' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('网络异常，退出失败');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
