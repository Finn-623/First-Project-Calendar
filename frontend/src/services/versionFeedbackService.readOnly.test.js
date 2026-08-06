import { supabase } from '../lib/supabaseClient';
import { versionFeedbackService } from './versionFeedbackService';

jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

function createMutationQuery(result) {
  const query = {
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    eq: jest.fn(() => query),
    select: jest.fn(() => query),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return query;
}

function createListQuery(result) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    range: jest.fn(() => query),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return query;
}

describe('versionFeedbackService completed feedback guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requires pending status and rejects an update when no pending row matches', async () => {
    const query = createMutationQuery({ data: null, error: null });
    supabase.from.mockReturnValue(query);

    const result = await versionFeedbackService.updateFeedbackContent({
      feedbackId: 'completed-1',
      title: '不能修改',
      description: '不能修改已完成建议',
    });

    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'completed-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'status', 'pending');
    expect(result).toEqual({
      success: false,
      error: '已完成建议为只读，不能修改',
    });
  });

  test('requires pending status and rejects a delete when no pending row matches', async () => {
    const query = createMutationQuery({ data: null, error: null });
    supabase.from.mockReturnValue(query);

    const result = await versionFeedbackService.deleteFeedback({
      feedbackId: 'completed-2',
    });

    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'completed-2');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'status', 'pending');
    expect(result).toEqual({
      success: false,
      error: '已完成建议为只读，不能删除',
    });
  });

  test('preserves pending feedback edit and delete behavior', async () => {
    const updateQuery = createMutationQuery({
      data: {
        id: 'pending-1',
        user_id: 'user-1',
        title: '新标题',
        description: '新内容',
        status: 'pending',
        created_at: '2026-07-27T00:00:00.000Z',
        updated_at: '2026-07-28T00:00:00.000Z',
      },
      error: null,
    });
    const deleteQuery = createMutationQuery({
      data: { id: 'pending-1' },
      error: null,
    });
    supabase.from
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(deleteQuery);

    const updateResult = await versionFeedbackService.updateFeedbackContent({
      feedbackId: 'pending-1',
      title: '新标题',
      description: '新内容',
    });
    const deleteResult = await versionFeedbackService.deleteFeedback({
      feedbackId: 'pending-1',
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.data.status).toBe('pending');
    expect(deleteResult).toEqual({ success: true });
  });

  test('updates priority through the controlled RPC and preserves audit fields', async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        id: 'pending-1',
        feedback_number: 'FB-v0.1.3-001',
        user_id: 'user-1',
        title: '建议',
        description: '内容',
        status: 'pending',
        priority: 'P0',
        priority_assigned_at: '2026-08-05T00:00:00.000Z',
        priority_assigned_by: 'admin-1',
      },
      error: null,
    });

    const result = await versionFeedbackService.updateFeedbackPriority({
      feedbackId: 'pending-1',
      priority: 'P0',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('set_version_feedback_priority', {
      feedback_id: 'pending-1',
      feedback_priority: 'P0',
    });
    expect(result.success).toBe(true);
    expect(result.data.feedback_number).toBe('FB-v0.1.3-001');
    expect(result.data.priority_assigned_by).toBe('admin-1');
  });
});

describe('versionFeedbackService history query contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('lists pending feedback with exact count, stable ordering, and page range', async () => {
    const query = createListQuery({ data: [], error: null, count: 17 });
    supabase.from.mockReturnValue(query);

    const result = await versionFeedbackService.listPendingFeedback({
      userId: 'admin-1',
      isAdmin: true,
      page: 2,
      pageSize: 10,
    });

    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('feedback_number'), { count: 'exact' });
    expect(query.eq).toHaveBeenCalledWith('status', 'pending');
    expect(query.order).toHaveBeenNthCalledWith(1, 'priority', { ascending: true });
    expect(query.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: true });
    expect(query.order).toHaveBeenNthCalledWith(3, 'id', { ascending: true });
    expect(query.range).toHaveBeenCalledWith(10, 19);
    expect(result).toEqual({ success: true, items: [], totalCount: 17, page: 2, totalPages: 2 });
  });

  test('lists completed feedback independently without pending range pagination', async () => {
    const query = createListQuery({ data: [], error: null, count: 4 });
    supabase.from.mockReturnValue(query);

    const result = await versionFeedbackService.listCompletedFeedback({
      userId: 'admin-1',
      isAdmin: true,
    });

    expect(query.eq).toHaveBeenCalledWith('status', 'completed');
    expect(query.range).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, items: [], totalCount: 4, page: 1, totalPages: 1 });
  });
});
