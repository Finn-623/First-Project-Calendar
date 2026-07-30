import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('./024_food_database_runtime_permissions.sql', import.meta.url),
  'utf8'
);

test('makes food RLS policies reachable with least-purpose table grants', () => {
  assert.match(sql, /GRANT SELECT ON TABLE public\.foods TO anon/);
  assert.match(
    sql,
    /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.foods TO authenticated/
  );
  assert.match(sql, /GRANT ALL ON TABLE public\.foods TO service_role/);

  for (const table of ['food_portions', 'food_public_aliases']) {
    assert.match(sql, new RegExp(`GRANT SELECT ON TABLE public\\.${table} TO anon`));
    assert.match(
      sql,
      new RegExp(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\\.${table} TO authenticated`
      )
    );
  }

  assert.match(
    sql,
    /REVOKE ALL ON TABLE public\.food_private_aliases FROM PUBLIC, anon/
  );
  assert.match(
    sql,
    /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.food_private_aliases TO authenticated/
  );
});

test('keeps service-role setup and food snapshot operations reproducible', () => {
  for (const table of [
    'profiles',
    'foods',
    'food_portions',
    'food_public_aliases',
    'food_private_aliases',
    'timeline_items',
    'food_entries',
  ]) {
    assert.match(sql, new RegExp(`GRANT ALL ON TABLE public\\.${table} TO service_role`));
  }
  assert.match(
    sql,
    /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.food_entries TO authenticated/
  );
});

test('ordinary users cannot assign or change administrator role', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.prevent_profile_role_escalation/);
  assert.match(sql, /auth\.role\(\) = 'service_role'/);
  assert.match(sql, /TG_OP = 'INSERT' AND NEW\.role IS DISTINCT FROM 'user'/);
  assert.match(sql, /TG_OP = 'UPDATE' AND NEW\.role IS DISTINCT FROM OLD\.role/);
  assert.match(sql, /BEFORE INSERT OR UPDATE OF role ON public\.profiles/);
});

test('rejects aliases when RLS makes the related food invisible', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.enforce_food_alias_relationship/);
  assert.match(sql, /IF target_food\.id IS NULL THEN/);
  assert.match(sql, /alias target food is not visible/);
  assert.match(sql, /target_food\.user_id = NEW\.user_id/);
});
