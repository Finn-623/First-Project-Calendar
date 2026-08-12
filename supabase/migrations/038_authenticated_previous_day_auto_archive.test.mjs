import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const sql = fs.readFileSync(path.join(import.meta.dirname, '038_authenticated_previous_day_auto_archive.sql'), 'utf8');

test('archives only the authenticated caller through the existing transactional core', () => {
  assert.match(sql, /caller_id UUID := auth\.uid\(\)/);
  assert.match(sql, /IF caller_id IS NULL/);
  assert.match(sql, /auto_archive_user_records\(caller_id, target_date\)/);
  assert.doesNotMatch(sql, /target_user_id/);
});

test('is authenticated-only and keeps anonymous callers blocked', () => {
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.auto_archive_my_previous_day\(DATE\) FROM PUBLIC/);
  assert.match(sql, /FROM anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.auto_archive_my_previous_day\(DATE\) TO authenticated/);
});
