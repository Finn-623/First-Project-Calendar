/**
 * Timeline Service
 * Handles CRUD operations for timeline items (meals, training, events)
 */

import { supabase } from '../lib/supabaseClient';
import { combineLocalDateAndTime } from '../lib/localDateTime';
import { normalizeSnackType } from '../constants/snackTypes';
import { normalizeStrengthBodyParts } from '../constants/trainingBodyParts';

const LIVE_SESSION_KEY = 'live_session';

const normalizeDurationMinutes = (value) => {
  if (value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
};

const isMissingColumnError = (error, columnName) => {
  const message = String(error?.message || error?.details || '');
  return message.includes(`Could not find the '${columnName}' column of 'timeline_items' in the schema cache`)
    || message.includes(`column "${columnName}" does not exist`)
    || message.includes(`column ${columnName} does not exist`)
    || /schema cache/i.test(message)
    || /undefined column/i.test(message);
};

const getLiveSessionDetails = (item, fallback = {}) => ({
  ...(item?.details || {}),
  [LIVE_SESSION_KEY]: {
    ...(item?.details?.[LIVE_SESSION_KEY] || {}),
    ...fallback,
  },
});

const readLiveSessionValue = (item, key) => item?.[key] ?? item?.details?.[LIVE_SESSION_KEY]?.[key] ?? null;

const mapItemTypeToUi = (itemType) => {
  if (itemType === 'breakfast' || itemType === 'lunch' || itemType === 'dinner' || itemType === 'snack') {
    return { type: 'meal', subtype: itemType };
  }

  if (itemType === 'anaerobic_training') {
    return { type: 'anaerobic' };
  }

  if (itemType === 'aerobic_training') {
    return { type: 'aerobic' };
  }

  return { type: 'event' };
};

const normalizeTimelineItem = (item) => ({
  ...mapItemTypeToUi(item?.item_type || item?.type),
  item_type: item?.item_type || item?.type,
  status: item?.status || item?.details?.[LIVE_SESSION_KEY]?.status || 'completed',
  started_at: readLiveSessionValue(item, 'started_at'),
  ended_at: readLiveSessionValue(item, 'ended_at'),
  duration_minutes: readLiveSessionValue(item, 'duration_minutes') == null
    ? null
    : Number(readLiveSessionValue(item, 'duration_minutes')),
  id: item?.id,
  title: item?.item_type === 'aerobic_training'
    ? (String(item?.details?.name || '').trim() || item?.title)
    : item?.title,
  event_date: item?.event_date || item?.eventDate,
  event_time: item?.event_time || item?.time,
  time: item?.event_time || item?.time,
  details: item?.details || {},
  fixed: Boolean(item?.fixed),
  detail: item?.notes || '',
  notes: item?.notes || null,
  bodyParts: item?.details?.bodyParts ? normalizeStrengthBodyParts(item.details.bodyParts) : item?.bodyParts ? normalizeStrengthBodyParts(item.bodyParts) : undefined,
  snackType: item?.item_type === 'snack' ? normalizeSnackType(item?.details?.snackType || item?.snackType) : undefined,
  foods: Array.isArray(item?.foods) ? item.foods : [],
  caloriesBurned: item?.caloriesBurned,
});

export const timelineService = {
  async getRunningTimelineItems(userId) {
    try {
      const query = () => supabase
        .from('timeline_items')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'running')
        .order('started_at', { ascending: false });

      let { data, error } = await query();
      if (error && isMissingColumnError(error, 'status')) {
        const fallback = await supabase
          .from('timeline_items')
          .select('*')
          .eq('user_id', userId)
          .order('event_date', { ascending: false })
          .order('event_time', { ascending: false });

        data = (fallback.data || []).filter((item) => normalizeTimelineItem(item).status === 'running');
        error = fallback.error;
      }

      return { data: (data || []).map(normalizeTimelineItem), error };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Get all timeline items for a specific date
   * @param {string} userId
   * @param {string} dateStr - Format: YYYY-MM-DD
   * @returns {Promise<{data, error}>}
   */
  async getTimelineByDate(userId, dateStr) {
    try {
      const { data, error } = await supabase
        .from('timeline_items')
        .select('*')
        .eq('user_id', userId)
        .eq('event_date', dateStr)
        .order('event_time', { ascending: true })
        .order('sort_order', { ascending: true });

      return { data: (data || []).map(normalizeTimelineItem), error };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Create a new timeline item
   * @param {string} userId
   * @param {Object} item - {event_date, event_time, item_type, title, notes, details}
   * @returns {Promise<{data, error}>}
   */
  async createTimelineItem(userId, item) {
    try {
      const startedAt = item.started_at || combineLocalDateAndTime(item.event_date, item.event_time)?.toISOString() || null;
      const status = item.status || 'completed';
      const durationMinutes = normalizeDurationMinutes(item.duration_minutes);
      const liveSessionDetails = getLiveSessionDetails(item, {
        status,
        started_at: startedAt,
        ended_at: item.ended_at || null,
        duration_minutes: durationMinutes,
      });

      const insertWithNewColumns = () => supabase
        .from('timeline_items')
        .insert([
          {
            user_id: userId,
            event_date: item.event_date,
            event_time: item.event_time,
            item_type: item.item_type,
            title: item.title,
            notes: item.notes || null,
            details: item.details || {},
            status,
            started_at: startedAt,
            ended_at: item.ended_at || null,
            duration_minutes: durationMinutes,
            sort_order: item.sort_order || 0,
          },
        ])
        .select()
        .single();

      const insertWithLegacyColumns = () => supabase
        .from('timeline_items')
        .insert([
          {
            user_id: userId,
            event_date: item.event_date,
            event_time: item.event_time,
            item_type: item.item_type,
            title: item.title,
            notes: item.notes || null,
            details: liveSessionDetails,
            sort_order: item.sort_order || 0,
          },
        ])
        .select()
        .single();

      let { data, error } = await insertWithNewColumns();
      if (error && (isMissingColumnError(error, 'duration_minutes') || isMissingColumnError(error, 'started_at') || isMissingColumnError(error, 'ended_at') || isMissingColumnError(error, 'status'))) {
        ({ data, error } = await insertWithLegacyColumns());
      }

      return { data: data ? normalizeTimelineItem(data) : null, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Update a timeline item
   * @param {string} itemId
   * @param {Object} updates
   * @returns {Promise<{data, error}>}
   */
  async updateTimelineItem(itemId, updates) {
    try {
      const payload = {
        ...updates,
        duration_minutes: Object.prototype.hasOwnProperty.call(updates || {}, 'duration_minutes')
          ? normalizeDurationMinutes(updates.duration_minutes)
          : updates?.duration_minutes,
        updated_at: new Date().toISOString(),
      };

      let { data, error } = await supabase
        .from('timeline_items')
        .update(payload)
        .eq('id', itemId)
        .select()
        .single();

      if (error && (isMissingColumnError(error, 'duration_minutes') || isMissingColumnError(error, 'status') || isMissingColumnError(error, 'started_at') || isMissingColumnError(error, 'ended_at'))) {
        const { data: existing, error: readError } = await supabase
          .from('timeline_items')
          .select('details')
          .eq('id', itemId)
          .single();

        if (readError) {
          return { data: null, error: readError };
        }

        const legacyDetails = {
          ...(existing?.details || {}),
          ...(updates?.details || {}),
          [LIVE_SESSION_KEY]: {
            ...((existing?.details || {})[LIVE_SESSION_KEY] || {}),
            status: updates?.status || ((existing?.details || {})[LIVE_SESSION_KEY] || {}).status || 'completed',
            started_at: updates?.started_at ?? ((existing?.details || {})[LIVE_SESSION_KEY] || {}).started_at ?? null,
            ended_at: updates?.ended_at ?? ((existing?.details || {})[LIVE_SESSION_KEY] || {}).ended_at ?? null,
            duration_minutes: Object.prototype.hasOwnProperty.call(updates || {}, 'duration_minutes')
              ? normalizeDurationMinutes(updates?.duration_minutes)
              : ((existing?.details || {})[LIVE_SESSION_KEY] || {}).duration_minutes ?? null,
          },
        };

        const legacyPayload = {
          details: legacyDetails,
          updated_at: new Date().toISOString(),
        };

        if (Object.prototype.hasOwnProperty.call(updates || {}, 'event_date')) {
          legacyPayload.event_date = updates.event_date;
        }
        if (Object.prototype.hasOwnProperty.call(updates || {}, 'event_time')) {
          legacyPayload.event_time = updates.event_time;
        }
        if (Object.prototype.hasOwnProperty.call(updates || {}, 'item_type')) {
          legacyPayload.item_type = updates.item_type;
        }
        if (Object.prototype.hasOwnProperty.call(updates || {}, 'title')) {
          legacyPayload.title = updates.title;
        }
        if (Object.prototype.hasOwnProperty.call(updates || {}, 'notes')) {
          legacyPayload.notes = updates.notes;
        }

        ({ data, error } = await supabase
          .from('timeline_items')
          .update(legacyPayload)
          .eq('id', itemId)
          .select()
          .single());
      }

      return { data: data ? normalizeTimelineItem(data) : null, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async completeRunningTimelineItem(itemId, userId, updates) {
    try {
      const baseUpdate = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const withNewColumns = () => supabase
        .from('timeline_items')
        .update(baseUpdate)
        .eq('id', itemId)
        .eq('user_id', userId)
        .eq('status', 'running')
        .select()
        .single();

      const withLegacyColumns = async () => {
        const { data: existing, error: readError } = await supabase
          .from('timeline_items')
          .select('details')
          .eq('id', itemId)
          .eq('user_id', userId)
          .single();

        if (readError) {
          return { data: null, error: readError };
        }

        const existingDetails = existing?.details || {};
        const detailsUpdate = {
          ...existingDetails,
          [LIVE_SESSION_KEY]: {
            ...(existingDetails[LIVE_SESSION_KEY] || {}),
            status: updates.status || 'completed',
            started_at: updates.started_at ?? (existingDetails[LIVE_SESSION_KEY] || {}).started_at ?? null,
            ended_at: updates.ended_at ?? (existingDetails[LIVE_SESSION_KEY] || {}).ended_at ?? null,
            duration_minutes: normalizeDurationMinutes(updates.duration_minutes),
          },
        };

        return supabase
          .from('timeline_items')
          .update({
            details: detailsUpdate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId)
          .eq('user_id', userId)
          .select()
          .single();
      };

      let { data, error } = await withNewColumns();
      if (error && (isMissingColumnError(error, 'status') || isMissingColumnError(error, 'duration_minutes') || isMissingColumnError(error, 'started_at') || isMissingColumnError(error, 'ended_at'))) {
        ({ data, error } = await withLegacyColumns());
      }

      return { data: data ? normalizeTimelineItem(data) : null, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Delete a timeline item (cascades to food_entries)
   * @param {string} itemId
   * @returns {Promise<{error}>}
   */
  async deleteTimelineItem(itemId) {
    try {
      const { error } = await supabase
        .from('timeline_items')
        .delete()
        .eq('id', itemId);

      return { error };
    } catch (err) {
      return { error: err };
    }
  },

  /**
   * Delete a timeline item with an ownership guard.
   * @param {string} itemId
   * @param {string} userId
   * @returns {Promise<{error}>}
   */
  async deleteTimelineItemByUser(itemId, userId) {
    try {
      if (!userId) {
        return { error: new Error('缺少用户 ID') };
      }

      const { data, error } = await supabase
        .from('timeline_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();
      if (error) {
        return { error };
      }

      if (!data) {
        return { error: new Error('无权限或记录不存在') };
      }

      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  /**
   * Delete a single food entry with an ownership guard.
   * @param {string} entryId
   * @param {string} userId
   * @returns {Promise<{error}>}
   */
  async deleteFoodEntry(entryId, userId) {
    try {
      if (!userId) {
        return { error: new Error('缺少用户 ID') };
      }

      const { data, error } = await supabase
        .from('food_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();
      if (error) {
        return { error };
      }

      if (!data) {
        return { error: new Error('无权限或记录不存在') };
      }

      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },
};
