/**
 * Timeline Service
 * Handles CRUD operations for timeline items (meals, training, events)
 */

import { supabase } from '../lib/supabaseClient';
import { combineLocalDateAndTime } from '../lib/localDateTime';
import { normalizeSnackType } from '../constants/snackTypes';
import { normalizeStrengthBodyParts } from '../constants/trainingBodyParts';

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
  status: item?.status || 'completed',
  started_at: item?.started_at || null,
  ended_at: item?.ended_at || null,
  duration_minutes: item?.duration_minutes == null ? null : Number(item.duration_minutes),
  id: item?.id,
  title: item?.title,
  time: item?.event_time || item?.time,
  fixed: Boolean(item?.fixed),
  detail: item?.notes || item?.detail || item?.details?.summary || item?.details?.name || '',
  notes: item?.notes || null,
  bodyParts: item?.details?.bodyParts ? normalizeStrengthBodyParts(item.details.bodyParts) : item?.bodyParts ? normalizeStrengthBodyParts(item.bodyParts) : undefined,
  snackType: item?.item_type === 'snack' ? normalizeSnackType(item?.details?.snackType || item?.snackType) : undefined,
  foods: Array.isArray(item?.foods) ? item.foods : [],
  caloriesBurned: item?.caloriesBurned,
});

export const timelineService = {
  async getRunningTimelineItems(userId) {
    try {
      const { data, error } = await supabase
        .from('timeline_items')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'running')
        .order('started_at', { ascending: false });

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
      const { data, error } = await supabase
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
            status: item.status || 'completed',
            started_at: item.started_at || combineLocalDateAndTime(item.event_date, item.event_time)?.toISOString() || null,
            ended_at: item.ended_at || null,
            duration_minutes: item.duration_minutes == null ? null : Number(item.duration_minutes),
            sort_order: item.sort_order || 0,
          },
        ])
        .select()
        .single();

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
      const { data, error } = await supabase
        .from('timeline_items')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select()
        .single();

      return { data: data ? normalizeTimelineItem(data) : null, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async completeRunningTimelineItem(itemId, userId, updates) {
    try {
      const { data, error } = await supabase
        .from('timeline_items')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('user_id', userId)
        .eq('status', 'running')
        .select()
        .single();

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
};
