import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('./027_public_food_review_workflow.sql', import.meta.url),
  'utf8'
);

test('adds review attribution and immutable transition audit', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth\.users/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS review_note TEXT/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.food_review_events/);
  assert.match(sql, /previous_status <> next_status/);
});

test('review RPC trusts server-side administrator identity only', () => {
  assert.match(sql, /reviewer_id UUID := auth\.uid\(\)/);
  assert.match(sql, /NOT public\.is_app_admin\(reviewer_id\)/);
  assert.doesNotMatch(sql, /p_role|p_user_id|p_is_admin/);
  assert.match(sql, /visibility <> 'public' OR food_row\.user_id IS NOT NULL/);
});

test('supports controlled transitions, idempotency, and a 50 item maximum', () => {
  assert.match(sql, /target_status NOT IN \('pending', 'approved', 'disabled'\)/);
  assert.match(sql, /cardinality\(p_food_ids\) > 50/);
  assert.match(sql, /duplicate_id/);
  assert.match(sql, /already_in_status/);
  assert.match(sql, /success_items/);
  assert.match(sql, /failed_items/);
  assert.match(sql, /skipped_items/);
});

test('every successful transition updates attribution and inserts an audit event', () => {
  assert.match(sql, /review_status = target_status/);
  assert.match(sql, /is_active = target_status <> 'disabled'/);
  assert.match(sql, /reviewed_by = reviewer_id/);
  assert.match(sql, /INSERT INTO public\.food_review_events/);
});

test('anonymous, ordinary users, and service role cannot invoke review RPC', () => {
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.review_public_foods\(UUID\[\], TEXT, TEXT\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.review_public_foods\(UUID\[\], TEXT, TEXT\)[\s\S]*TO authenticated/
  );
});

test('migration does not rewrite source identity, nutrients, or historical snapshots', () => {
  assert.doesNotMatch(sql, /UPDATE public\.food_entries/);
  assert.doesNotMatch(sql, /UPDATE public\.daily_archives/);
  assert.doesNotMatch(sql, /source_name\s*=/);
  assert.doesNotMatch(sql, /external_food_id\s*=/);
});
