import { getSupabaseClient } from '../lib/supabaseClient';
import { round1, roundCalories } from '../lib/nutrition';

const FIXED_MEALS = [
  { subtype: 'breakfast', title: '早餐', time: '08:00' },
  { subtype: 'lunch', title: '午餐', time: '12:30' },
  { subtype: 'dinner', title: '晚餐', time: '19:00' },
];

const getDateValue = (row) => row.item_date || row.target_date || row.date || row.timeline_date || null;
const getTypeValue = (row) => row.item_type || row.type || null;
const getSubtypeValue = (row) => row.item_subtype || row.subtype || null;
const isMissingColumnError = (error) => error?.code === '42703';
const titleForSubtype = (subtype) => {
  if (subtype === 'breakfast') return '早餐';
  if (subtype === 'lunch') return '午餐';
  if (subtype === 'dinner') return '晚餐';
  if (subtype === 'snack') return '加餐';
  return '事件';
};

const normalizeTimelineItem = (row) => {
  const type = getTypeValue(row);
  const subtype = getSubtypeValue(row);
  const mappedType = type === 'anaerobic_training'
    ? 'anaerobic'
    : type === 'aerobic_training'
      ? 'aerobic'
      : type === 'other'
        ? 'event'
        : type;

  return {
    id: row.id,
    type: mappedType,
    rawType: type,
    subtype,
    title: row.title || titleForSubtype(subtype),
    time: row.time || row.start_time || null,
    detail: row.detail || row.description || row.notes || null,
    caloriesBurned: row.calories_burned ?? row.caloriesBurned ?? null,
    fixed: subtype === 'breakfast' || subtype === 'lunch' || subtype === 'dinner',
    foods: [],
  };
};

const normalizeFoodEntry = (row) => ({
  id: row.id,
  timeline_item_id: row.timeline_item_id,
  source_food_id: row.source_food_id || null,
  name: row.food_name_snapshot || row.name || '',
  grams: Number(row.quantity || row.grams || 0),
  unit: row.unit_snapshot || row.unit || 'g',
  cal: roundCalories(row.calories_snapshot ?? row.calories ?? row.cal ?? 0),
  p: round1(row.protein_snapshot ?? row.protein ?? row.p ?? 0),
  f: round1(row.fat_snapshot ?? row.fat ?? row.f ?? 0),
  c: round1(row.carbs_snapshot ?? row.carbs ?? row.c ?? 0),
  notes: row.notes || null,
});

const toTimelineType = (type) => {
  if (type === 'anaerobic') return 'anaerobic_training';
  if (type === 'aerobic') return 'aerobic_training';
  if (type === 'event') return 'other';
  return type;
};

const tryInsertTimeline = async (payloads) => {
  const supabase = getSupabaseClient();
  let lastError = null;
  for (const payload of payloads) {
    const { data, error } = await supabase.from('timeline_items').insert(payload).select('*').single();
    if (!error) return data;
    lastError = error;
    if (!isMissingColumnError(error)) break;
  }
  throw lastError || new Error('创建时间轴失败');
};

export const fetchTimelineForDate = async ({ userId, dateStr }) => {
  const supabase = getSupabaseClient();
  const timelineQueries = [
    () => supabase.from('timeline_items').select('*').eq('user_id', userId).eq('item_date', dateStr).order('time', { ascending: true, nullsFirst: false }),
    () => supabase.from('timeline_items').select('*').eq('user_id', userId).eq('date', dateStr).order('time', { ascending: true, nullsFirst: false }),
    () => supabase.from('timeline_items').select('*').eq('user_id', userId).eq('target_date', dateStr).order('time', { ascending: true, nullsFirst: false }),
    () => supabase.from('timeline_items').select('*').eq('user_id', userId).eq('timeline_date', dateStr).order('time', { ascending: true, nullsFirst: false }),
  ];

  let dayRows = [];
  let lastError = null;
  for (const query of timelineQueries) {
    const { data, error } = await query();
    if (!error) {
      dayRows = data || [];
      lastError = null;
      break;
    }
    lastError = error;
    if (!isMissingColumnError(error)) break;
  }
  if (lastError) throw lastError;

  const timelineItems = dayRows.map(normalizeTimelineItem);
  const timelineIds = timelineItems.map((item) => item.id);

  let foodRows = [];
  if (timelineIds.length > 0) {
    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .in('timeline_item_id', timelineIds)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    foodRows = data || [];
  }

  const foodByTimelineId = foodRows.reduce((acc, row) => {
    const key = row.timeline_item_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(normalizeFoodEntry(row));
    return acc;
  }, {});

  const merged = timelineItems.map((item) => ({
    ...item,
    foods: item.type === 'meal' ? (foodByTimelineId[item.id] || []) : [],
  }));

  const existingMealSubtypes = new Set(merged.filter((it) => it.type === 'meal').map((it) => it.subtype));
  const fixedMeals = FIXED_MEALS
    .filter((meal) => !existingMealSubtypes.has(meal.subtype))
    .map((meal) => ({
      id: `virtual-${meal.subtype}`,
      type: 'meal',
      subtype: meal.subtype,
      title: meal.title,
      time: meal.time,
      fixed: true,
      foods: [],
      virtual: true,
    }));

  return [...merged, ...fixedMeals];
};

export const createTimelineItem = async ({ userId, dateStr, type, subtype, title, time, detail, caloriesBurned }) => {
  const mappedType = toTimelineType(type);
  const payloads = [
    {
      user_id: userId,
      item_date: dateStr,
      item_type: mappedType,
      item_subtype: subtype || null,
      title: title || null,
      time: time || null,
      detail: detail || null,
      calories_burned: caloriesBurned ?? null,
    },
    {
      user_id: userId,
      date: dateStr,
      type: mappedType,
      subtype: subtype || null,
      title: title || null,
      time: time || null,
      detail: detail || null,
      calories_burned: caloriesBurned ?? null,
    },
  ];

  const row = await tryInsertTimeline(payloads);
  return normalizeTimelineItem(row);
};

export const ensureMealTimelineItem = async ({ userId, dateStr, subtype }) => {
  const timeline = await fetchTimelineForDate({ userId, dateStr });
  const existing = timeline.find((item) => item.type === 'meal' && item.subtype === subtype && !item.virtual);
  if (existing) return existing;

  const base = FIXED_MEALS.find((item) => item.subtype === subtype);
  return createTimelineItem({
    userId,
    dateStr,
    type: 'meal',
    subtype,
    title: base?.title || '餐次',
    time: base?.time || null,
    detail: null,
    caloriesBurned: null,
  });
};

export const deleteTimelineItemById = async ({ itemId, userId }) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('timeline_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) throw error;
};

export const updateTimelineTime = async ({ itemId, userId, time }) => {
  const supabase = getSupabaseClient();
  const updates = [{ time }, { start_time: time }];
  let lastError = null;

  for (const patch of updates) {
    const { error } = await supabase
      .from('timeline_items')
      .update(patch)
      .eq('id', itemId)
      .eq('user_id', userId);
    if (!error) return;
    lastError = error;
    if (!isMissingColumnError(error)) break;
  }

  throw lastError || new Error('更新时间失败');
};
