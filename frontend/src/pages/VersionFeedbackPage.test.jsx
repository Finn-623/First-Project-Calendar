import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    jest.useRealTimers();
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

  afterEach(() => {
    jest.useRealTimers();
  });

  test('shows separate empty states when query succeeds with empty list', async () => {
    renderPage();
    openHistoryTab();

    expect(await screen.findByText('未完成建议（0）')).toBeTruthy();
    expect(screen.getByText('目前没有未完成建议')).toBeTruthy();
    expect(screen.getByText('已完成建议（0）')).toBeTruthy();
    expect(screen.getByText('目前没有已完成建议')).toBeTruthy();
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
    expect(toast.success).toHaveBeenCalledWith(
      '修改意见已更新',
      expect.objectContaining({ duration: 2000 })
    );
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

    expect(await screen.findByText('目前没有未完成建议')).toBeTruthy();
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

    const completedSection = await screen.findByTestId('completed-feedback-section');
    expect(within(completedSection).getByText('已完成建议')).toBeTruthy();
    expect(within(completedSection).getByText('已完成')).toBeTruthy();
    expect(within(completedSection).getByText(/完成时间：/)).toBeTruthy();
    expect(within(completedSection).getByText('完成版本：v0.2.0')).toBeTruthy();
  });

  test('partitions pending above completed and sorts each section by its business timestamp', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'completed-old',
          user_id: 'user-1',
          title: '较早完成',
          description: '内容',
          status: 'completed',
          created_at: '2026-07-24T10:00:00.000Z',
          updated_at: '2026-07-25T10:00:00.000Z',
          completed_at: '2026-07-25T10:00:00.000Z',
          completed_version: 'v0.1.2',
        },
        {
          id: 'pending-old',
          user_id: 'user-1',
          title: '较早提交',
          description: '内容',
          status: 'pending',
          created_at: '2026-07-20T10:00:00.000Z',
          updated_at: '2026-07-20T10:00:00.000Z',
        },
        {
          id: 'completed-new',
          user_id: 'user-1',
          title: '最近完成',
          description: '内容',
          status: 'completed',
          created_at: '2026-07-19T10:00:00.000Z',
          updated_at: '2026-07-27T10:00:00.000Z',
          completed_at: '2026-07-27T10:00:00.000Z',
          completed_version: 'v0.1.3',
        },
        {
          id: 'pending-new',
          user_id: 'user-1',
          title: '最近提交',
          description: '内容',
          status: 'pending',
          created_at: '2026-07-26T10:00:00.000Z',
          updated_at: '2026-07-26T10:00:00.000Z',
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    renderPage();
    openHistoryTab();

    const pendingSection = await screen.findByTestId('pending-feedback-section');
    const completedSection = screen.getByTestId('completed-feedback-section');
    expect(screen.getByTestId('feedback-history-sections').firstElementChild).toBe(pendingSection);
    expect(within(pendingSection).getByText('未完成建议（2）')).toBeTruthy();
    expect(within(completedSection).getByText('已完成建议（2）')).toBeTruthy();

    const pendingNew = within(pendingSection).getByText('最近提交');
    const pendingOld = within(pendingSection).getByText('较早提交');
    const completedNew = within(completedSection).getByText('最近完成');
    const completedOld = within(completedSection).getByText('较早完成');
    expect(Boolean(pendingNew.compareDocumentPosition(pendingOld) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(completedNew.compareDocumentPosition(completedOld) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(within(pendingSection).queryByText('最近完成')).toBeNull();
    expect(within(completedSection).queryByText('最近提交')).toBeNull();
  });

  test('shows local calendar-day submission ages without negative values', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 28, 0, 5));
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [
        ['same-day', '当天建议', new Date(2026, 6, 28, 23, 50).toISOString()],
        ['one-day', '昨日建议', new Date(2026, 6, 27, 23, 55).toISOString()],
        ['many-days', '多日建议', new Date(2026, 6, 20, 12, 0).toISOString()],
        ['future', '未来时间异常', new Date(2026, 6, 29, 0, 1).toISOString()],
      ].map(([id, title, createdAt]) => ({
        id,
        user_id: 'user-1',
        title,
        description: '内容',
        status: 'pending',
        created_at: createdAt,
        updated_at: createdAt,
      })),
      hasMore: false,
      nextCursor: null,
    });

    renderPage();
    openHistoryTab();

    const pendingSection = await screen.findByTestId('pending-feedback-section');
    expect(within(pendingSection).getAllByText('已提交 0 天')).toHaveLength(2);
    expect(within(pendingSection).getByText('已提交 1 天')).toBeTruthy();
    expect(within(pendingSection).getByText('已提交 8 天')).toBeTruthy();
  });

  test('keeps completed feedback fully read-only for its owner', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [{
        id: 'completed-owner',
        user_id: 'user-1',
        title: '只读建议',
        description: '完成后不可修改',
        status: 'completed',
        created_at: '2026-07-20T10:00:00.000Z',
        updated_at: '2026-07-22T10:00:00.000Z',
        completed_at: '2026-07-22T10:00:00.000Z',
        completed_version: 'v0.1.3',
      }],
      hasMore: false,
      nextCursor: null,
    });

    renderPage();
    openHistoryTab();

    const completedSection = await screen.findByTestId('completed-feedback-section');
    fireEvent.click(within(completedSection).getByText('只读建议'));
    expect(within(completedSection).queryByRole('button', { name: '编辑' })).toBeNull();
    expect(within(completedSection).queryByRole('button', { name: '删除' })).toBeNull();
    expect(within(completedSection).queryByRole('button', { name: /恢复|撤销|保存/ })).toBeNull();
    expect(within(completedSection).queryByLabelText('建议标题')).toBeNull();
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

  test('moves a successfully completed item to the top of the read-only completed section', async () => {
    versionFeedbackService.completeFeedback.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'a1',
        user_id: 'user-2',
        title: '管理员处理建议',
        description: '内容',
        status: 'completed',
        created_at: '2026-07-21T10:00:00.000Z',
        updated_at: '2026-07-28T09:00:00.000Z',
        completed_at: '2026-07-28T09:00:00.000Z',
        completed_version: 'v0.1.3',
      },
    });

    renderPage();
    openHistoryTab();
    await screen.findByText('管理员处理建议');
    fireEvent.change(screen.getByDisplayValue('选择完成版本'), { target: { value: 'v0.1.3' } });
    fireEvent.click(screen.getByRole('button', { name: '标记为已完成' }));

    await waitFor(() => {
      expect(versionFeedbackService.completeFeedback).toHaveBeenCalledTimes(1);
      expect(within(screen.getByTestId('pending-feedback-section')).queryByText('管理员处理建议')).toBeNull();
    });
    const pendingSection = screen.getByTestId('pending-feedback-section');
    const completedSection = screen.getByTestId('completed-feedback-section');
    expect(within(pendingSection).queryByText('管理员处理建议')).toBeNull();
    expect(within(completedSection).getByText('管理员处理建议')).toBeTruthy();
    expect(within(completedSection).getByText('完成版本：v0.1.3')).toBeTruthy();
    expect(within(completedSection).queryByRole('button', { name: /编辑|删除|恢复/ })).toBeNull();
  });

  test('keeps a pending item editable when completion fails', async () => {
    versionFeedbackService.completeFeedback.mockResolvedValueOnce({
      success: false,
      error: '完成失败',
    });

    renderPage();
    openHistoryTab();
    await screen.findByText('管理员处理建议');
    fireEvent.change(screen.getByDisplayValue('选择完成版本'), { target: { value: 'v0.1.3' } });
    fireEvent.click(screen.getByRole('button', { name: '标记为已完成' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('完成失败'));
    expect(within(screen.getByTestId('pending-feedback-section')).getByText('管理员处理建议')).toBeTruthy();
    expect(within(screen.getByTestId('completed-feedback-section')).queryByText('管理员处理建议')).toBeNull();
    expect(screen.getByRole('button', { name: '标记为已完成' })).toBeTruthy();
  });
});
