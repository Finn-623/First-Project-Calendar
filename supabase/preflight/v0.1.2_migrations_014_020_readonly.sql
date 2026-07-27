-- v0.1.2 migrations 014-020 production preflight.
-- Every statement is read-only. Run each numbered section separately so a
-- missing optional table or column does not prevent later structural checks.

-- 1) Profiles rows that would violate migration 014 constraints.
SELECT
  id,
  gender,
  birth_date,
  height_cm,
  weight_kg
FROM public.profiles
WHERE (gender IS NOT NULL AND gender NOT IN ('male', 'female', 'other', 'prefer_not_to_say'))
   OR (birth_date IS NOT NULL AND birth_date > CURRENT_DATE)
   OR (height_cm IS NOT NULL AND (height_cm < 50 OR height_cm > 250))
   OR (weight_kg IS NOT NULL AND (weight_kg < 20 OR weight_kg > 500));

-- 2a) Current version_feedback columns. Check this result before running 2b.
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'version_feedback'
ORDER BY ordinal_position;

-- 2b) Version feedback state compatibility. Run only when the table and the
-- completed_version column shown by 2a already exist.
SELECT
  status,
  COUNT(*) AS row_count,
  COUNT(*) FILTER (WHERE completed_at IS NULL) AS missing_completed_at,
  COUNT(*) FILTER (
    WHERE completed_version IS NULL OR char_length(trim(completed_version)) = 0
  ) AS missing_completed_version
FROM public.version_feedback
GROUP BY status
ORDER BY status;

-- 3) Policies not owned by migrations 015-016. Any returned row needs review.
WITH repository_policies(policyname) AS (
  VALUES
    ('version_feedback_select_own_or_admin'),
    ('version_feedback_insert_own'),
    ('version_feedback_update_admin_only'),
    ('version_feedback_update_own'),
    ('version_feedback_update_admin'),
    ('version_feedback_delete_own')
)
SELECT
  p.policyname,
  p.cmd,
  p.roles,
  p.qual,
  p.with_check
FROM pg_policies AS p
LEFT JOIN repository_policies AS known USING (policyname)
WHERE p.schemaname = 'public'
  AND p.tablename = 'version_feedback'
  AND known.policyname IS NULL
ORDER BY p.policyname;

-- 4a) Current daily_targets calculated_field column. Check before running 4b.
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_targets'
  AND column_name = 'calculated_field';

-- 4b) Existing calculated_field values. Run only when 4a returns one row.
SELECT
  calculated_field,
  COUNT(*) AS row_count
FROM public.daily_targets
GROUP BY calculated_field
ORDER BY calculated_field;

-- 5) Tables required by migration 019 and the automatic archive workflow.
SELECT
  required.table_name,
  to_regclass('public.' || required.table_name) IS NOT NULL AS exists_in_public
FROM (
  VALUES
    ('user_record_settings'),
    ('automatic_archive_log')
) AS required(table_name)
ORDER BY required.table_name;

-- 6a) Tables required by migration 020.
SELECT
  required.table_name,
  to_regclass('public.' || required.table_name) IS NOT NULL AS exists_in_public
FROM (
  VALUES
    ('user_record_settings'),
    ('automatic_archive_log'),
    ('timeline_items'),
    ('food_entries'),
    ('daily_archives')
) AS required(table_name)
ORDER BY required.table_name;

-- 6b) Columns required by migration 020. Missing requirements are returned.
WITH required_columns(table_name, column_name) AS (
  VALUES
    ('user_record_settings', 'user_id'),
    ('user_record_settings', 'auto_archive_enabled'),
    ('user_record_settings', 'auto_archive_time'),
    ('user_record_settings', 'timezone'),
    ('automatic_archive_log', 'user_id'),
    ('automatic_archive_log', 'archive_date'),
    ('automatic_archive_log', 'archived_record_count'),
    ('timeline_items', 'id'),
    ('timeline_items', 'user_id'),
    ('timeline_items', 'event_date'),
    ('timeline_items', 'event_time'),
    ('timeline_items', 'sort_order'),
    ('timeline_items', 'item_type'),
    ('timeline_items', 'title'),
    ('timeline_items', 'notes'),
    ('timeline_items', 'details'),
    ('timeline_items', 'status'),
    ('timeline_items', 'started_at'),
    ('timeline_items', 'ended_at'),
    ('timeline_items', 'duration_minutes'),
    ('food_entries', 'id'),
    ('food_entries', 'timeline_item_id'),
    ('food_entries', 'source_food_id'),
    ('food_entries', 'food_name_snapshot'),
    ('food_entries', 'quantity'),
    ('food_entries', 'calories_snapshot'),
    ('food_entries', 'protein_snapshot'),
    ('food_entries', 'fat_snapshot'),
    ('food_entries', 'carbs_snapshot'),
    ('daily_archives', 'user_id'),
    ('daily_archives', 'archive_date'),
    ('daily_archives', 'archive_label'),
    ('daily_archives', 'timeline'),
    ('daily_archives', 'totals'),
    ('daily_archives', 'is_completed'),
    ('daily_archives', 'completed_at')
)
SELECT required_columns.*
FROM required_columns
LEFT JOIN information_schema.columns AS actual
  ON actual.table_schema = 'public'
 AND actual.table_name = required_columns.table_name
 AND actual.column_name = required_columns.column_name
WHERE actual.column_name IS NULL
ORDER BY required_columns.table_name, required_columns.column_name;

-- 6c) Unique constraints required for idempotency.
SELECT
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
WHERE tc.constraint_schema = 'public'
  AND tc.constraint_type = 'UNIQUE'
  AND tc.table_name IN ('daily_archives', 'automatic_archive_log')
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;

-- 6d) food_entries foreign key and its action on timeline deletion.
SELECT
  tc.constraint_name,
  kcu.table_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
WHERE tc.constraint_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.table_name = 'food_entries'
  AND kcu.column_name = 'timeline_item_id';
