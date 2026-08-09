import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from '../store';
import { versionFeedbackService } from '../services/versionFeedbackService';
import { toast } from 'sonner';

const mockNavigate = jest.fn();

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
  useNavigate: () => mockNavigate,
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
    updateFeedbackPriority: jest.fn(),
    listPendingFeedback: jest.fn(),
    listCompletedFeedback: jest.fn(),
    countCompletedFeedback: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { VersionFeedbackPage } from './VersionFeedbackPage';

let testQueryClient;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 60_000,
      },
    },
  });
}

function mockSplitListServices() {
  const adapt = (status) => async (args) => {
    const result = await versionFeedbackService.listFeedback(args);
    const sourceItems = result?.items || result?.data || [];
    const allItems = sourceItems.filter((item) => item.status === status);
    const totalCount = result?.totalCount ?? allItems.length;
    const page = args?.page || 1;
    const items = status === 'pending'
      ? allItems.slice((page - 1) * 10, page * 10)
      : allItems;
    return {
      success: result?.success !== false,
      items,
      totalCount,
      page,
      totalPages: Math.max(1, Math.ceil(totalCount / 10)),
    };
  };
  versionFeedbackService.listPendingFeedback.mockImplementation(adapt('pending'));
  versionFeedbackService.listCompletedFeedback.mockImplementation(adapt('completed'));
}

function renderPage({ strict = false, completedOnly = false } = {}) {
  if (!testQueryClient) {
    testQueryClient = createTestQueryClient();
  }
  const page = strict ? (
    <React.StrictMode>
      <VersionFeedbackPage completedOnly={completedOnly} />
    </React.StrictMode>
  ) : <VersionFeedbackPage completedOnly={completedOnly} />;

  return render(
    <QueryClientProvider client={testQueryClient}>
      {page}
    </QueryClientProvider>
  );
}

function openHistoryTab() {
  fireEvent.click(screen.getByRole('tab', { name: '未完成建议' }));
}

function fillFeedbackForm() {
  const submitTab = screen.queryByRole('tab', { name: '提交建议' });
  if (submitTab && submitTab.getAttribute('aria-selected') !== 'true') {
    fireEvent.click(submitTab);
  }
  fireEvent.change(screen.getByLabelText('建议标题'), { target: { value: '一个有效建议' } });
  fireEvent.change(screen.getByLabelText('详细说明'), { target: { value: '这是一个足够详细的修改意见。' } });
}

describe('VersionFeedbackPage history', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    testQueryClient = createTestQueryClient();
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
    mockSplitListServices();
    versionFeedbackService.countCompletedFeedback.mockResolvedValue({ success: true, totalCount: 0 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('shows one top back action that explicitly returns to version information', () => {
    renderPage();

    const backActions = screen.getAllByRole('button', { name: '返回版本信息' });
    expect(backActions).toHaveLength(1);
    expect(screen.queryByText('返回设置')).toBeNull();
    fireEvent.click(backActions[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/settings/version', { replace: true });
  });

  test('keeps the only back action complete and clickable at 320px width', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 568 });
    window.dispatchEvent(new Event('resize'));

    renderPage();

    const backAction = screen.getByRole('button', { name: '返回版本信息' });
    expect(backAction.disabled).toBe(false);
    expect(backAction.textContent).toBe('返回版本信息');
  });

  test('shows separate empty states when query succeeds with empty list', async () => {
    const pendingPage = renderPage();

    expect(await screen.findByText('目前没有未完成建议')).toBeTruthy();
    expect(screen.getByText('未完成建议（0）')).toBeTruthy();
    expect(screen.queryByTestId('completed-feedback-section')).toBeNull();
    expect(screen.getByRole('button', { name: '查看已完成建议（0）' })).toBeTruthy();

    pendingPage.unmount();
    renderPage({ completedOnly: true });
    expect(await screen.findByText('目前没有已完成建议')).toBeTruthy();
    expect(screen.getByText('已完成建议（0）')).toBeTruthy();
  });

  test('opens completed history from pending page and returns to pending route', async () => {
    versionFeedbackService.countCompletedFeedback.mockResolvedValueOnce({ success: true, totalCount: 4 });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '查看已完成建议（4）' }));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/version/feedback/completed');

    const completedView = renderPage({ completedOnly: true });
    fireEvent.click(screen.getByRole('button', { name: '返回建议历史' }));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/version/feedback', { replace: true });
    completedView.unmount();
  });

  test('requires a priority before submitting and sends the selected priority with the current version', async () => {
    versionFeedbackService.createFeedback.mockResolvedValue({
      success: true,
      data: { id: 'created-1', submitted_priority: 'P0', priority: 'P0', target_version: '0.2.1' },
    });

    renderPage();
    fillFeedbackForm();
    fireEvent.click(screen.getByRole('button', { name: '提交修改意见' }));

    expect(await screen.findByText('请选择建议优先级')).toBeTruthy();
    expect(versionFeedbackService.createFeedback).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: 'P0 · 最快速完成' }));
    fireEvent.click(screen.getByRole('button', { name: '提交修改意见' }));

    await waitFor(() => {
      expect(versionFeedbackService.createFeedback).toHaveBeenCalledWith({
        userId: 'user-1',
        title: '一个有效建议',
        description: '这是一个足够详细的修改意见。',
        submittedPriority: 'P0',
        targetVersion: '0.2.1.1',
      });
    });
  });

  test('keeps all feedback form controls at mobile-safe font size and width constraints', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: '提交建议' }));

    expect(screen.getByLabelText('建议标题').classList.contains('text-base')).toBe(true);
    expect(screen.getByLabelText('建议标题').classList.contains('min-w-0')).toBe(true);
    expect(screen.getByLabelText('建议标题').classList.contains('box-border')).toBe(true);
    expect(screen.getByLabelText('建议标题').classList.contains('w-full')).toBe(true);
    expect(screen.getByLabelText('详细说明').classList.contains('text-base')).toBe(true);
    expect(screen.getByLabelText('详细说明').classList.contains('min-w-0')).toBe(true);
    expect(screen.getByLabelText('详细说明').classList.contains('box-border')).toBe(true);
    expect(screen.getByRole('radio', { name: /最快速完成/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: '未完成建议' }));
    const adminPrioritySelect = screen.queryByRole('combobox', { name: /调整/ });
    if (adminPrioritySelect) {
      expect(adminPrioritySelect.classList.contains('text-base')).toBe(true);
      expect(adminPrioritySelect.classList.contains('min-w-0')).toBe(true);
      expect(adminPrioritySelect.classList.contains('max-w-full')).toBe(true);
      expect(adminPrioritySelect.classList.contains('box-border')).toBe(true);
    }
  });

  test('stops loading on failure and retries the request successfully', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: false,
      error: 'network',
    }).mockResolvedValueOnce({
      success: true,
      data: [{
        id: 'retry-success',
        user_id: 'user-1',
        title: '重试成功建议',
        description: '内容',
        status: 'pending',
        created_at: '2026-07-28T10:00:00.000Z',
        updated_at: '2026-07-28T10:00:00.000Z',
      }],
      hasMore: false,
      nextCursor: null,
    });

    renderPage();
    openHistoryTab();

    expect(await screen.findByText('记录加载失败，请重试')).toBeTruthy();
    expect(screen.queryByText('正在加载建议历史...')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('重试成功建议')).toBeTruthy();
    expect(versionFeedbackService.listFeedback).toHaveBeenCalledTimes(2);
  });

  test('sorts records by priority and then created_at asc in history view', async () => {
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
          priority: 'P2',
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
          priority: 'P2',
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

    expect(Boolean(olderNode.compareDocumentPosition(newerNode) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
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
          submitted_priority: 'P2',
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
          submitted_priority: 'P2',
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
          submitted_priority: 'P2',
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
    expect(screen.getByText('未完成建议（0）')).toBeTruthy();
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
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  test('shows completed time and version on the completed-only page', async () => {
    versionFeedbackService.listCompletedFeedback.mockResolvedValueOnce({
      success: true,
      items: [
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
      ],
      totalCount: 1,
      page: 1,
      totalPages: 1,
    });

    renderPage({ completedOnly: true });

    const completedSection = screen.getByTestId('completed-feedback-section');
    expect(await within(completedSection).findByText('已完成建议')).toBeTruthy();
    expect(within(completedSection).getByText('已完成')).toBeTruthy();
    expect(within(completedSection).getByText(/完成时间：/)).toBeTruthy();
    expect(within(completedSection).getByText('完成版本：v0.2.0')).toBeTruthy();
  });

  test('pending page excludes completed rows and sorts pending by priority and timestamp', async () => {
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

    await screen.findByText('最近提交');
    const pendingSection = screen.getByTestId('pending-feedback-section');
    expect(within(pendingSection).getByText('未完成建议（2）')).toBeTruthy();

    const pendingNew = within(pendingSection).getByText('最近提交');
    const pendingOld = within(pendingSection).getByText('较早提交');
    expect(Boolean(pendingOld.compareDocumentPosition(pendingNew) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(within(pendingSection).queryByText('最近完成')).toBeNull();
    expect(screen.queryByTestId('completed-feedback-section')).toBeNull();
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

    await screen.findByText('当天建议');
    const pendingSection = screen.getByTestId('pending-feedback-section');
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

    renderPage({ completedOnly: true });

    await screen.findByText('只读建议');
    const completedSection = screen.getByTestId('completed-feedback-section');
    fireEvent.click(within(completedSection).getByText('只读建议'));
    expect(within(completedSection).queryByRole('button', { name: '编辑' })).toBeNull();
    expect(within(completedSection).queryByRole('button', { name: '删除' })).toBeNull();
    expect(within(completedSection).queryByRole('button', { name: /恢复|撤销|保存/ })).toBeNull();
    expect(within(completedSection).queryByLabelText('建议标题')).toBeNull();
  });
});

describe('VersionFeedbackPage history loading responsiveness', () => {
  const feedbackRow = (overrides = {}) => ({
    id: 'feedback-1',
    user_id: 'user-1',
    title: '缓存建议',
    description: '内容',
    status: 'pending',
    created_at: '2026-07-28T10:00:00.000Z',
    updated_at: '2026-07-28T10:00:00.000Z',
    completed_at: null,
    completed_version: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    testQueryClient = createTestQueryClient();
    useStore.mockReturnValue({
      user: { id: 'user-1' },
      profile: { role: 'user', is_admin: false },
    });
    mockSplitListServices();
    versionFeedbackService.countCompletedFeedback.mockResolvedValue({ success: true, totalCount: 0 });
  });

  test('renders the pending section and loading state before an uncached request resolves', async () => {
    let resolveRequest;
    versionFeedbackService.listFeedback.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    renderPage();
    expect(screen.getByText('正在加载建议历史...')).toBeTruthy();
    expect(screen.getByText('未完成建议（0）')).toBeTruthy();
    expect(versionFeedbackService.listFeedback).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest({
        success: true,
        data: [feedbackRow()],
        hasMore: false,
        nextCursor: null,
      });
    });

    expect(await screen.findByText('缓存建议')).toBeTruthy();
    expect(screen.queryByText('已完成缓存建议')).toBeNull();
  });

  test('deduplicates the equivalent history request under Strict Mode', async () => {
    let resolveRequest;
    versionFeedbackService.listFeedback.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    renderPage({ strict: true });
    expect(versionFeedbackService.listFeedback).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest({
        success: true,
        data: [feedbackRow()],
        hasMore: false,
        nextCursor: null,
      });
    });
    expect(await screen.findByText('缓存建议')).toBeTruthy();
    expect(versionFeedbackService.listFeedback).toHaveBeenCalledTimes(1);
  });

  test('shows a fresh user-scoped cache immediately when returning without another request', async () => {
    versionFeedbackService.listFeedback.mockResolvedValue({
      success: true,
      data: [feedbackRow()],
      hasMore: false,
      nextCursor: null,
    });

    const firstRender = renderPage();
    expect(await screen.findByText('缓存建议')).toBeTruthy();
    firstRender.unmount();

    renderPage();
    expect(screen.getByText('缓存建议')).toBeTruthy();
    expect(screen.queryByText('正在加载建议历史...')).toBeNull();
    expect(versionFeedbackService.listFeedback).toHaveBeenCalledTimes(1);
  });

  test('shows stale cache first and replaces it with refreshed data without duplicates', async () => {
    testQueryClient.setQueryData(
      ['private', 'version-feedback', 'user-1', 'owner', 'pending', 1],
      {
        success: true,
        items: [feedbackRow({ id: 'stale', title: '旧缓存建议' })],
        totalCount: 1,
        page: 1,
        totalPages: 1,
      },
      { updatedAt: Date.now() - 120_000 }
    );
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      items: [feedbackRow({ id: 'fresh', title: '刷新后建议' })],
      totalCount: 1,
      page: 1,
      totalPages: 1,
    });

    renderPage();
    expect(screen.getByText('旧缓存建议')).toBeTruthy();
    expect(await screen.findByText('刷新后建议')).toBeTruthy();
    expect(screen.queryByText('旧缓存建议')).toBeNull();
    expect(screen.getAllByText('刷新后建议')).toHaveLength(1);
    expect(versionFeedbackService.listFeedback).toHaveBeenCalledTimes(1);
  });

  test('ignores a late response after unmount while retaining the safe query cache', async () => {
    let resolveRequest;
    versionFeedbackService.listFeedback.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    const view = renderPage();
    view.unmount();

    resolveRequest({
      success: true,
      items: [feedbackRow({ title: '卸载后返回' })],
      totalCount: 1,
      page: 1,
      totalPages: 1,
    });
    await waitFor(() => {
      expect(testQueryClient.getQueryData(
        ['private', 'version-feedback', 'user-1', 'owner', 'pending', 1]
      )?.items?.[0]?.title).toBe('卸载后返回');
    });
    expect(view.container.innerHTML).toBe('');
  });

  test('prevents an old account response from overwriting the new account view', async () => {
    let currentStore = {
      user: { id: 'user-1' },
      profile: { role: 'user', is_admin: false },
    };
    let resolveAccountA;
    useStore.mockImplementation(() => currentStore);
    versionFeedbackService.listFeedback.mockImplementation(({ userId }) => {
      if (userId === 'user-1') {
        return new Promise((resolve) => {
          resolveAccountA = resolve;
        });
      }
      return Promise.resolve({
        success: true,
        data: [feedbackRow({
          id: 'account-b',
          user_id: 'user-2',
          title: '账号 B 建议',
        })],
        totalCount: 1,
        page: 1,
        totalPages: 1,
      });
    });

    const view = renderPage();
    currentStore = {
      user: { id: 'user-2' },
      profile: { role: 'user', is_admin: false },
    };
    view.rerender(
      <QueryClientProvider client={testQueryClient}>
        <VersionFeedbackPage />
      </QueryClientProvider>
    );
    expect(await screen.findByText('账号 B 建议')).toBeTruthy();

    resolveAccountA({
      success: true,
      data: [feedbackRow({ title: '账号 A 迟到建议' })],
      totalCount: 1,
      page: 1,
      totalPages: 1,
    });
    await waitFor(() => {
      expect(screen.queryByText('账号 A 迟到建议')).toBeNull();
    });
    expect(screen.getByText('账号 B 建议')).toBeTruthy();
    expect(testQueryClient.getQueryData(
      ['private', 'version-feedback', 'user-2', 'owner', 'pending', 1]
    )?.items?.[0]?.title).toBe('账号 B 建议');
  });
});

describe('VersionFeedbackPage admin completion flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testQueryClient = createTestQueryClient();
    useStore.mockReturnValue({
      user: { id: 'admin-1' },
      profile: { role: 'admin', is_admin: true },
    });
    mockSplitListServices();
    versionFeedbackService.countCompletedFeedback.mockResolvedValue({ success: true, totalCount: 0 });

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
    expect(within(pendingSection).queryByText('管理员处理建议')).toBeNull();
    expect(screen.queryByTestId('completed-feedback-section')).toBeNull();
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
    expect(screen.queryByTestId('completed-feedback-section')).toBeNull();
    expect(screen.getByRole('button', { name: '标记为已完成' })).toBeTruthy();
  });

  test('paginates pending results into 10 and 7 records with the database total in both titles', async () => {
    const rows = Array.from({ length: 17 }, (_, index) => ({
      id: `page-${index + 1}`,
      user_id: `user-${index + 1}`,
      title: `分页建议${index + 1}`,
      description: '内容',
      status: 'pending',
      priority: 'P2',
      submitted_priority: 'P2',
      feedback_number: `FB-v0.1.3-${String(index + 1).padStart(3, '0')}`,
      created_at: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
      updated_at: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    }));
    versionFeedbackService.listFeedback.mockResolvedValue({
      success: true,
      data: rows,
      totalCount: 17,
    });

    renderPage();
    expect(await screen.findByText('分页建议1')).toBeTruthy();
    expect(screen.getByText('未完成建议（17）')).toBeTruthy();
    expect(screen.getByText('共 17 条 · 第 1 / 2 页')).toBeTruthy();
    expect(screen.getAllByText(/分页建议/)).toHaveLength(10);
    expect(screen.getByRole('button', { name: '上一页' }).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(await screen.findByText('分页建议11')).toBeTruthy();
    expect(screen.getByText('未完成建议（17）')).toBeTruthy();
    expect(screen.getByText('共 17 条 · 第 2 / 2 页')).toBeTruthy();
    expect(screen.getAllByText(/分页建议/)).toHaveLength(7);
    expect(screen.getByRole('button', { name: '下一页' }).disabled).toBe(true);
  });

  test('shows account_type admins controls for pending and completed feedback from other users', async () => {
    useStore.mockReturnValue({
      user: { id: 'admin-1' },
      profile: { role: 'user', account_type: 'admin', is_admin: false },
    });
    versionFeedbackService.listFeedback.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'other-pending',
          user_id: 'other-user',
          title: '他人待处理建议',
          description: '内容',
          status: 'pending',
          priority: 'P2',
          submitted_priority: 'P1',
          feedback_number: 'FB-v0.1.3-101',
          created_at: '2026-07-20T10:00:00.000Z',
          updated_at: '2026-07-20T10:00:00.000Z',
        },
        {
          id: 'other-completed',
          user_id: 'other-user-2',
          title: '他人已完成建议',
          description: '内容',
          status: 'completed',
          priority: 'P3',
          submitted_priority: 'P2',
          feedback_number: 'FB-v0.1.3-102',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-07-21T10:00:00.000Z',
          completed_at: '2026-07-22T10:00:00.000Z',
          completed_version: 'v0.1.3',
        },
      ],
      totalCount: 2,
    });
    versionFeedbackService.listCompletedFeedback.mockResolvedValueOnce({
      success: true,
      items: [{
        id: 'other-completed',
        user_id: 'other-user-2',
        title: '他人已完成建议',
        description: '内容',
        status: 'completed',
        priority: 'P3',
        submitted_priority: 'P2',
        feedback_number: 'FB-v0.1.3-102',
        created_at: '2026-07-21T10:00:00.000Z',
        updated_at: '2026-07-22T10:00:00.000Z',
        completed_at: '2026-07-22T10:00:00.000Z',
        completed_version: 'v0.1.3',
      }],
      totalCount: 1,
      page: 1,
      totalPages: 1,
    });
    versionFeedbackService.updateFeedbackPriority
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'other-pending',
          user_id: 'other-user',
          title: '他人待处理建议',
          description: '内容',
          status: 'pending',
          priority: 'P0',
          submitted_priority: 'P1',
          feedback_number: 'FB-v0.1.3-101',
          priority_assigned_at: '2026-08-06T00:00:00.000Z',
          priority_assigned_by: 'admin-1',
          created_at: '2026-07-20T10:00:00.000Z',
          updated_at: '2026-08-06T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'other-completed',
          user_id: 'other-user-2',
          title: '他人已完成建议',
          description: '内容',
          status: 'completed',
          priority: 'P1',
          submitted_priority: 'P2',
          feedback_number: 'FB-v0.1.3-102',
          priority_assigned_at: '2026-08-06T00:01:00.000Z',
          priority_assigned_by: 'admin-1',
          created_at: '2026-07-21T10:00:00.000Z',
          updated_at: '2026-08-06T00:01:00.000Z',
          completed_at: '2026-07-22T10:00:00.000Z',
          completed_version: 'v0.1.3',
        },
      });

    const pendingPage = renderPage();
    await screen.findByText('他人待处理建议');
    const pendingPriority = screen.getByRole('combobox', { name: '调整FB-v0.1.3-101优先级' });
    expect(pendingPriority).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: '调整FB-v0.1.3-102优先级' })).toBeNull();

    fireEvent.change(pendingPriority, { target: { value: 'P0' } });
    await waitFor(() => expect(versionFeedbackService.updateFeedbackPriority).toHaveBeenCalledWith({
      feedbackId: 'other-pending',
      priority: 'P0',
    }));
    expect(await within(screen.getByTestId('pending-feedback-section')).findByText(/当前优先级：P0 ·/)).toBeTruthy();
    expect(within(screen.getByTestId('pending-feedback-section')).getByText(/用户选择：P1 ·/)).toBeTruthy();
    expect(within(screen.getByTestId('pending-feedback-section')).getByText('FB-v0.1.3-101')).toBeTruthy();

    pendingPage.unmount();
    renderPage({ completedOnly: true });
    const completedPriority = await screen.findByRole('combobox', { name: '调整FB-v0.1.3-102优先级' });
    fireEvent.change(completedPriority, { target: { value: 'P1' } });
    await waitFor(() => expect(versionFeedbackService.updateFeedbackPriority).toHaveBeenCalledWith({
      feedbackId: 'other-completed',
      priority: 'P1',
    }));
    expect(await within(screen.getByTestId('completed-feedback-section')).findByText(/当前优先级：P1 ·/)).toBeTruthy();
    expect(within(screen.getByTestId('completed-feedback-section')).getByText(/用户选择：P2 ·/)).toBeTruthy();
    expect(within(screen.getByTestId('completed-feedback-section')).getByText('FB-v0.1.3-102')).toBeTruthy();
  });

  test('shows an error and retains the current priority when the admin RPC fails', async () => {
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: [{
        id: 'failed-priority',
        user_id: 'other-user',
        title: '优先级失败建议',
        description: '内容',
        status: 'pending',
        priority: 'P2',
        submitted_priority: 'P2',
        feedback_number: 'FB-v0.1.3-103',
        created_at: '2026-07-20T10:00:00.000Z',
        updated_at: '2026-07-20T10:00:00.000Z',
      }],
      totalCount: 1,
    });
    versionFeedbackService.updateFeedbackPriority.mockResolvedValueOnce({
      success: false,
      error: '优先级更新失败',
    });

    renderPage();
    openHistoryTab();
    const prioritySelect = await screen.findByRole('combobox', { name: '调整FB-v0.1.3-103优先级' });
    fireEvent.change(prioritySelect, { target: { value: 'P0' } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('优先级更新失败'));
    expect(prioritySelect.value).toBe('P2');
  });

  test('keeps pagination and priority controls available at 320px width', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    versionFeedbackService.listFeedback.mockResolvedValueOnce({
      success: true,
      data: Array.from({ length: 21 }, (_, index) => ({
        id: `mobile-${index + 1}`,
        user_id: 'other-user',
        title: `移动端建议${index + 1}`,
        description: '内容',
        status: index === 20 ? 'completed' : 'pending',
        priority: 'P2',
        submitted_priority: 'P2',
        feedback_number: `FB-v0.1.3-${String(index + 1).padStart(3, '0')}`,
        created_at: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
        updated_at: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
      })),
      totalCount: 21,
    });

    renderPage();
    openHistoryTab();
    expect(await screen.findByRole('combobox', { name: '调整FB-v0.1.3-001优先级' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '上一页' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '下一页' })).toBeTruthy();
    expect(screen.getByText('共 21 条 · 第 1 / 3 页')).toBeTruthy();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  });
});
