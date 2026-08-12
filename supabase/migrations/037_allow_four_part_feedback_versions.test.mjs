import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const sql = fs.readFileSync(path.join(import.meta.dirname, '037_allow_four_part_feedback_versions.sql'), 'utf8');

test('accepts current four-part versions in the table and feedback number constraints', () => {
  assert.match(sql, /version_feedback_target_version_check/);
  assert.match(sql, /version_feedback_number_format_check/);
  assert.ok((sql.match(/\(\\\.\[0-9\]\+\)\?/g) || []).length >= 3);
});

test('keeps authenticated ownership, pending-only inserts, and priority validation', () => {
  assert.match(sql, /CREATE POLICY version_feedback_insert_own/);
  assert.match(sql, /TO authenticated/);
  assert.match(sql, /user_id = auth\.uid\(\)/);
  assert.match(sql, /status = 'pending'/);
  assert.match(sql, /completed_at IS NULL/);
  assert.match(sql, /submitted_priority IN \('P0', 'P1', 'P2', 'P3'\)/);
});

test('updates the atomic version counter allocator without exposing it', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.next_version_feedback_number\(target_version_input TEXT\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /ON CONFLICT \(version_number\) DO UPDATE/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.next_version_feedback_number\(TEXT\) FROM PUBLIC/);
});
