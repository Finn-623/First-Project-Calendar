import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey;

if (supabaseConfigError) {
  console.error(
    'Missing Supabase environment variables:',
    !supabaseUrl && 'REACT_APP_SUPABASE_URL',
    !supabaseAnonKey && 'REACT_APP_SUPABASE_ANON_KEY'
  );
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
