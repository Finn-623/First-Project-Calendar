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

const isLikelySupabaseUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizeFoodEntry = (entry) => ({
  entryId: entry?.id,
  foodEntryId: entry?.id,
  foodId: entry?.source_food_id || null,
  name: entry?.food_name_snapshot || '',
  grams: Number(entry?.quantity || 0),
  unit: entry?.unit_snapshot || 'g',
  cal: Number(entry?.calories_snapshot || 0),
  p: Number(entry?.protein_snapshot || 0),
  f: Number(entry?.fat_snapshot || 0),
  c: Number(entry?.carbs_snapshot || 0),
});

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

      if (error) return { data: [], error };

      const timelineRows = data || [];
      if (timelineRows.length === 0) return { data: [], error: null };

      const { data: foodEntries, error: foodError } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', userId)
        .in('timeline_item_id', timelineRows.map((item) => item.id))
        .order('created_at', { ascending: true });

      if (foodError) return { data: [], error: foodError };

      const foodsByTimelineId = new Map();
      (foodEntries || []).forEach((entry) => {
        const current = foodsByTimelineId.get(entry.timeline_item_id) || [];
        current.push(normalizeFoodEntry(entry));
        foodsByTimelineId.set(entry.timeline_item_id, current);
      });

      return {
        data: timelineRows.map((item) => normalizeTimelineItem({
          ...item,
          foods: foodsByTimelineId.get(item.id) || [],
        })),
        error: null,
      };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Persist one food entry and ensure its meal exists first. The returned IDs
   * are the database IDs used by refresh, navigation and later deletion.
   */
  async createFoodEntryForMeal({ userId, dateStr, meal, food }) {
    let createdMealId = null;

    try {
      if (!userId || !dateStr || !meal || !food) {
        return { data: null, error: new Error('缺少食品记录保存参数') };
      }

      const quantity = Number(food.grams);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { data: null, error: new Error('请输入有效的食品克重') };
      }

      const itemType = meal.subtype || meal.item_type;
      if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(itemType)) {
        return { data: null, error: new Error('目标餐次类型无效') };
      }

      let persistedMeal = null;
      const isDefaultMeal = ['breakfast', 'lunch', 'dinner'].includes(itemType);
      if (isLikelySupabaseUuid(meal.id)) {
        const { data: existingMeal, error: existingMealError } = await supabase
          .from('timeline_items')
          .select('*')
          .eq('id', meal.id)
          .eq('user_id', userId)
          .eq('event_date', dateStr)
          .maybeSingle();

        if (existingMealError) return { data: null, error: existingMealError };
        if (!existingMeal) return { data: null, error: new Error('目标餐次不存在，请刷新后重试') };
        persistedMeal = normalizeTimelineItem(existingMeal);
      } else {
        const existingMealResult = isDefaultMeal
          ? await supabase
            .from('timeline_items')
            .select('*')
            .eq('user_id', userId)
            .eq('event_date', dateStr)
            .eq('item_type', itemType)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          : { data: null, error: null };
        const { data: existingMeal, error: existingMealError } = existingMealResult;

        if (existingMealError) return { data: null, error: existingMealError };

        if (existingMeal) {
          persistedMeal = normalizeTimelineItem(existingMeal);
        } else {
          const created = await this.createTimelineItem(userId, {
            event_date: dateStr,
            event_time: meal.time || meal.event_time,
            item_type: itemType,
            title: meal.title || '餐次',
            notes: meal.notes || null,
            details: meal.details || {},
            sort_order: Number.isFinite(Number(meal.sort_order)) ? Number(meal.sort_order) : 0,
          });
          if (created.error?.code === '23505' && isDefaultMeal) {
            const retry = await supabase
              .from('timeline_items')
              .select('*')
              .eq('user_id', userId)
              .eq('event_date', dateStr)
              .eq('item_type', itemType)
              .maybeSingle();
            if (retry.error || !retry.data) {
              return { data: null, error: retry.error || created.error };
            }
            persistedMeal = normalizeTimelineItem(retry.data);
          } else if (created.error || !created.data?.id) {
            return { data: null, error: created.error || new Error('餐次创建失败') };
          } else {
            persistedMeal = created.data;
            createdMealId = created.data.id;
          }
        }
      }

      const { data: foodEntry, error: foodEntryError } = await supabase
        .from('food_entries')
        .insert([{
          user_id: userId,
          timeline_item_id: persistedMeal.id,
          source_food_id: food.foodId || null,
          food_name_snapshot: food.name,
          quantity,
          unit_snapshot: food.unit || 'g',
          calories_snapshot: Number(food.cal || 0),
          protein_snapshot: Number(food.p || 0),
          fat_snapshot: Number(food.f || 0),
          carbs_snapshot: Number(food.c || 0),
        }])
        .select('*')
        .single();

      if (foodEntryError || !foodEntry?.id) {
        if (createdMealId) {
          await supabase
            .from('timeline_items')
            .delete()
            .eq('id', createdMealId)
            .eq('user_id', userId);
        }
        return { data: null, error: foodEntryError || new Error('食品记录创建失败') };
      }

      return {
        data: {
          meal: persistedMeal,
          foodEntry: normalizeFoodEntry(foodEntry),
        },
        error: null,
      };
    } catch (err) {
      if (createdMealId) {
        try {
          await supabase
            .from('timeline_items')
            .delete()
            .eq('id', createdMealId)
            .eq('user_id', userId);
        } catch {
          // The original persistence error is more useful to the caller.
        }
      }
      return { data: null, error: err };
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

  async updateTimelineItemByUser(itemId, userId, updates) {
    try {
      if (!userId) {
        return { data: null, error: new Error('缺少用户 ID') };
      }

      const payload = {
        ...updates,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('timeline_items')
        .update(payload)
        .eq('id', itemId)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (error) return { data: null, error };
      if (!data) return { data: null, error: new Error('无权限或记录不存在') };
      return { data: normalizeTimelineItem(data), error: null };
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

  /**
   * Delete the food row first, then remove an empty custom meal. The order is
   * intentional: a meal must never disappear while its food row still exists.
   */
  async deleteFoodEntryThenCustomMeal(entryId, mealId, userId) {
    const foodResult = await this.deleteFoodEntry(entryId, userId);
    if (foodResult.error) {
      return { foodDeleted: false, mealDeleted: false, error: foodResult.error };
    }

    const mealResult = await this.deleteTimelineItemByUser(mealId, userId);
    if (mealResult.error) {
      return { foodDeleted: true, mealDeleted: false, error: mealResult.error };
    }

    return { foodDeleted: true, mealDeleted: true, error: null };
  },
};
