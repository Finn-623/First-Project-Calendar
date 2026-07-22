/**
 * Timeline Service
 * Handles CRUD operations for timeline items (meals, training, events)
 */

import { supabase } from '../lib/supabaseClient';

export const timelineService = {
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

      return { data: data || [], error };
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
            sort_order: item.sort_order || 0,
          },
        ])
        .select()
        .single();

      return { data, error };
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

      return { data, error };
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
