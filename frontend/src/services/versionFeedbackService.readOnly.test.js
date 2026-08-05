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
        feedback_number: 'FB-2026-0001',
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
    expect(result.data.feedback_number).toBe('FB-2026-0001');
    expect(result.data.priority_assigned_by).toBe('admin-1');
  });
});
