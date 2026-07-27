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
    async archiveUser(userId: string, archiveDate: string) {
      const { data, error } = await client.rpc('auto_archive_user_records', {
        target_user_id: userId,
        target_date: archiveDate,
      });
      throwIfError(error);
      return Array.isArray(data) ? data[0] : data;
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
  const result = await repository.archiveUser(setting.user_id, archiveDate);

  return {
    archived: result?.result_status === 'archived',
    reason: result?.result_status,
    archiveDate,
    deletedCount: Number(result?.deleted_count || 0),
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
