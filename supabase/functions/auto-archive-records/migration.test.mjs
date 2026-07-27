import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration015Url = new URL('../../migrations/015_version_feedback_tasks.sql', import.meta.url);
const migration016Url = new URL('../../migrations/016_version_feedback_history_enhancements.sql', import.meta.url);
const migration020Url = new URL('../../migrations/020_auto_archive_transaction.sql', import.meta.url);
const preflightUrl = new URL('../../preflight/v0.1.2_migrations_014_020_readonly.sql', import.meta.url);
const [sql015, sql016, sql020, preflightSql] = await Promise.all([
  readFile(migration015Url, 'utf8'),
  readFile(migration016Url, 'utf8'),
  readFile(migration020Url, 'utf8'),
  readFile(preflightUrl, 'utf8'),
]);

test('归档、删除和日志位于同一个数据库函数事务中', () => {
  assert.match(sql020, /CREATE OR REPLACE FUNCTION public\.auto_archive_user_records/);
  assert.match(sql020, /INSERT INTO public\.daily_archives/);
  assert.match(sql020, /DELETE FROM public\.timeline_items/);
  assert.match(sql020, /INSERT INTO public\.automatic_archive_log/);
});

test('同一用户日期串行执行，只锁定并删除本次快照记录', () => {
  assert.match(sql020, /pg_advisory_xact_lock/);
  assert.match(sql020, /FOR UPDATE/);
  assert.match(sql020, /target_timeline_ids/);
  assert.doesNotMatch(sql020, /LOCK TABLE/);
  assert.match(sql020, /WHERE id = ANY\(target_timeline_ids\)/);
});

test('RPC 在事务内复核启用状态、归档日期和防重日志', () => {
  assert.match(sql020, /auto_archive_enabled = TRUE/);
  assert.match(sql020, /target_date <> local_now::DATE - 1/);
  assert.match(sql020, /automatic_archive_log[\s\S]*already_processed/);
});

test('RPC 只授权 service_role 执行', () => {
  assert.match(sql020, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC/);
  assert.match(sql020, /FROM anon/);
  assert.match(sql020, /FROM authenticated/);
  assert.match(sql020, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/);
});

test('015 只替换已知 policy，不遍历删除全部生产 policy', () => {
  assert.doesNotMatch(sql015, /FOR policy_name IN/);
  assert.doesNotMatch(sql015, /format\('DROP POLICY/);
  assert.match(sql015, /DROP POLICY IF EXISTS version_feedback_select_own_or_admin/);
});

test('016 保留 legacy completed 数据且 policy 可独立重复执行', () => {
  assert.doesNotMatch(
    sql016,
    /WHERE status = 'completed' AND \(completed_version IS NULL/,
  );
  assert.match(sql016, /completed_version IS NULL/);
  assert.match(sql016, /policyname = 'version_feedback_update_own'/);
  assert.match(sql016, /policyname = 'version_feedback_update_admin'/);
  assert.match(sql016, /policyname = 'version_feedback_delete_own'/);
});

test('生产预检文件只包含只读查询', () => {
  const statementsOnly = preflightSql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
  assert.doesNotMatch(
    statementsOnly,
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/i,
  );
  assert.match(statementsOnly, /FROM public\.profiles/);
  assert.match(statementsOnly, /FROM pg_policies/);
  assert.match(statementsOnly, /FROM information_schema\.columns/);
});
