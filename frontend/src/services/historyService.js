/**
 * History Service
 * Handles queries for historical food and nutrition data
 */

import { supabase } from '../lib/supabaseClient';
import { hasMeaningfulTimelineItems } from '../lib/dayRecordUtils';
import { normalizeSnackType } from '../constants/snackTypes';
import { normalizeStrengthBodyParts } from '../constants/trainingBodyParts';
import {
  SYDNEY_TIME_ZONE,
  addDaysToDateString,
  formatBusinessDateLabel,
  getSydneyDateString,
} from '../lib/businessDate';

export { SYDNEY_TIME_ZONE, addDaysToDateString, getSydneyDateString };

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

const formatHistoryLabel = (dateStr) => formatBusinessDateLabel(dateStr);

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
  snackType: item?.subtype === 'snack' ? normalizeSnackType(item?.snackType) : undefined,
  bodyParts: item?.type === 'anaerobic' ? normalizeStrengthBodyParts(item?.bodyParts) : undefined,
  title: item.title,
  time: item.time,
  fixed: Boolean(item.fixed),
  foods: Array.isArray(item.foods)
    ? item.foods.map((food, index) => ({
        ...food,
        entryId: food?.entryId || food?.id || food?.foodEntryId || `archived-food-${item.id || 'item'}-${index}`,
      }))
    : [],
  detail: item.detail,
  notes: item.notes || null,
  caloriesBurned: item.caloriesBurned,
  status: item.status || 'completed',
  started_at: item.started_at || null,
  ended_at: item.ended_at || null,
  duration_minutes: item.duration_minutes == null ? null : Number(item.duration_minutes),
});

const normalizeDbTimelineItem = (item) => {
  const itemType = item?.item_type;
  const mapped = itemType === 'breakfast' || itemType === 'lunch' || itemType === 'dinner' || itemType === 'snack'
    ? { type: 'meal', subtype: itemType }
    : itemType === 'anaerobic_training'
      ? { type: 'anaerobic' }
      : itemType === 'aerobic_training'
        ? { type: 'aerobic' }
        : { type: 'event' };

  return {
    id: item.id,
    ...mapped,
    title: itemType === 'aerobic_training'
      ? (String(item?.details?.name || '').trim() || item.title)
      : item.title,
    time: item.event_time || item.time,
    fixed: Boolean(item.fixed),
    foods: Array.isArray(item.foods) ? item.foods : [],
    detail: item.notes || '',
    notes: item.notes || null,
    snackType: itemType === 'snack' ? normalizeSnackType(item?.details?.snackType || item?.snackType) : undefined,
    bodyParts: itemType === 'anaerobic_training' ? normalizeStrengthBodyParts(item?.details?.bodyParts || item?.bodyParts) : undefined,
    status: item.status || 'completed',
    started_at: item.started_at || null,
    ended_at: item.ended_at || null,
    duration_minutes: item.duration_minutes == null ? null : Number(item.duration_minutes),
    caloriesBurned: item.caloriesBurned,
  };
};

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

export const normalizeArchiveTotals = (totals, timeline = []) => {
  const source = totals || sumTotals(timeline);
  return {
    cal: Number(source?.cal ?? source?.calories ?? 0),
    p: Number(source?.p ?? source?.protein ?? 0),
    f: Number(source?.f ?? source?.fat ?? 0),
    c: Number(source?.c ?? source?.carbs ?? 0),
  };
};

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
      ].sort((a, b) => String(b).localeCompare(String(a))).slice(0, limit);

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
        const nutrition = normalizeArchiveTotals(archiveRow.totals, timeline);
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
      const normalizedTimeline = (timeline || []).map(normalizeDbTimelineItem);
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
        timeline: normalizedTimeline,
        nutrition: normalizeArchiveTotals(nutrition, normalizedTimeline),
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

  async autoArchivePreviousDay(dateStr) {
    try {
      const { data, error } = await supabase.rpc('auto_archive_my_previous_day', {
        target_date: dateStr,
      });
      return { data: Array.isArray(data) ? data[0] : data, error };
    } catch (error) {
      return { data: null, error };
    }
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
   * Delete all records for a specific date (timeline + archive) atomically.
   * Uses RPC guarded by auth.uid() on the database side.
   * @param {string} dateStr - Format: YYYY-MM-DD
   * @returns {Promise<{data, error}>}
   */
  async deleteFullDayRecords(dateStr) {
    try {
      const { data, error } = await supabase
        .rpc('delete_day_records', { target_date: dateStr });

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Delete multiple history days atomically.
   * Uses RPC guarded by auth.uid() on the database side.
   * @param {string[]} dateStrs - Format: YYYY-MM-DD[]
   * @returns {Promise<{data, error}>}
   */
  async deleteHistoryDays(dateStrs = []) {
    try {
      const targetDates = Array.from(new Set((dateStrs || []).filter(Boolean)));
      if (targetDates.length === 0) {
        return {
          data: {
            deleted_timeline_items: 0,
            deleted_daily_archives: 0,
            deleted_days: 0,
          },
          error: null,
        };
      }

      const { data, error } = await supabase
        .rpc('delete_history_days', { target_dates: targetDates });

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
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
