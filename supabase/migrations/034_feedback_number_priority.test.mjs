import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const migrationPath = path.join(import.meta.dirname, '034_feedback_number_priority.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

test('adds database-owned annual feedback numbers and priority fields', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.version_feedback_number_counters/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS feedback_number TEXT/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'P2'/);
  assert.match(sql, /version_feedback_priority_check/);
  assert.match(sql, /feedback_number ~ '\^FB-\[0-9\]\{4\}-\[0-9\]\{4\}\$'/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_version_feedback_number_unique/);
});

test('allocates numbers in the database and audits administrator priority changes', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.next_version_feedback_number\(\)/);
  assert.match(sql, /ON CONFLICT \(feedback_year\) DO UPDATE/);
  assert.match(sql, /CREATE TRIGGER trg_version_feedback_assign_number/);
  assert.match(sql, /DISABLE TRIGGER trg_version_feedback_enforce_update/);
  assert.match(sql, /ENABLE TRIGGER trg_version_feedback_enforce_update/);
  assert.match(sql, /NEW\.feedback_number := public\.next_version_feedback_number\(\)/);
  assert.match(sql, /NEW\.priority_assigned_at := NOW\(\)/);
  assert.match(sql, /NEW\.priority_assigned_by := auth\.uid\(\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.set_version_feedback_priority/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.set_version_feedback_priority\(UUID, TEXT\) TO authenticated/);
});