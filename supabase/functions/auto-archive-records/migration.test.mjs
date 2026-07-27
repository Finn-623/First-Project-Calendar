import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../../migrations/020_auto_archive_transaction.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('归档、删除和日志位于同一个数据库函数事务中', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.auto_archive_user_records/);
  assert.match(sql, /INSERT INTO public\.daily_archives/);
  assert.match(sql, /DELETE FROM public\.timeline_items/);
  assert.match(sql, /INSERT INTO public\.automatic_archive_log/);
});

test('同一用户日期串行执行，并阻止快照与删除之间的数据写入', () => {
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /LOCK TABLE public\.timeline_items IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(sql, /LOCK TABLE public\.food_entries IN SHARE ROW EXCLUSIVE MODE/);
});

test('RPC 在事务内复核启用状态、归档日期和防重日志', () => {
  assert.match(sql, /auto_archive_enabled = TRUE/);
  assert.match(sql, /target_date <> local_now::DATE - 1/);
  assert.match(sql, /automatic_archive_log[\s\S]*already_processed/);
});

test('RPC 只授权 service_role 执行', () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC/);
  assert.match(sql, /FROM anon/);
  assert.match(sql, /FROM authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/);
});
