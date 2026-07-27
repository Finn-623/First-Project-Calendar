import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  createAutoArchiveHandler,
  createSupabaseArchiveRepository,
} from './handler.ts';

const handler = createAutoArchiveHandler({
  getSecret: () => Deno.env.get('AUTO_ARCHIVE_CRON_SECRET'),
  createRepository: () => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase service configuration is missing');
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return createSupabaseArchiveRepository(client);
  },
});

serve(handler);
