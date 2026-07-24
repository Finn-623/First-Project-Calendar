/**
 * Food Service
 * Handles CRUD operations for food library and entries
 */

import { supabase } from '../lib/supabaseClient';

const normalizeFood = (food) => {
  if (!food) return null;

  return {
    ...food,
    // Keep backward-compatible fields used by current UI.
    cal100: Number(food.calories || 0),
    p100: Number(food.protein || 0),
    f100: Number(food.fat || 0),
    c100: Number(food.carbs || 0),
    category: food.category || (food.visibility === 'public' ? '公共' : '我的'),
    isPublic: food.visibility === 'public',
    isActive: food.is_active !== false,
    brand: food.brand || '',
    imageUrl: food.image_url || '',
  };
};

const buildPrivateFoodPayload = (userId, food) => ({
  user_id: userId,
  visibility: 'private',
  is_active: true,
  name: food.name,
  brand: food.brand || null,
  image_url: food.image_url || null,
  default_quantity: food.default_quantity || 100,
  unit: food.unit || 'g',
  calories: food.calories || 0,
  protein: food.protein || 0,
  fat: food.fat || 0,
  carbs: food.carbs || 0,
  notes: food.notes || null,
});

const buildPublicFoodPayload = (userId, food) => ({
  visibility: 'public',
  user_id: null,
  is_active: food.is_active !== false,
  created_by: userId,
  updated_by: userId,
  name: food.name,
  brand: food.brand || null,
  image_url: food.image_url || null,
  default_quantity: food.default_quantity || 100,
  unit: food.unit || 'g',
  calories: food.calories || 0,
  protein: food.protein || 0,
  fat: food.fat || 0,
  carbs: food.carbs || 0,
  notes: food.notes || null,
});

export const foodService = {
  /**
   * Get all foods for a user
   * @param {string} userId
   * @returns {Promise<{data, error}>}
   */
  async getAllFoods(userId) {
    if (!supabase) {
      return { data: [], error: new Error('Supabase 尚未配置') };
    }

    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .order('name', { ascending: true });

      const visibleFoods = (data || []).filter((food) => {
        if (!food) return false;
        if (food.visibility === 'public') return true;
        return Boolean(userId) && food.user_id === userId;
      });

      const normalized = visibleFoods.map(normalizeFood).filter(Boolean);
      return { data: normalized, error };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Get public foods for management and browsing.
   * Admins receive inactive public foods too via RLS.
   */
  async loadPublicFoods(_userId) {
    if (!supabase) {
      return { data: [], error: new Error('Supabase 尚未配置') };
    }

    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('visibility', 'public')
        .order('name', { ascending: true });

      const normalized = (data || []).map(normalizeFood).filter(Boolean);
      return { data: normalized, error };
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
  async searchFoods(_userId, query) {
    if (!supabase) {
      return { data: [], error: new Error('Supabase 尚未配置') };
    }

    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true });

      const normalized = (data || []).map(normalizeFood).filter(Boolean);
      return { data: normalized, error };
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
        .insert([buildPrivateFoodPayload(userId, food)])
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Create a new public food (admin only via RLS)
   */
  async createPublicFood(userId, food) {
    try {
      const { data, error } = await supabase
        .from('foods')
        .insert([buildPublicFoodPayload(userId, food)])
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
   * Update an existing public food (admin only via RLS)
   */
  async updatePublicFood(userId, foodId, updates) {
    try {
      const { data, error } = await supabase
        .from('foods')
        .update({
          name: updates.name,
          brand: updates.brand || null,
          image_url: updates.image_url || null,
          default_quantity: updates.default_quantity || 100,
          unit: updates.unit || 'g',
          calories: updates.calories || 0,
          protein: updates.protein || 0,
          fat: updates.fat || 0,
          carbs: updates.carbs || 0,
          notes: updates.notes || null,
          is_active: updates.is_active !== false,
          updated_by: userId,
        })
        .eq('id', foodId)
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  /**
   * Soft-delete or re-activate a public food.
   */
  async setPublicFoodActive(userId, foodId, isActive) {
    try {
      const { data, error } = await supabase
        .from('foods')
        .update({
          is_active: Boolean(isActive),
          updated_by: userId,
        })
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
