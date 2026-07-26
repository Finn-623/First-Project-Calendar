/**
 * History Service
 * Handles queries for historical food and nutrition data
 */

import { supabase } from '../lib/supabaseClient';
import { hasMeaningfulTimelineItems } from '../lib/dayRecordUtils';

export const SYDNEY_TIME_ZONE = 'Australia/Sydney';

export const getSydneyDateString = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: SYDNEY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);

export const addDaysToDateString = (dateStr, days = 1) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SYDNEY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(next);
};

export const getSydneyMidnightDelayMs = (date = new Date()) => {
  const nextDateStr = addDaysToDateString(getSydneyDateString(date), 1);
  let low = date.getTime();
  let high = low + (48 * 60 * 60 * 1000);

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midDateStr = getSydneyDateString(new Date(mid));

    if (midDateStr < nextDateStr) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return Math.max(1000, low - date.getTime());
};

const formatHistoryLabel = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;

  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`;
};

const toMealType = (item) => {
  if (item?.type !== 'meal') {
    if (item?.type === 'anaerobic') return 'anaerobic_training';
    if (item?.type === 'aerobic') return 'aerobic_training';
    return 'other';
  }

  return item?.subtype || 'snack';
};

const normalizeArchivedTimelineItem = (item) => ({
  id: item.id,
  type: item.type,
  subtype: item.subtype,
  title: item.title,
  time: item.time,
  fixed: Boolean(item.fixed),
  foods: Array.isArray(item.foods) ? item.foods : [],
  detail: item.detail,
  caloriesBurned: item.caloriesBurned,
});

const sumTotals = (timeline = []) => timeline.reduce((acc, item) => {
  if (item?.type !== 'meal') {
    return acc;
  }

  const foods = Array.isArray(item.foods) ? item.foods : [];
  foods.forEach((food) => {
    acc.calories += Number(food?.cal || 0);
    acc.protein += Number(food?.p || 0);
    acc.fat += Number(food?.f || 0);
    acc.carbs += Number(food?.c || 0);
  });

  return acc;
}, { calories: 0, protein: 0, fat: 0, carbs: 0 });

export const historyService = {
  /**
   * Check whether a day is already completed for a user.
   * @param {string} userId
   * @param {string} dateStr
   * @returns {Promise<{data, error}>}
   */
  async getDayCompletion(userId, dateStr) {
    try {
      const queryWithCompletion = async () => supabase
        .from('daily_archives')
        .select('id, archive_date, is_completed, completed_at')
        .eq('user_id', userId)
        .eq('archive_date', dateStr)
        .maybeSingle();

      const queryWithoutCompletion = async () => supabase
        .from('daily_archives')
        .select('id, archive_date')
        .eq('user_id', userId)
        .eq('archive_date', dateStr)
        .maybeSingle();

      let { data, error } = await queryWithCompletion();
      if (error && /column .* does not exist|schema cache|undefined column/i.test(String(error.message || error.details || ''))) {
        ({ data, error } = await queryWithoutCompletion());
      }

      if (error) {
        return { data: null, error };
      }

      return {
        data: data
          ? {
              ...data,
              is_completed: data.is_completed === true || Boolean(data.id),
            }
          : null,
        error: null,
      };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Get all dates with food entries (for history list)
   * @param {string} userId
   * @param {number} limit - How many days to fetch
   * @returns {Promise<{data, error}>}
   */
  async getHistoryDates(userId, limit = 30) {
    try {
      const [{ data: archiveDates, error: archiveError }, { data: legacyDates, error: legacyError }] = await Promise.all([
        supabase
          .from('daily_archives')
          .select('archive_date')
          .eq('user_id', userId)
          .order('archive_date', { ascending: false })
          .limit(limit),
        supabase
          .from('timeline_items')
          .select('event_date')
          .eq('user_id', userId)
          .order('event_date', { ascending: false })
          .limit(limit),
      ]);

      const uniqueDates = [
        ...new Set([
          ...(archiveDates || []).map((item) => item.archive_date).filter(Boolean),
          ...(legacyDates || []).map((item) => item.event_date).filter(Boolean),
        ]),
      ].sort((a, b) => new Date(b) - new Date(a)).slice(0, limit);

      return { data: uniqueDates, error: archiveError || legacyError || null };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Get detailed history for a specific date
   * @param {string} userId
   * @param {string} dateStr - Format: YYYY-MM-DD
   * @returns {Promise<{timeline, nutrition, target, error}>}
   */
  async getHistoryDetail(userId, dateStr) {
    try {
      const { data: archiveRow, error: archiveError } = await supabase
        .from('daily_archives')
        .select('*')
        .eq('user_id', userId)
        .eq('archive_date', dateStr)
        .maybeSingle();

      if (archiveError) {
        return { timeline: [], nutrition: null, target: null, error: archiveError };
      }

      if (archiveRow) {
        const timeline = (archiveRow.timeline || []).map(normalizeArchivedTimelineItem);
        const nutrition = archiveRow.totals || sumTotals(timeline);
        const isCompleted = archiveRow.is_completed === true || Boolean(archiveRow.completed_at);
        const isEmptyDay = isCompleted && !hasMeaningfulTimelineItems(timeline);

        const { data: target } = await supabase
          .from('daily_targets')
          .select('*')
          .eq('user_id', userId)
          .eq('target_date', dateStr)
          .single();

        return {
          timeline,
          nutrition,
          target,
          error: null,
          dateLabel: archiveRow.archive_label || formatHistoryLabel(dateStr),
          isCompleted,
          isEmptyDay,
        };
      }

      // Get timeline items
      const { data: timeline, error: timelineError } = await supabase
        .from('timeline_items')
        .select('*')
        .eq('user_id', userId)
        .eq('event_date', dateStr)
        .order('event_time', { ascending: true });

      if (timelineError) {
        return { timeline: [], nutrition: null, target: null, error: timelineError };
      }

      // Get food entries for this date
      const { data: foodEntries, error: foodError } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', userId)
        .in(
          'timeline_item_id',
          timeline?.map((t) => t.id) || []
        );

      if (foodError) {
        return { timeline, nutrition: null, target: null, error: foodError };
      }

      // Calculate nutrition
      const nutrition = foodEntries?.reduce(
        (acc, entry) => ({
          calories: acc.calories + (entry.calories_snapshot || 0),
          protein: acc.protein + (entry.protein_snapshot || 0),
          fat: acc.fat + (entry.fat_snapshot || 0),
          carbs: acc.carbs + (entry.carbs_snapshot || 0),
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );

      // Get target for this date
      const { data: target } = await supabase
        .from('daily_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('target_date', dateStr)
        .single();

      return {
        timeline,
        nutrition,
        target,
        error: null,
        isCompleted: false,
        isEmptyDay: false,
      };
    } catch (err) {
      return {
        timeline: [],
        nutrition: null,
        target: null,
        error: err,
        isCompleted: false,
        isEmptyDay: false,
      };
    }
  },

  /**
   * Save a full day archive snapshot.
   * @param {string} userId
   * @param {string} dateStr
   * @param {Array} timeline
   * @param {Object} totals
   * @returns {Promise<{data, error}>}
   */
  async saveDayArchive(userId, dateStr, timeline = [], totals = null) {
    try {
      const archiveLabel = formatHistoryLabel(dateStr);
      const payload = {
        user_id: userId,
        archive_date: dateStr,
        archive_label: archiveLabel,
        timeline: timeline.map(normalizeArchivedTimelineItem),
        totals: totals || sumTotals(timeline),
        is_completed: true,
        completed_at: new Date().toISOString(),
      };

      const basePayload = {
        user_id: userId,
        archive_date: dateStr,
        archive_label: archiveLabel,
        timeline: timeline.map(normalizeArchivedTimelineItem),
        totals: totals || sumTotals(timeline),
      };

      const persist = async (nextPayload) => supabase
        .from('daily_archives')
        .upsert(nextPayload, { onConflict: 'user_id,archive_date' })
        .select()
        .single();

      let { data, error } = await persist(payload);

      if (error && /column .* does not exist|schema cache|undefined column/i.test(String(error.message || error.details || ''))) {
        ({ data, error } = await persist(basePayload));
      }

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async updateDayArchive(userId, dateStr, timeline = [], totals = null) {
    return this.saveDayArchive(userId, dateStr, timeline, totals);
  },

  /**
   * Delete a day archive snapshot.
   * @param {string} userId
   * @param {string} dateStr
   * @returns {Promise<{error}>}
   */
  async deleteDayArchive(userId, dateStr) {
    try {
      const { error } = await supabase
        .from('daily_archives')
        .delete()
        .eq('user_id', userId)
        .eq('archive_date', dateStr);

      return { error };
    } catch (err) {
      return { error: err };
    }
  },

  /**
   * Get food entries for a timeline item
   * @param {string} timelineItemId
   * @returns {Promise<{data, error}>}
   */
  async getFoodEntriesByTimelineItem(timelineItemId) {
    try {
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('timeline_item_id', timelineItemId)
        .order('created_at', { ascending: true });

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: err };
    }
  },
};
