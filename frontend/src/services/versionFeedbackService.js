import { supabase } from '../lib/supabaseClient';

function normalizeError(error) {
  const originalMessage = String(error?.message || '').trim();
  const message = originalMessage.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return '网络错误，请检查网络后重试';
  }

  if (message.includes('permission') || message.includes('policy') || message.includes('rls')) {
    return '你没有权限执行该操作';
  }

  if (message.includes('jwt') || message.includes('session') || message.includes('token')) {
    return '会话已过期，请重新登录';
  }

  return originalMessage ? `操作失败：${originalMessage}` : '操作失败，请稍后重试';
}

function reportSupabaseError(operation, error, payload) {
  const diagnostic = {
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    payload,
  };
  console.error(`[versionFeedbackService] ${operation} failed`, diagnostic);
  return diagnostic;
}

function normalizeFeedbackRow(row) {
  return {
    id: row.id,
    feedback_number: row.feedback_number,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    submitted_priority: row.submitted_priority,
    target_version: row.target_version,
    created_at: row.created_at,
    completed_at: row.completed_at,
    completed_version: row.completed_version,
    priority: row.priority || 'P2',
    priority_assigned_at: row.priority_assigned_at,
    priority_assigned_by: row.priority_assigned_by,
    updated_at: row.updated_at,
  };
}

async function loadSubmitterMap(ids = []) {
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username')
    .in('id', ids);

  if (error) return {};

  return (data || []).reduce((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});
}

export const versionFeedbackService = {
  async createFeedback({ userId, title, description, submittedPriority, targetVersion }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!userId) {
      return { success: false, error: '缺少用户信息，请重新登录' };
    }

    const payload = {
      user_id: userId,
      title,
      description,
      status: 'pending',
      submitted_priority: submittedPriority,
      target_version: targetVersion,
    };

    try {
      const { data, error } = await supabase
        .from('version_feedback')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        return {
          success: false,
          error: normalizeError(error),
          diagnostic: reportSupabaseError('createFeedback', error, payload),
        };
      }

      return { success: true, data: normalizeFeedbackRow(data) };
    } catch (error) {
      return {
        success: false,
        error: normalizeError(error),
        diagnostic: reportSupabaseError('createFeedback', error, payload),
      };
    }
  },

  async listFeedbackPage({ userId, isAdmin, status, page = 1, pageSize = 10 }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!userId) {
      return { success: false, error: '缺少用户信息，请重新登录' };
    }

    try {
      const isUnpaged = pageSize === null;
      const safePageSize = isUnpaged ? null : Math.max(1, Math.min(Number(pageSize) || 10, 30));
      const safePage = Math.max(1, Number(page) || 1);
      let query = supabase
        .from('version_feedback')
        .select('id, feedback_number, user_id, title, description, status, submitted_priority, target_version, priority, priority_assigned_at, priority_assigned_by, created_at, completed_at, completed_version, updated_at', { count: 'exact' })
        .eq('status', status)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (!isUnpaged) {
        const rangeStart = (safePage - 1) * safePageSize;
        const rangeEnd = rangeStart + safePageSize - 1;
        query = query.range(rangeStart, rangeEnd);
      }

      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }

      const { data, error, count } = await query;
      if (error) {
        return { success: false, error: normalizeError(error) };
      }

      let rows = (data || []).map(normalizeFeedbackRow);

      if (isAdmin) {
        const submitterIds = [...new Set([
          ...rows.map((item) => item.user_id),
          ...rows.map((item) => item.priority_assigned_by),
        ].filter(Boolean))];
        const submitterMap = await loadSubmitterMap(submitterIds);
        rows = rows.map((item) => ({
          ...item,
          submitter: submitterMap[item.user_id] || null,
          priorityAssigner: submitterMap[item.priority_assigned_by] || null,
        }));
      }

      return {
        success: true,
        items: rows,
        totalCount: count || 0,
        page: safePage,
        totalPages: isUnpaged ? 1 : Math.max(1, Math.ceil((count || 0) / safePageSize)),
      };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
  },

  async listPendingFeedback({ userId, isAdmin, page = 1, pageSize = 10 }) {
    return this.listFeedbackPage({ userId, isAdmin, status: 'pending', page, pageSize });
  },

  async listCompletedFeedback({ userId, isAdmin }) {
    return this.listFeedbackPage({ userId, isAdmin, status: 'completed', page: 1, pageSize: null });
  },

  async countCompletedFeedback({ userId, isAdmin }) {
    const result = await this.listFeedbackPage({ userId, isAdmin, status: 'completed', page: 1, pageSize: 1 });
    return result.success
      ? { success: true, totalCount: result.totalCount }
      : result;
  },

  async updateFeedbackContent({ feedbackId, title, description }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!feedbackId) {
      return { success: false, error: '缺少任务 ID' };
    }

    try {
      const { data, error } = await supabase
        .from('version_feedback')
        .update({ title, description })
        .eq('id', feedbackId)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();

      if (error) {
        return { success: false, error: normalizeError(error) };
      }
      if (!data) {
        return { success: false, error: '已完成建议为只读，不能修改' };
      }

      return { success: true, data: normalizeFeedbackRow(data) };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
  },

  async deleteFeedback({ feedbackId }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!feedbackId) {
      return { success: false, error: '缺少任务 ID' };
    }

    try {
      const { data, error } = await supabase
        .from('version_feedback')
        .delete()
        .eq('id', feedbackId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) {
        return { success: false, error: normalizeError(error) };
      }
      if (!data) {
        return { success: false, error: '已完成建议为只读，不能删除' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
  },

  async completeFeedback({ feedbackId, completedVersion }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!feedbackId) {
      return { success: false, error: '缺少任务 ID' };
    }

    if (!completedVersion || !String(completedVersion).trim()) {
      return { success: false, error: '完成版本不能为空' };
    }

    try {
      const { data, error } = await supabase
        .rpc('complete_version_feedback', {
          feedback_id: feedbackId,
          version_number: String(completedVersion).trim(),
        });

      if (error) {
        return { success: false, error: normalizeError(error) };
      }

      return { success: true, data: normalizeFeedbackRow(data) };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
  },

  async reopenFeedback({ feedbackId }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!feedbackId) {
      return { success: false, error: '缺少任务 ID' };
    }

    try {
      const { data, error } = await supabase
        .rpc('reopen_version_feedback', {
          feedback_id: feedbackId,
        });

      if (error) {
        return { success: false, error: normalizeError(error) };
      }

      return { success: true, data: normalizeFeedbackRow(data) };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
  },

  async updateFeedbackPriority({ feedbackId, priority }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!feedbackId) {
      return { success: false, error: '缺少任务 ID' };
    }

    if (!['P0', 'P1', 'P2', 'P3'].includes(priority)) {
      return { success: false, error: '优先级无效' };
    }

    try {
      const { data, error } = await supabase.rpc('set_version_feedback_priority', {
        feedback_id: feedbackId,
        feedback_priority: priority,
      });

      if (error) {
        return { success: false, error: normalizeError(error) };
      }

      return { success: true, data: normalizeFeedbackRow(data) };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
  },
};
