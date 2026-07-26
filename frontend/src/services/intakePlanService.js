import { supabase } from '../lib/supabaseClient';

function normalizeError(error) {
  const message = String(error?.message || '').toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return '网络错误，请检查网络后重试';
  }

  if (message.includes('jwt') || message.includes('session') || message.includes('token')) {
    return '会话已过期，请重新登录';
  }

  if (message.includes('permission') || message.includes('policy') || message.includes('rls')) {
    return '你没有权限执行该操作';
  }

  return '操作失败，请稍后重试';
}

function normalizeHistoryRow(row) {
  return {
    id: row.id,
    calories: Number(row.calories_kcal),
    protein: Number(row.protein_g),
    fat: Number(row.fat_g),
    carbs: Number(row.carbs_g),
    calculatedField: row.calculated_field,
    createdAt: row.created_at,
  };
}

export const intakePlanService = {
  async listHistory({ userId, limit = 5, cursor = null }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!userId) {
      return { success: false, error: '缺少用户信息，请重新登录' };
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 20));

    try {
      let query = supabase
        .from('intake_plan_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(safeLimit + 1);

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error } = await query;
      if (error) {
        return { success: false, error: normalizeError(error) };
      }

      const rows = data || [];
      const hasMore = rows.length > safeLimit;
      const sliced = hasMore ? rows.slice(0, safeLimit) : rows;
      const normalized = sliced.map(normalizeHistoryRow);

      return {
        success: true,
        data: normalized,
        hasMore,
        nextCursor: hasMore ? normalized[normalized.length - 1]?.createdAt : null,
      };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
  },

  async deleteHistory({ historyId }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!historyId) {
      return { success: false, error: '缺少历史记录ID' };
    }

    try {
      const { error } = await supabase
        .from('intake_plan_history')
        .delete()
        .eq('id', historyId);

      if (error) {
        return { success: false, error: normalizeError(error) };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: normalizeError(error) };
    }
  },
};
