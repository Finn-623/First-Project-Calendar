const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const MIN_ARCHIVE_AGE_DAYS = 1;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

async function digestSecret(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  );
}

export async function secretsMatch(provided: string, expected: string) {
  const [providedDigest, expectedDigest] = await Promise.all([
    digestSecret(provided),
    digestSecret(expected),
  ]);

  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= providedDigest[index] ^ expectedDigest[index];
  }
  return difference === 0;
}

function extractBearerSecret(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization) return { present: false, value: '' };

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return {
    present: true,
    value: match?.[1]?.trim() || '',
  };
}

function parseTimeToMinutes(value: string) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) throw new Error('Invalid archive time');

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error('Invalid archive time');
  return (hours * 60) + minutes;
}

function getZonedDateAndMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    dateStr: `${values.year}-${values.month}-${values.day}`,
    minutes: (Number(values.hour) * 60) + Number(values.minute),
  };
}

function addDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function formatArchiveLabel(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${month}月${day}日 · ${weekdays[date.getUTCDay()]}`;
}

function normalizeTimelineItem(item: Record<string, any>) {
  const itemType = item.item_type;
  const type = itemType === 'breakfast' || itemType === 'lunch' || itemType === 'dinner' || itemType === 'snack'
    ? 'meal'
    : itemType === 'anaerobic_training'
      ? 'anaerobic'
      : itemType === 'aerobic_training'
        ? 'aerobic'
        : 'event';
  const foods = Array.isArray(item.food_entries)
    ? item.food_entries.map((entry: Record<string, any>) => ({
        entryId: entry.id,
        id: entry.source_food_id || entry.id,
        name: entry.food_name_snapshot || entry.name || '食物',
        grams: Number(entry.quantity || 0),
        cal: Number(entry.calories_snapshot || 0),
        p: Number(entry.protein_snapshot || 0),
        f: Number(entry.fat_snapshot || 0),
        c: Number(entry.carbs_snapshot || 0),
      }))
    : [];

  return {
    id: item.id,
    type,
    subtype: type === 'meal' ? itemType : undefined,
    title: item.title,
    time: item.event_time || item.time,
    fixed: Boolean(item.fixed),
    foods,
    detail: item.notes || '',
    notes: item.notes || null,
    snackType: item.details?.snackType,
    bodyParts: item.details?.bodyParts,
    status: item.status || 'completed',
    started_at: item.started_at || null,
    ended_at: item.ended_at || null,
    duration_minutes: item.duration_minutes == null ? null : Number(item.duration_minutes),
    caloriesBurned: Number(item.details?.caloriesBurned || item.calories_burned || 0),
  };
}

function sumTotals(timeline: Array<Record<string, any>>) {
  return timeline.reduce((totals, item) => {
    if (item.type !== 'meal') return totals;
    for (const food of item.foods || []) {
      totals.calories += Number(food.cal || 0);
      totals.protein += Number(food.p || 0);
      totals.fat += Number(food.f || 0);
      totals.carbs += Number(food.c || 0);
    }
    return totals;
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 });
}

export function createSupabaseArchiveRepository(client: any) {
  const throwIfError = (error: any) => {
    if (error) throw new Error(error.message || 'Database operation failed');
  };

  return {
    async listEnabledSettings() {
      const { data, error } = await client
        .from('user_record_settings')
        .select('user_id, auto_archive_enabled, auto_archive_time, timezone')
        .eq('auto_archive_enabled', true);
      throwIfError(error);
      return data || [];
    },
    async hasArchiveLog(userId: string, archiveDate: string) {
      const { data, error } = await client
        .from('automatic_archive_log')
        .select('id')
        .eq('user_id', userId)
        .eq('archive_date', archiveDate)
        .maybeSingle();
      throwIfError(error);
      return Boolean(data);
    },
    async getExistingArchive(userId: string, archiveDate: string) {
      const { data, error } = await client
        .from('daily_archives')
        .select('id')
        .eq('user_id', userId)
        .eq('archive_date', archiveDate)
        .maybeSingle();
      throwIfError(error);
      return data || null;
    },
    async getTimeline(userId: string, archiveDate: string) {
      const { data, error } = await client
        .from('timeline_items')
        .select('*, food_entries(*)')
        .eq('user_id', userId)
        .eq('event_date', archiveDate)
        .order('event_time', { ascending: true });
      throwIfError(error);
      return data || [];
    },
    async upsertArchive(payload: Record<string, unknown>) {
      const { error } = await client
        .from('daily_archives')
        .upsert(payload, { onConflict: 'user_id,archive_date' });
      throwIfError(error);
    },
    async deleteTimeline(userId: string, archiveDate: string) {
      const { data, error } = await client
        .from('timeline_items')
        .delete()
        .eq('user_id', userId)
        .eq('event_date', archiveDate)
        .select('id');
      throwIfError(error);
      return data?.length || 0;
    },
    async insertArchiveLog(payload: Record<string, unknown>) {
      const { error } = await client
        .from('automatic_archive_log')
        .upsert(payload, { onConflict: 'user_id,archive_date', ignoreDuplicates: true });
      throwIfError(error);
    },
  };
}

async function archiveEligibleUser(
  repository: ReturnType<typeof createSupabaseArchiveRepository>,
  setting: Record<string, any>,
  now: Date,
) {
  const { dateStr: userToday, minutes: currentMinutes } = getZonedDateAndMinutes(now, setting.timezone);
  const configuredMinutes = parseTimeToMinutes(setting.auto_archive_time);

  if (currentMinutes < configuredMinutes) {
    return { archived: false, reason: 'archive-time-not-reached' };
  }

  const archiveDate = addDays(userToday, -MIN_ARCHIVE_AGE_DAYS);
  if (await repository.hasArchiveLog(setting.user_id, archiveDate)) {
    return { archived: false, reason: 'already-processed' };
  }

  const [existingArchive, rawTimeline] = await Promise.all([
    repository.getExistingArchive(setting.user_id, archiveDate),
    repository.getTimeline(setting.user_id, archiveDate),
  ]);
  const timeline = rawTimeline.map(normalizeTimelineItem);

  if (timeline.length > 0 || !existingArchive) {
    await repository.upsertArchive({
      user_id: setting.user_id,
      archive_date: archiveDate,
      archive_label: formatArchiveLabel(archiveDate),
      timeline,
      totals: sumTotals(timeline),
      is_completed: true,
      completed_at: now.toISOString(),
    });
  }

  // The durable archive must exist before the destructive statement. A failed
  // archive write therefore cannot delete timeline data. PostgreSQL executes
  // this single DELETE atomically, including cascading food_entries.
  const deletedCount = rawTimeline.length > 0
    ? await repository.deleteTimeline(setting.user_id, archiveDate)
    : 0;

  await repository.insertArchiveLog({
    user_id: setting.user_id,
    archive_date: archiveDate,
    archived_record_count: deletedCount,
  });

  return {
    archived: true,
    archiveDate,
    deletedCount,
  };
}

export function createAutoArchiveHandler({
  getSecret,
  createRepository,
  now = () => new Date(),
  logger = console,
}: {
  getSecret: () => string | undefined;
  createRepository: () => ReturnType<typeof createSupabaseArchiveRepository>;
  now?: () => Date;
  logger?: Pick<Console, 'info' | 'error'>;
}) {
  return async (request: Request) => {
    if (request.method !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    const expectedSecret = getSecret()?.trim();
    if (!expectedSecret) {
      logger.error('[auto-archive] cron secret is not configured');
      return jsonResponse(503, { error: 'Auto archive is not configured' });
    }

    const providedSecret = extractBearerSecret(request);
    if (!providedSecret.present) {
      return jsonResponse(401, { error: 'Authorization required' });
    }
    if (!providedSecret.value || !(await secretsMatch(providedSecret.value, expectedSecret))) {
      return jsonResponse(403, { error: 'Forbidden' });
    }

    try {
      // No repository/client is created before authentication succeeds.
      const repository = createRepository();
      const settings = await repository.listEnabledSettings();
      const summary = { processed: 0, skipped: 0, failed: 0 };

      for (const setting of settings) {
        try {
          const result = await archiveEligibleUser(repository, setting, now());
          if (result.archived) summary.processed += 1;
          else summary.skipped += 1;
        } catch {
          summary.failed += 1;
        }
      }

      logger.info('[auto-archive] run completed', summary);
      return jsonResponse(summary.failed > 0 ? 207 : 200, summary);
    } catch {
      logger.error('[auto-archive] run failed');
      return jsonResponse(500, { error: 'Auto archive failed' });
    }
  };
}
