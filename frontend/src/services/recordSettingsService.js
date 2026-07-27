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

export const recordSettingsService = {
  /**
   * Get user's record settings
   */
  async getSettings({ userId }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!userId) {
      return { success: false, error: '缺少用户信息，请重新登录' };
    }

    try {
      const { data, error } = await supabase
        .from('user_record_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // No record exists yet, return default values
        if (error.code === 'PGRST116') {
          return {
            success: true,
            data: {
              auto_archive_enabled: false,
              auto_archive_time: '00:00:00',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            },
          };
        }
        return { success: false, error: normalizeError(error) };
      }

      return {
        success: true,
        data: {
          id: data.id,
          auto_archive_enabled: data.auto_archive_enabled,
          auto_archive_time: data.auto_archive_time,
          timezone: data.timezone,
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
      };
    } catch (err) {
      return { success: false, error: normalizeError(err) };
    }
  },

  /**
   * Upsert user's record settings
   */
  async upsertSettings({ userId, autoArchiveEnabled, autoArchiveTime, timezone }) {
    if (!supabase) {
      return { success: false, error: 'Supabase 尚未配置' };
    }

    if (!userId) {
      return { success: false, error: '缺少用户信息，请重新登录' };
    }

    // Validate timezone
    if (!timezone || typeof timezone !== 'string') {
      return { success: false, error: '时区格式不正确' };
    }

    // Validate time format (HH:mm:ss or HH:mm)
    let timeFormatted = autoArchiveTime;
    if (typeof autoArchiveTime === 'string') {
      if (autoArchiveTime.length === 5) {
        // HH:mm format, convert to HH:mm:ss
        timeFormatted = `${autoArchiveTime}:00`;
      }
      // Validate format
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(timeFormatted)) {
        return { success: false, error: '时间格式不正确，请使用 HH:mm 格式' };
      }
    }

    try {
      const { data, error } = await supabase
        .from('user_record_settings')
        .upsert({
          user_id: userId,
          auto_archive_enabled: Boolean(autoArchiveEnabled),
          auto_archive_time: timeFormatted,
          timezone,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        return { success: false, error: normalizeError(error) };
      }

      return {
        success: true,
        data: {
          id: data.id,
          auto_archive_enabled: data.auto_archive_enabled,
          auto_archive_time: data.auto_archive_time,
          timezone: data.timezone,
          updated_at: data.updated_at,
        },
      };
    } catch (err) {
      return { success: false, error: normalizeError(err) };
    }
  },

  /**
   * Calculate next archive time based on user's settings and timezone
   */
  calculateNextArchiveTime({ archiveTime, timezone }) {
    try {
      const now = new Date();
      
      // Get current time in user's timezone
      const userTimeString = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);

      const [datePart, timePart] = userTimeString.split(' ');
      const [day, month, year] = datePart.split('/');
      const userDate = new Date(`${year}-${month}-${day}T${timePart}`);

      // Parse archive time (format: HH:mm:ss or HH:mm)
      let archiveHours = 0;
      let archiveMinutes = 0;
      if (typeof archiveTime === 'string') {
        const parts = archiveTime.split(':');
        archiveHours = parseInt(parts[0], 10);
        archiveMinutes = parseInt(parts[1], 10);
      }

      // Create archive time for today in user's timezone
      const archiveTodayString = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);

      const [archiveDay, archiveMonth, archiveYear] = archiveTodayString.split('/');
      const todayArchiveTime = new Date(`${archiveYear}-${archiveMonth}-${archiveDay}T${String(archiveHours).padStart(2, '0')}:${String(archiveMinutes).padStart(2, '0')}:00`);

      // If archive time has passed today, next archive is tomorrow
      if (now >= todayArchiveTime) {
        const tomorrow = new Date(todayArchiveTime);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }

      return todayArchiveTime;
    } catch (err) {
      return null;
    }
  },
};
