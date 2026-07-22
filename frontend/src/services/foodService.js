import { getSupabaseClient } from '../lib/supabaseClient';
import { round1, roundCalories, scaleFoodByQuantity } from '../lib/nutrition';

const normalizeFoodLibraryItem = (row) => {
  const p100 = Number(row.protein_per_100g ?? row.protein_100g ?? row.protein_per100 ?? row.p100 ?? row.protein ?? 0);
  const f100 = Number(row.fat_per_100g ?? row.fat_100g ?? row.fat_per100 ?? row.f100 ?? row.fat ?? 0);
  const c100 = Number(row.carbs_per_100g ?? row.carbs_100g ?? row.carbs_per100 ?? row.c100 ?? row.carbs ?? 0);
  const cal100 = Number(row.calories_per_100g ?? row.calories_100g ?? row.calories_per100 ?? row.cal100 ?? row.calories ?? 0);
  return {
    id: row.id,
    name: row.name || row.food_name || '',
    category: row.category || '自定义',
    cal100: roundCalories(cal100),
    p100: round1(p100),
    f100: round1(f100),
    c100: round1(c100),
  };
};

export const fetchFoodLibrary = async ({ userId }) => {
  const supabase = getSupabaseClient();

  const { data: foodsRows, error: foodsError } = await supabase
    .from('foods')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (foodsError) throw foodsError;

  const normalizedFoods = (foodsRows || []).map(normalizeFoodLibraryItem);
  const byId = new Map(normalizedFoods.map((item) => [item.id, item]));

  const { data: favoriteRows } = await supabase
    .from('favorite_foods')
    .select('*')
    .eq('user_id', userId);

  if (!favoriteRows || favoriteRows.length === 0) {
    return normalizedFoods;
  }

  const favoriteIds = favoriteRows
    .map((row) => row.food_id || row.source_food_id || row.foods_id)
    .filter(Boolean);

  const favorites = favoriteIds.map((id) => byId.get(id)).filter(Boolean);
  const nonFavorites = normalizedFoods.filter((item) => !favoriteIds.includes(item.id));
  return [...favorites, ...nonFavorites];
};

export const createFoodInLibrary = async ({ userId, food }) => {
  const supabase = getSupabaseClient();
  const payloads = [
    {
      user_id: userId,
      name: food.name,
      category: food.category || '自定义',
      calories_per_100g: roundCalories(food.cal100),
      protein_per_100g: round1(food.p100),
      fat_per_100g: round1(food.f100),
      carbs_per_100g: round1(food.c100),
      unit: 'g',
    },
    {
      user_id: userId,
      food_name: food.name,
      category: food.category || '自定义',
      cal100: roundCalories(food.cal100),
      p100: round1(food.p100),
      f100: round1(food.f100),
      c100: round1(food.c100),
      unit: 'g',
    },
  ];

  let lastError = null;
  for (const payload of payloads) {
    const { data, error } = await supabase.from('foods').insert(payload).select('*').single();
    if (!error) return normalizeFoodLibraryItem(data);
    lastError = error;
    if (!String(error.message || '').includes('column')) break;
  }
  throw lastError || new Error('保存食物库失败');
};

export const createFoodEntry = async ({ userId, timelineItemId, sourceFoodId = null, food, notes = null }) => {
  const supabase = getSupabaseClient();
  const payload = {
    user_id: userId,
    timeline_item_id: timelineItemId,
    source_food_id: sourceFoodId,
    food_name_snapshot: food.name,
    quantity: Number(food.grams || 0),
    unit_snapshot: food.unit || 'g',
    calories_snapshot: roundCalories(food.cal),
    protein_snapshot: round1(food.p),
    fat_snapshot: round1(food.f),
    carbs_snapshot: round1(food.c),
    notes,
  };

  const { data, error } = await supabase.from('food_entries').insert(payload).select('*').single();
  if (error) throw error;
  return {
    id: data.id,
    source_food_id: data.source_food_id || sourceFoodId || null,
    name: data.food_name_snapshot || food.name,
    grams: Number(data.quantity || food.grams || 0),
    unit: data.unit_snapshot || food.unit || 'g',
    cal: roundCalories(data.calories_snapshot ?? food.cal ?? 0),
    p: round1(data.protein_snapshot ?? food.p ?? 0),
    f: round1(data.fat_snapshot ?? food.f ?? 0),
    c: round1(data.carbs_snapshot ?? food.c ?? 0),
    notes: data.notes || notes,
  };
};

export const deleteFoodEntryById = async ({ entryId, userId }) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);
  if (error) throw error;
};

export const computeEntryFromLibraryFood = ({ libraryFood, grams }) => {
  const macros = scaleFoodByQuantity(libraryFood, grams, 100);
  return {
    sourceFoodId: libraryFood.id,
    food: {
      name: libraryFood.name,
      grams: Number(grams || 0),
      unit: 'g',
      cal: macros.cal,
      p: macros.p,
      f: macros.f,
      c: macros.c,
    },
  };
};
