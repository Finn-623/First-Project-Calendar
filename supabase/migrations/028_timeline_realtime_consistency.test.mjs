import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('./028_timeline_realtime_consistency.sql', import.meta.url), 'utf8');

test('enables complete realtime delete payloads for timeline tables', () => {
  assert.match(sql, /timeline_items REPLICA IDENTITY FULL/i);
  assert.match(sql, /food_entries REPLICA IDENTITY FULL/i);
  assert.match(sql, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.timeline_items/i);
  assert.match(sql, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.food_entries/i);
});

test('prevents duplicate default meals without constraining custom meals', () => {
  assert.match(sql, /UNIQUE INDEX[\s\S]*user_id, event_date, item_type/i);
  assert.match(sql, /WHERE item_type IN \('breakfast', 'lunch', 'dinner'\)/i);
  assert.doesNotMatch(sql, /WHERE item_type IN[^;]*'snack'/i);
});
