/**
 * Daily Targets Service
 * Handles CRUD operations for daily nutrition targets
 */

import { supabase } from '../lib/supabaseClient';

export const targetService = {
  /**
   * Get target for a specific date
   * @param {string} userId
   * @param {string} dateStr - Format: YYYY-MM-DD
   * @returns {Promise<{data, error}>}
   */
  async getTargetByDate(userId, dateStr) {
    try {
      const { data, error } = await supabase
        .from('daily_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('target_date', dateStr)
        .single();

      if (error?.code === 'PGRST116') {
        // No rows found - return null instead of error
        return { data: null, error: null };
      }

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Upsert (create or update) target for a date
   * @param {string} userId
   * @param {string} dateStr - Format: YYYY-MM-DD
   * @param {Object} targets - {calories_target, protein_target, fat_target, carbs_target}
   * @returns {Promise<{data, error}>}
   */
  async upsertTarget(userId, dateStr, targets) {
    try {
      const { data, error } = await supabase
        .from('daily_targets')
        .upsert(
          {
            user_id: userId,
            target_date: dateStr,
            calories_target: targets.calories_target || 2100,
            protein_target: targets.protein_target || 140,
            fat_target: targets.fat_target || 65,
            carbs_target: targets.carbs_target || 240,
          },
          { onConflict: 'user_id,target_date' }
        )
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Get most recent target (for fallback)
   * @param {string} userId
   * @returns {Promise<{data, error}>}
   */
  async getLatestTarget(userId) {
    try {
      const { data, error } = await supabase
        .from('daily_targets')
        .select('*')
        .eq('user_id', userId)
        .order('target_date', { ascending: false })
        .limit(1)
        .single();

      if (error?.code === 'PGRST116') {
        return { data: null, error: null };
      }

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },
};
