import { supabase } from '../lib/supabaseClient';

function normalizeError(error) {
  const message = String(error?.message || '').toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return '网络错误，请检查网络后重试';
  }

  if (message.includes('permission') || message.includes('policy') || message.includes('rls')) {
    return '你没有权限执行该操作';
  }

  if (message.includes('jwt') || message.includes('session') || message.includes('token')) {
    return '会话已过期，请重新登录';
  }

  return '操作失败，请稍后重试';
}

function normalizeFeedbackRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    created_at: row.created_at,
    completed_at: row.completed_at,
    completed_version: row.completed_version,
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
  async createFeedback({ userId, title, description }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!userId) {
      return { success: false, error: '缺少用户信息，请重新登录' };
    }

    try {
      const { data, error } = await supabase
        .from('version_feedback')
        .insert({
          user_id: userId,
          title,
          description,
        })
        .select('*')
        .single();

      if (error) {
        return { success: false, error: normalizeError(error) };
      }

      return { success: true, data: normalizeFeedbackRow(data) };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
  },

  async listFeedback({ userId, isAdmin, limit = 10, cursor = null }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!userId) {
      return { success: false, error: '缺少用户信息，请重新登录' };
    }

    try {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 30));

      let query = supabase
        .from('version_feedback')
        .select('id, user_id, title, description, status, created_at, completed_at, completed_version, updated_at')
        .order('created_at', { ascending: false })
        .limit(safeLimit + 1);

      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error } = await query;
      if (error) {
        return { success: false, error: normalizeError(error) };
      }

      const rawRows = data || [];
      const hasMore = rawRows.length > safeLimit;
      const selectedRows = hasMore ? rawRows.slice(0, safeLimit) : rawRows;
      const rows = selectedRows.map(normalizeFeedbackRow);
      const nextCursor = hasMore ? rows[rows.length - 1]?.created_at : null;

      if (!isAdmin) {
        return {
          success: true,
          data: rows,
          hasMore,
          nextCursor,
        };
      }

      const submitterIds = [...new Set(rows.map((item) => item.user_id).filter(Boolean))];
      const submitterMap = await loadSubmitterMap(submitterIds);
      const enriched = rows.map((item) => ({
        ...item,
        submitter: submitterMap[item.user_id] || null,
      }));

      return {
        success: true,
        data: enriched,
        hasMore,
        nextCursor,
      };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
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
};
