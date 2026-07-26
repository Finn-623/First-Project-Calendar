import { supabase } from '../lib/supabaseClient';
import { validateFeedbackStatus } from '../lib/versionFeedbackValidation';

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

  async listFeedback({ userId, isAdmin }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!userId) {
      return { success: false, error: '缺少用户信息，请重新登录' };
    }

    try {
      let query = supabase
        .from('version_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) {
        return { success: false, error: normalizeError(error) };
      }

      const rows = (data || []).map(normalizeFeedbackRow);
      if (!isAdmin) {
        return { success: true, data: rows };
      }

      const submitterIds = [...new Set(rows.map((item) => item.user_id).filter(Boolean))];
      const submitterMap = await loadSubmitterMap(submitterIds);
      const enriched = rows.map((item) => ({
        ...item,
        submitter: submitterMap[item.user_id] || null,
      }));

      return { success: true, data: enriched };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
  },

  async updateFeedbackStatus({ feedbackId, status }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!feedbackId) {
      return { success: false, error: '缺少任务 ID' };
    }

    if (!validateFeedbackStatus(status)) {
      return { success: false, error: '不支持的任务状态' };
    }

    try {
      const payload = { status };

      const { data, error } = await supabase
        .from('version_feedback')
        .update(payload)
        .eq('id', feedbackId)
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
};
