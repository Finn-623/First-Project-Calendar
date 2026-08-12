import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('./039_daily_archive_realtime_consistency.sql', import.meta.url), 'utf8');

test('publishes full daily archive changes for date-scoped invalidation', () => {
  assert.match(sql, /ALTER TABLE public\.daily_archives REPLICA IDENTITY FULL/i);
  assert.match(sql, /tablename = 'daily_archives'/i);
  assert.match(sql, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.daily_archives/i);
});
