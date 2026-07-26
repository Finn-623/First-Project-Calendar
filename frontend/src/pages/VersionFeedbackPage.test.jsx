import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useStore } from '../store';
import { versionFeedbackService } from '../services/versionFeedbackService';
import { toast } from 'sonner';

jest.mock('../components/settings/SettingsSubpageHeader', () => ({
  SettingsSubpageHeader: ({ title, description }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

jest.mock('../components/ui/badge', () => ({
  Badge: ({ children }) => <span>{children}</span>,
}));

jest.mock('../components/ui/tabs', () => {
  const ReactLib = require('react');
  const TabsContext = ReactLib.createContext({ value: '', setValue: () => {} });

  return {
    Tabs: ({ value, onValueChange, children }) => (
      <TabsContext.Provider value={{ value, setValue: onValueChange }}>
        {children}
      </TabsContext.Provider>
    ),
    TabsList: ({ children }) => <div>{children}</div>,
    TabsTrigger: ({ value, children }) => {
      const context = ReactLib.useContext(TabsContext);
      return (
        <button
          type="button"
          role="tab"
          aria-selected={context.value === value}
          onClick={() => context.setValue(value)}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({ value, children }) => {
      const context = ReactLib.useContext(TabsContext);
      if (context.value !== value) return null;
      return <div>{children}</div>;
    },
  };
});

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

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>{children}</a>
  ),
}), { virtual: true });

jest.mock('../store', () => ({
  useStore: jest.fn(),
}));

jest.mock('../services/versionFeedbackService', () => ({
  versionFeedbackService: {
    listFeedback: jest.fn(),
    createFeedback: jest.fn(),
    updateFeedbackContent: jest.fn(),
    deleteFeedback: jest.fn(),
    completeFeedback: jest.fn(),
    reopenFeedback: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { VersionFeedbackPage } from './VersionFeedbackPage';

function renderPage() {
  return render(<VersionFeedbackPage />);
}

function openHistoryTab() {
  fireEvent.click(screen.getByRole('tab', { name: '建议历史' }));
}

describe('VersionFeedbackPage history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStore.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role: 'user', is_admin: false },
    });

    versionFeedbackService.listFeedback.mockResolvedValue({
      success: true,
      data: [],
      hasMore: false,
      nextCursor: null,
    });
  });

  test('shows no-record state when query succeeds with empty list', async () => {
    renderPage();
    openHistoryTab();

    expect(await screen.findByText('目前没有记录')).toBeTruthy();
    expect(screen.getByRole('button', { name: '提交修改意见' })).toBeTruthy();
  });

  test('shows error state when history query fails', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: false,
      error: 'network',
    });

    renderPage();
    openHistoryTab();

    expect(await screen.findByText('记录加载失败，请重试')).toBeTruthy();
  });

  test('keeps records sorted by created_at desc in history view', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'older',
          user_id: 'user-1',
          title: '旧建议',
          description: 'old',
          status: 'pending',
          created_at: '2026-07-20T10:00:00.000Z',
          updated_at: '2026-07-20T10:00:00.000Z',
          completed_at: null,
          completed_version: null,
        },
        {
          id: 'newer',
          user_id: 'user-1',
          title: '新建议',
          description: 'new',
          status: 'pending',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-07-21T10:00:00.000Z',
          completed_at: null,
          completed_version: null,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    renderPage();
    openHistoryTab();

    await screen.findByText('新建议');
    const newerNode = screen.getByText('新建议');
    const olderNode = screen.getByText('旧建议');

    expect(Boolean(newerNode.compareDocumentPosition(olderNode) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  test('allows owner to open edit mode with current values', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'f1',
          user_id: 'user-1',
          title: '原标题',
          description: '原内容',
          status: 'pending',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-07-21T10:00:00.000Z',
          completed_at: null,
          completed_version: null,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    renderPage();
    openHistoryTab();
    await screen.findByText('原标题');

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));

    const titleInput = screen.getByLabelText('建议标题');
    const descriptionInput = screen.getByLabelText('详细说明');
    expect(titleInput.value).toBe('原标题');
    expect(descriptionInput.value).toBe('原内容');
  });

  test('updates feedback content successfully and refreshes card', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'f2',
          user_id: 'user-1',
          title: '旧标题',
          description: '旧内容说明',
          status: 'pending',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-07-21T10:00:00.000Z',
          completed_at: null,
          completed_version: null,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    versionFeedbackService.updateFeedbackContent.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'f2',
        user_id: 'user-1',
        title: '新标题',
        description: '新内容说明',
        status: 'pending',
        created_at: '2026-07-21T10:00:00.000Z',
        updated_at: '2026-07-22T11:00:00.000Z',
        completed_at: null,
        completed_version: null,
      },
    });

    renderPage();
    openHistoryTab();
    await screen.findByText('旧标题');

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    fireEvent.change(screen.getByLabelText('建议标题'), { target: { value: '新标题' } });
    fireEvent.change(screen.getByLabelText('详细说明'), { target: { value: '新内容说明' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(versionFeedbackService.updateFeedbackContent).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('新标题')).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith('修改意见已更新');
  });

  test('keeps edit inputs when update fails', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'f3',
          user_id: 'user-1',
          title: '标题A',
          description: '内容AAAA',
          status: 'pending',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-07-21T10:00:00.000Z',
          completed_at: null,
          completed_version: null,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    versionFeedbackService.updateFeedbackContent.mockResolvedValueOnce({
      success: false,
      error: 'failed',
    });

    renderPage();
    openHistoryTab();
    await screen.findByText('标题A');

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    fireEvent.change(screen.getByLabelText('建议标题'), { target: { value: '标题B' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    expect(screen.getByLabelText('建议标题').value).toBe('标题B');
  });

  test('shows delete confirmation before deleting', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'f4',
          user_id: 'user-1',
          title: '待删除建议',
          description: '内容',
          status: 'pending',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-07-21T10:00:00.000Z',
          completed_at: null,
          completed_version: null,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    renderPage();
    openHistoryTab();
    await screen.findByText('待删除建议');

    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(await screen.findByText('删除修改意见？')).toBeTruthy();
    expect(screen.getByText('删除后将无法恢复，是否继续？')).toBeTruthy();
  });

  test('cancel delete keeps record in list', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'f5',
          user_id: 'user-1',
          title: '取消删除建议',
          description: '内容',
          status: 'pending',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-07-21T10:00:00.000Z',
          completed_at: null,
          completed_version: null,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    renderPage();
    openHistoryTab();
    await screen.findByText('取消删除建议');

    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.getByText('取消删除建议')).toBeTruthy();
  });

  test('confirm delete removes record and shows empty state for last item', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'f6',
          user_id: 'user-1',
          title: '最后一条建议',
          description: '内容',
          status: 'pending',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-07-21T10:00:00.000Z',
          completed_at: null,
          completed_version: null,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    versionFeedbackService.deleteFeedback.mockResolvedValueOnce({ success: true });

    renderPage();
    openHistoryTab();
    await screen.findByText('最后一条建议');

    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(versionFeedbackService.deleteFeedback).toHaveBeenCalledWith({ feedbackId: 'f6' });
    });

    expect(await screen.findByText('目前没有记录')).toBeTruthy();
  });

  test('does not show edit and delete for non-owner record', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'f7',
          user_id: 'other-user',
          title: '他人建议',
          description: '内容',
          status: 'pending',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-07-21T10:00:00.000Z',
          completed_at: null,
          completed_version: null,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    renderPage();
    openHistoryTab();
    await screen.findByText('他人建议');

    expect(screen.queryByRole('button', { name: '编辑' })).toBeNull();
    expect(screen.queryByRole('button', { name: '删除' })).toBeNull();
  });

  test('shows completed time and version for completed records only', async () => {
    versionFeedbackService.listFeedback.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'f8',
          user_id: 'user-1',
          title: '已完成建议',
          description: '内容',
          status: 'completed',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-07-22T11:00:00.000Z',
          completed_at: '2026-07-22T11:00:00.000Z',
          completed_version: 'v0.2.0',
        },
        {
          id: 'f9',
          user_id: 'user-1',
          title: '未完成建议',
          description: '内容',
          status: 'pending',
          created_at: '2026-07-20T10:00:00.000Z',
          updated_at: '2026-07-20T11:00:00.000Z',
          completed_at: null,
          completed_version: null,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    renderPage();
    openHistoryTab();

    await screen.findByText('已完成建议');
    expect(screen.getByText('已完成')).toBeTruthy();
    expect(screen.getByText(/完成时间：/)).toBeTruthy();
  });
});

describe('VersionFeedbackPage admin completion flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStore.mockReturnValue({
      user: { id: 'admin-1' },
      profile: { role: 'admin', is_admin: true },
    });

    versionFeedbackService.listFeedback.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'a1',
          user_id: 'user-2',
          title: '管理员处理建议',
          description: '内容',
          status: 'pending',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-07-21T10:00:00.000Z',
          completed_at: null,
          completed_version: null,
          submitter: { display_name: '用户A' },
        },
      ],
      hasMore: false,
      nextCursor: null,
    });
  });

  test('requires completion version before marking completed', async () => {
    renderPage();
    openHistoryTab();
    await screen.findByText('管理员处理建议');

    fireEvent.click(screen.getByRole('button', { name: '标记为已完成' }));

    expect(screen.getByText('请选择完成版本')).toBeTruthy();
    expect(versionFeedbackService.completeFeedback).not.toHaveBeenCalled();
  });
});
