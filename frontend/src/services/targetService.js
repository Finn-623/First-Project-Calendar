import { getSupabaseClient } from '../lib/supabaseClient';
import { round1, roundCalories } from '../lib/nutrition';

const isMissingColumnError = (error) => error?.code === '42703';

const normalizeTarget = (row) => {
  if (!row) return null;
  return {
    calories: roundCalories(row.calories_target ?? row.calories ?? 0),
    protein: round1(row.protein_target ?? row.protein ?? 0),
    fat: round1(row.fat_target ?? row.fat ?? 0),
    carbs: round1(row.carbs_target ?? row.carbs ?? 0),
  };
};

const getDateValue = (row) => row.target_date || row.date || row.item_date || null;

export const fetchDailyTarget = async ({ userId, dateStr }) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('daily_targets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const row = (data || []).find((item) => getDateValue(item) === dateStr) || null;
  return normalizeTarget(row);
};

export const upsertDailyTarget = async ({ userId, dateStr, plan }) => {
  const supabase = getSupabaseClient();
  const payloads = [
    {
      user_id: userId,
      target_date: dateStr,
      calories_target: roundCalories(plan.calories),
      protein_target: round1(plan.protein),
      fat_target: round1(plan.fat),
      carbs_target: round1(plan.carbs),
    },
    {
      user_id: userId,
      date: dateStr,
      calories: roundCalories(plan.calories),
      protein: round1(plan.protein),
      fat: round1(plan.fat),
      carbs: round1(plan.carbs),
    },
  ];

  let lastError = null;
  for (const payload of payloads) {
    const onConflict = payload.target_date ? 'user_id,target_date' : 'user_id,date';
    const { data, error } = await supabase.from('daily_targets').upsert(payload, { onConflict }).select('*').single();
    if (!error) return normalizeTarget(data);
    lastError = error;
    if (!isMissingColumnError(error)) break;
  }

  throw lastError || new Error('保存目标失败');
};
