/**
 * Food Service
 * Handles CRUD operations for food library and entries
 */

import { supabase } from '../lib/supabaseClient';

export const foodService = {
  /**
   * Get all foods for a user
   * @param {string} userId
   * @returns {Promise<{data, error}>}
   */
  async getAllFoods(userId) {
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Search foods by name
   * @param {string} userId
   * @param {string} query
   * @returns {Promise<{data, error}>}
   */
  async searchFoods(userId, query) {
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true });

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Get favorite foods
   * @param {string} userId
   * @returns {Promise<{data, error}>}
   */
  async getFavoriteFoods(userId) {
    try {
      const { data, error } = await supabase
        .from('favorite_foods')
        .select('food_id, foods(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Create a new food
   * @param {string} userId
   * @param {Object} food - {name, default_quantity, unit, calories, protein, fat, carbs, notes}
   * @returns {Promise<{data, error}>}
   */
  async createFood(userId, food) {
    try {
      const { data, error } = await supabase
        .from('foods')
        .insert([
          {
            user_id: userId,
            name: food.name,
            default_quantity: food.default_quantity || 100,
            unit: food.unit || 'g',
            calories: food.calories || 0,
            protein: food.protein || 0,
            fat: food.fat || 0,
            carbs: food.carbs || 0,
            notes: food.notes || null,
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
   * Update a food
   * @param {string} foodId
   * @param {Object} updates
   * @returns {Promise<{data, error}>}
   */
  async updateFood(foodId, updates) {
    try {
      const { data, error } = await supabase
        .from('foods')
        .update(updates)
        .eq('id', foodId)
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Delete a food (food_entries are preserved with snapshots)
   * @param {string} foodId
   * @returns {Promise<{error}>}
   */
  async deleteFood(foodId) {
    try {
      const { error } = await supabase
        .from('foods')
        .delete()
        .eq('id', foodId);

      return { error };
    } catch (err) {
      return { error: err };
    }
  },

  /**
   * Add food to favorites
   * @param {string} userId
   * @param {string} foodId
   * @returns {Promise<{data, error}>}
   */
  async addToFavorites(userId, foodId) {
    try {
      const { data, error } = await supabase
        .from('favorite_foods')
        .insert([{ user_id: userId, food_id: foodId }])
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Remove food from favorites
   * @param {string} userId
   * @param {string} foodId
   * @returns {Promise<{error}>}
   */
  async removeFromFavorites(userId, foodId) {
    try {
      const { error } = await supabase
        .from('favorite_foods')
        .delete()
        .eq('user_id', userId)
        .eq('food_id', foodId);

      return { error };
    } catch (err) {
      return { error: err };
    }
  },
};
