import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const migrationPath = path.join(import.meta.dirname, '035_feedback_user_priority_version_number.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

test('adds submitted priority, target version, and version-scoped counters', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS submitted_priority TEXT/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS target_version TEXT/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.version_feedback_counters/);
  assert.match(sql, /version_number TEXT PRIMARY KEY/);
  assert.match(sql, /next_sequence INTEGER NOT NULL/);
  assert.match(sql, /version_feedback_submitted_priority_check/);
  assert.match(sql, /version_feedback_target_version_check/);
    assert.match(sql, /CHECK \(feedback_number ~ '\^FB-v/);
    assert.match(sql, /-\[0-9\]\{3\}\$'\)/);
});

test('backfills historical rows and allocates the next version-local number safely', () => {
  assert.match(sql, /completed_version/);
  assert.match(sql, /target_version :=/);
  assert.ok(sql.indexOf('DISABLE TRIGGER trg_version_feedback_enforce_update') < sql.indexOf('UPDATE public.version_feedback\nSET submitted_priority'));
  assert.ok(sql.indexOf('ENABLE TRIGGER trg_version_feedback_enforce_update') > sql.indexOf('feedback_number = format'));
    assert.match(sql, /ROW_NUMBER\(\) OVER \([\s\S]*?PARTITION BY target_version[\s\S]*?ORDER BY created_at ASC, id ASC[\s\S]*?\)::INTEGER AS row_number/);
  assert.match(sql, /ON CONFLICT \(version_number\) DO UPDATE/);
  assert.match(sql, /next_version_feedback_number\(TEXT\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /CREATE TRIGGER trg_version_feedback_assign_number/);
});

test('protects original priority and number while preserving administrator updates', () => {
  assert.match(sql, /NEW\.submitted_priority IS DISTINCT FROM OLD\.submitted_priority/);
  assert.match(sql, /NEW\.feedback_number IS DISTINCT FROM OLD\.feedback_number/);
  assert.match(sql, /NEW\.priority_assigned_at := NOW\(\)/);
  assert.match(sql, /NEW\.priority_assigned_by := auth\.uid\(\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.set_version_feedback_priority/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.next_version_feedback_number\(TEXT\) FROM PUBLIC/);
});

test('allows authenticated users to submit only a validated original priority', () => {
  assert.match(sql, /CREATE POLICY version_feedback_insert_own/);
  assert.match(sql, /submitted_priority IN \('P0', 'P1', 'P2', 'P3'\)/);
  assert.match(sql, /target_version ~/);
  assert.match(sql, /submitted_priority IN \('P0', 'P1', 'P2', 'P3'\)/);
  assert.match(sql, /priority := NEW\.submitted_priority/);
});
