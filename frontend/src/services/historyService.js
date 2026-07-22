/**
 * History Service
 * Handles queries for historical food and nutrition data
 */

import { supabase } from '../lib/supabaseClient';

export const historyService = {
  /**
   * Get all dates with food entries (for history list)
   * @param {string} userId
   * @param {number} limit - How many days to fetch
   * @returns {Promise<{data, error}>}
   */
  async getHistoryDates(userId, limit = 30) {
    try {
      const { data, error } = await supabase
        .from('timeline_items')
        .select('event_date')
        .eq('user_id', userId)
        .order('event_date', { ascending: false })
        .limit(limit);

      // Extract unique dates
      const uniqueDates = data
        ? [
            ...new Set(
              data
                .filter((item) => item.event_date)
                .map((item) => item.event_date)
            ),
          ].sort((a, b) => new Date(b) - new Date(a))
        : [];

      return { data: uniqueDates, error };
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

      return { timeline, nutrition, target, error: null };
    } catch (err) {
      return { timeline: [], nutrition: null, target: null, error: err };
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
