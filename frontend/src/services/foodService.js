/**
 * Food Service
 * Handles CRUD operations for food library and entries
 */

import { supabase } from '../lib/supabaseClient';
import { PUBLIC_FOOD_PAGE_SIZE } from '../constants/publicFood';

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
    sourcePublicFoodId: food.source_public_food_id || null,
    aliases: (food.food_private_aliases || []).map((row) => row.alias).filter(Boolean),
    portions: (food.food_portions || []).map((row) => ({
      id: row.id,
      name: row.portion_name,
      grams: nullableNumber(row.grams),
      isDefault: row.is_default === true,
    })),
  };
};

const nullableNumber = (value) => (value == null || value === '' ? null : Number(value));

export const normalizePublicFood = (food) => food ? ({
  id: food.id,
  name: food.name,
  nameEn: food.name_en || '',
  brand: food.brand || '',
  sourceName: food.source_name || '',
  externalFoodId: food.external_food_id || '',
  primaryCategory: food.primary_category || '',
  secondaryCategory: food.secondary_category || '',
  preparationState: food.preparation_state || null,
  intakeTypes: Array.isArray(food.intake_types) ? food.intake_types : [],
  nutrients: {
    energyKcal: nullableNumber(food.energy_kcal),
    proteinG: nullableNumber(food.protein_g),
    carbohydrateG: nullableNumber(food.carbohydrate_g),
    fatG: nullableNumber(food.fat_g),
    fiberG: nullableNumber(food.fiber_g),
    saturatedFatG: nullableNumber(food.saturated_fat_g),
    totalSugarG: nullableNumber(food.total_sugar_g),
    sodiumMg: nullableNumber(food.sodium_mg),
    potassiumMg: nullableNumber(food.potassium_mg),
  },
  aliases: (food.food_public_aliases || []).map((row) => row.alias).filter(Boolean),
  portions: (food.food_portions || []).map((row) => ({
    id: row.id,
    name: row.portion_name,
    grams: nullableNumber(row.grams),
    isDefault: row.is_default === true,
  })),
}) : null;

const PUBLIC_FOOD_LIST_FIELDS = [
  'id', 'name', 'name_en', 'brand', 'source_name', 'external_food_id',
  'primary_category', 'secondary_category', 'preparation_state', 'intake_types',
  'energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fiber_g',
  'saturated_fat_g', 'total_sugar_g', 'sodium_mg', 'potassium_mg',
].join(',');

const escapePostgrestSearch = (value) => String(value || '').replace(/[,%()]/g, ' ').trim();

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
  async listVisiblePublicFoods({ query = '', category = '', intakeType = '', page = 0, pageSize = PUBLIC_FOOD_PAGE_SIZE } = {}) {
    if (!supabase) return { data: [], count: 0, error: new Error('Supabase 尚未配置') };
    try {
      const cleanedQuery = escapePostgrestSearch(query);
      let aliasFoodIds = [];
      if (cleanedQuery) {
        const aliasResult = await supabase
          .from('food_public_aliases')
          .select('food_id')
          .ilike('alias', `%${cleanedQuery}%`)
          .limit(200);
        if (aliasResult.error) return { data: [], count: 0, error: aliasResult.error };
        aliasFoodIds = [...new Set((aliasResult.data || []).map((row) => row.food_id).filter(Boolean))];
      }

      let request = supabase
        .from('foods')
        .select(PUBLIC_FOOD_LIST_FIELDS, { count: 'exact' })
        .eq('visibility', 'public')
        .eq('review_status', 'approved')
        .eq('is_active', true)
        .not('source_name', 'is', null)
        .order('name', { ascending: true })
        .range(page * pageSize, ((page + 1) * pageSize) - 1);
      if (category) request = request.eq('primary_category', category);
      if (intakeType) request = request.contains('intake_types', [intakeType]);
      if (cleanedQuery) {
        const direct = `name.ilike.%${cleanedQuery}%,name_en.ilike.%${cleanedQuery}%,brand.ilike.%${cleanedQuery}%`;
        request = request.or(aliasFoodIds.length ? `${direct},id.in.(${aliasFoodIds.join(',')})` : direct);
      }

      const { data, count, error } = await request;
      return { data: (data || []).map(normalizePublicFood), count: count || 0, error };
    } catch (error) {
      return { data: [], count: 0, error };
    }
  },

  async loadVisiblePublicFoodFacets() {
    if (!supabase) return { categories: [], intakeTypes: [], error: new Error('Supabase 尚未配置') };
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('primary_category,intake_types')
        .eq('visibility', 'public')
        .eq('review_status', 'approved')
        .eq('is_active', true)
        .not('source_name', 'is', null);
      if (error) return { categories: [], intakeTypes: [], error };
      return {
        categories: [...new Set((data || []).map((row) => row.primary_category).filter(Boolean))].sort(),
        intakeTypes: [...new Set((data || []).flatMap((row) => row.intake_types || []))].sort(),
        error: null,
      };
    } catch (error) {
      return { categories: [], intakeTypes: [], error };
    }
  },

  async getVisiblePublicFoodDetail(foodId) {
    if (!supabase || !foodId) return { data: null, error: new Error('食品不可用') };
    try {
      const { data, error } = await supabase
        .from('foods')
        .select(`${PUBLIC_FOOD_LIST_FIELDS},food_public_aliases(alias),food_portions(id,portion_name,grams,is_default)`)
        .eq('id', foodId)
        .eq('visibility', 'public')
        .eq('review_status', 'approved')
        .eq('is_active', true)
        .not('source_name', 'is', null)
        .maybeSingle();
      if (error) return { data: null, error };
      return data
        ? { data: normalizePublicFood(data), error: null }
        : { data: null, error: new Error('食品不可用') };
    } catch (error) {
      return { data: null, error };
    }
  },

  async copyPublicFoodToPersonal(sourceFoodId, name) {
    if (!supabase || !sourceFoodId) return { data: null, error: new Error('食品不可用') };
    try {
      const { data, error } = await supabase.rpc('copy_public_food_to_personal', {
        p_source_food_id: sourceFoodId,
        p_name: String(name || '').trim() || null,
      });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },
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
        .select('*,food_private_aliases(alias),food_portions(id,portion_name,grams,is_default)')
        .eq('is_active', true)
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

  async loadPublicFoodReviewQueue({
    status = 'pending',
    category = '',
    query = '',
    page = 0,
    pageSize = 20,
  } = {}) {
    if (!supabase) {
      return { data: [], count: 0, error: new Error('Supabase 尚未配置') };
    }
    try {
      let request = supabase
        .from('foods')
        .select(
          '*,food_public_aliases(count),food_portions(count)',
          { count: 'exact' }
        )
        .eq('visibility', 'public')
        .eq('review_status', status)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (category) request = request.eq('primary_category', category);
      const cleanedQuery = String(query || '').trim();
      if (cleanedQuery) {
        const escaped = cleanedQuery.replaceAll(',', '\\,');
        request = request.or(
          `name.ilike.%${escaped}%,name_en.ilike.%${escaped}%,external_food_id.ilike.%${escaped}%`
        );
      }
      const { data, count, error } = await request;
      return { data: data || [], count: count || 0, error };
    } catch (error) {
      return { data: [], count: 0, error };
    }
  },

  async reviewPublicFoods(foodIds, targetStatus, reviewNote = null) {
    if (!supabase) return { data: null, error: new Error('Supabase 尚未配置') };
    if (!Array.isArray(foodIds) || foodIds.length < 1 || foodIds.length > 50) {
      return { data: null, error: new Error('每次请选择1至50条食品') };
    }
    try {
      const { data, error } = await supabase.rpc('review_public_foods', {
        p_food_ids: foodIds,
        p_target_status: targetStatus,
        p_review_note: String(reviewNote || '').trim() || null,
      });
      return { data, error };
    } catch (error) {
      return { data: null, error };
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
  async updateFood(foodId, updates, userId = null) {
    try {
      let request = supabase
        .from('foods')
        .update(updates)
        .eq('id', foodId)
        .eq('visibility', 'private');
      if (userId) request = request.eq('user_id', userId);
      const { data, error } = await request
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
   * Deactivate a personal food without removing history or snapshots.
   * @param {string} foodId
   * @param {string} userId
   * @returns {Promise<{data, error}>}
   */
  async deactivatePersonalFood(foodId, userId) {
    if (!supabase || !foodId || !userId) {
      return { data: null, error: new Error('食品不存在或无权操作') };
    }

    try {
      const { data, error } = await supabase
        .from('foods')
        .update({ is_active: false })
        .eq('id', foodId)
        .eq('visibility', 'private')
        .eq('user_id', userId)
        .eq('is_active', true)
        .select('id')
        .maybeSingle();

      if (error) return { data: null, error };
      if (!data) return { data: null, error: new Error('食品不存在或无权操作') };
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  // Keep the existing caller API while making its behavior history-preserving.
  async deleteFood(foodId, userId = null) {
    return this.deactivatePersonalFood(foodId, userId);
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
