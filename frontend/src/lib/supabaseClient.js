import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const hasValidUrl = Boolean(
  supabaseUrl
  && supabaseUrl !== 'your_supabase_url'
  && /^https?:\/\//.test(supabaseUrl)
);
const hasValidAnonKey = Boolean(
  supabaseAnonKey
  && supabaseAnonKey !== 'your_anon_key'
);

export const isSupabaseConfigured = hasValidUrl && hasValidAnonKey;
export const supabaseConfigError = !isSupabaseConfigured;

if (supabaseConfigError) {
  console.error(
    'Missing Supabase environment variables:',
    !supabaseUrl && 'REACT_APP_SUPABASE_URL',
    !supabaseAnonKey && 'REACT_APP_SUPABASE_ANON_KEY'
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : null;
