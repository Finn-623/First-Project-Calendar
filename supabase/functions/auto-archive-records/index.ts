import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

interface UserRecordSettings {
  user_id: string;
  auto_archive_enabled: boolean;
  auto_archive_time: string;
  timezone: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all users with auto-archive enabled
    const { data: settings, error: settingsError } = await supabase
      .from('user_record_settings')
      .select('*')
      .eq('auto_archive_enabled', true);

    if (settingsError) {
      return jsonResponse(500, {
        error: 'Failed to fetch settings',
        details: settingsError.message,
      });
    }

    if (!settings || settings.length === 0) {
      return jsonResponse(200, {
        message: 'No users with auto-archive enabled',
        processed: 0,
      });
    }

    let processedCount = 0;
    const now = new Date();
    const results = [];

    for (const setting of settings as UserRecordSettings[]) {
      try {
        const result = await processUserArchive(supabase, setting, now);
        results.push(result);
        if (result.archived) {
          processedCount++;
        }
      } catch (err) {
        results.push({
          user_id: setting.user_id,
          error: String(err),
        });
      }
    }

    return jsonResponse(200, {
      message: 'Auto-archive processing completed',
      processed: processedCount,
      total: settings.length,
      results: results.slice(0, 10), // Return first 10 results to avoid huge responses
    });
  } catch (err) {
    return jsonResponse(500, {
      error: 'Internal server error',
      details: String(err),
    });
  }
});

async function processUserArchive(supabase: any, setting: UserRecordSettings, now: Date) {
  const { user_id, auto_archive_time, timezone } = setting;

  try {
    // Get current date in user's timezone
    const userDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const userDateStr = userDateFormatter.format(now);

    // Parse archive time
    const [archiveHour, archiveMinute] = auto_archive_time.split(':').map(Number);

    // Check if archive time has arrived in user's timezone
    const userTimeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const userTime = userTimeFormatter.format(now);
    const [userHour, userMinute] = userTime.split(':').map(Number);

    // Check if current time >= archive time
    const currentTimeMinutes = userHour * 60 + userMinute;
    const archiveTimeMinutes = archiveHour * 60 + archiveMinute;

    if (currentTimeMinutes < archiveTimeMinutes) {
      return {
        user_id,
        archived: false,
        reason: 'Archive time not reached yet',
      };
    }

    // Check if already archived today
    const { data: archiveLog, error: logError } = await supabase
      .from('automatic_archive_log')
      .select('*')
      .eq('user_id', user_id)
      .eq('archive_date', userDateStr)
      .maybeSingle();

    if (logError && logError.code !== 'PGRST116') {
      throw logError;
    }

    if (archiveLog) {
      return {
        user_id,
        archived: false,
        reason: 'Already archived today',
      };
    }

    // Fetch timeline items for today (meaningful items only)
    const { data: timelineItems, error: timelineError } = await supabase
      .from('timeline_items')
      .select('*')
      .eq('user_id', user_id)
      .eq('event_date', userDateStr);

    if (timelineError) {
      throw timelineError;
    }

    // Calculate total macros from timeline items
    const { totalCalories, totalProtein, totalFat, totalCarbs, itemCount } = calculateMacros(timelineItems || []);

    // Skip if no meaningful items
    if (itemCount === 0) {
      // Log as "archived" but with 0 items to prevent repeated checks
      const { error: insertError } = await supabase
        .from('automatic_archive_log')
        .insert({
          user_id,
          archive_date: userDateStr,
          archived_record_count: 0,
        });

      if (insertError) {
        throw insertError;
      }

      return {
        user_id,
        archived: false,
        reason: 'No meaningful timeline items',
        itemCount: 0,
      };
    }

    // Create intake plan history record
    const { data: historyRecord, error: historyError } = await supabase
      .from('intake_plan_history')
      .insert({
        user_id,
        calories_kcal: totalCalories,
        protein_g: totalProtein,
        fat_g: totalFat,
        carbs_g: totalCarbs,
        calculated_field: 'calories',
      })
      .select()
      .single();

    if (historyError) {
      throw historyError;
    }

    // Log the archive action
    const { error: logInsertError } = await supabase
      .from('automatic_archive_log')
      .insert({
        user_id,
        archive_date: userDateStr,
        archived_record_count: itemCount,
      });

    if (logInsertError) {
      throw logInsertError;
    }

    // Delete archived timeline items
    const { error: deleteError } = await supabase
      .from('timeline_items')
      .delete()
      .eq('user_id', user_id)
      .eq('event_date', userDateStr);

    if (deleteError) {
      throw deleteError;
    }

    return {
      user_id,
      archived: true,
      itemCount,
      historyRecordId: historyRecord?.id,
    };
  } catch (err) {
    return {
      user_id,
      error: String(err),
    };
  }
}

function calculateMacros(items: any[]) {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let itemCount = 0;

  for (const item of items) {
    // Skip empty items
    if (!item || !item.details) continue;

    const details = item.details;

    // Process meals with foods
    if (item.item_type === 'breakfast' || item.item_type === 'lunch' || item.item_type === 'dinner' || item.item_type === 'snack') {
      const foods = details.foods || [];
      for (const food of foods) {
        if (food.cal) {
          totalCalories += Number(food.cal) || 0;
          totalProtein += Number(food.p) || 0;
          totalFat += Number(food.f) || 0;
          totalCarbs += Number(food.c) || 0;
          itemCount++;
        }
      }
    }

    // Process training (calories burned)
    if (item.item_type === 'anaerobic_training' || item.item_type === 'aerobic_training') {
      const caloriesBurned = details.caloriesBurned || item.caloriesBurned;
      if (caloriesBurned) {
        totalCalories -= Number(caloriesBurned);
        itemCount++;
      }
    }
  }

  return {
    totalCalories: Math.round(totalCalories * 100) / 100,
    totalProtein: Math.round(totalProtein * 10) / 10,
    totalFat: Math.round(totalFat * 10) / 10,
    totalCarbs: Math.round(totalCarbs * 10) / 10,
    itemCount,
  };
}
