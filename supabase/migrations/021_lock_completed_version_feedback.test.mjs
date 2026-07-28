import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('./021_lock_completed_version_feedback.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('completed feedback content is protected while admin status management remains', () => {
  assert.match(sql, /OLD\.status = 'completed'/);
  assert.match(sql, /completed feedback content is read only/);
  assert.match(sql, /IF NOT is_admin/);
  assert.match(sql, /NEW\.status = 'completed'/);
  assert.match(sql, /NEW\.status := 'pending'/);
});

test('completed feedback delete is rejected for application callers', () => {
  assert.match(sql, /prevent_completed_version_feedback_delete/);
  assert.match(sql, /BEFORE DELETE ON public\.version_feedback/);
  assert.match(sql, /completed feedback cannot be deleted/);
  assert.match(sql, /auth\.role\(\)[\s\S]*service_role/);
});

test('owner update and delete policies only allow pending feedback', () => {
  assert.match(sql, /CREATE POLICY version_feedback_update_own[\s\S]*status = 'pending'/);
  assert.match(sql, /CREATE POLICY version_feedback_delete_own[\s\S]*status = 'pending'/);
});
