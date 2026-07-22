import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export const getSupabaseClient = () => {
  if (!supabase) {
    throw new Error('Supabase 未配置，请设置 REACT_APP_SUPABASE_URL 与 REACT_APP_SUPABASE_ANON_KEY');
  }
  return supabase;
};
