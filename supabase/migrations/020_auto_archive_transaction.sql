-- Atomically snapshot and remove one eligible user's previous-day timeline.
-- The Edge Function calls this RPC only after independent server-secret auth.

CREATE OR REPLACE FUNCTION public.auto_archive_user_records(
  target_user_id UUID,
  target_date DATE
)
RETURNS TABLE (
  result_status TEXT,
  deleted_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  settings_row public.user_record_settings%ROWTYPE;
  local_now TIMESTAMP;
  existing_timeline JSONB;
  new_timeline_snapshot JSONB;
  timeline_snapshot JSONB;
  nutrition_totals JSONB;
  timeline_count INTEGER;
  existing_archive BOOLEAN;
  archive_already_logged BOOLEAN;
  target_timeline_ids UUID[];
BEGIN
  -- Serialize retries for the same user/date.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(target_user_id::TEXT || ':' || target_date::TEXT, 0)
  );

  SELECT *
  INTO settings_row
  FROM public.user_record_settings
  WHERE user_id = target_user_id
    AND auto_archive_enabled = TRUE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'disabled'::TEXT, 0;
    RETURN;
  END IF;

  local_now := clock_timestamp() AT TIME ZONE settings_row.timezone;
  IF target_date <> local_now::DATE - 1
     OR local_now::TIME < settings_row.auto_archive_time THEN
    RETURN QUERY SELECT 'ineligible'::TEXT, 0;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.automatic_archive_log
    WHERE user_id = target_user_id
      AND archive_date = target_date
  )
  INTO archive_already_logged;

  -- Lock only the rows included in this snapshot. New rows inserted after this
  -- point are not part of target_timeline_ids and therefore cannot be deleted
  -- by this invocation.
  SELECT COALESCE(array_agg(locked.id ORDER BY locked.event_time, locked.sort_order, locked.id), ARRAY[]::UUID[])
  INTO target_timeline_ids
  FROM (
    SELECT id, event_time, sort_order
    FROM public.timeline_items
    WHERE user_id = target_user_id
      AND event_date = target_date
    FOR UPDATE
  ) AS locked;

  PERFORM 1
  FROM public.food_entries
  WHERE timeline_item_id = ANY(target_timeline_ids)
  FOR UPDATE;

  IF archive_already_logged AND cardinality(target_timeline_ids) = 0 THEN
    RETURN QUERY SELECT 'already_processed'::TEXT, 0;
    RETURN;
  END IF;

  SELECT timeline
  INTO existing_timeline
  FROM public.daily_archives
  WHERE user_id = target_user_id
    AND archive_date = target_date
  FOR UPDATE;

  existing_archive := FOUND;
  existing_timeline := COALESCE(existing_timeline, '[]'::JSONB);

  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', ti.id,
            'type', CASE
              WHEN ti.item_type IN ('breakfast', 'lunch', 'dinner', 'snack') THEN 'meal'
              WHEN ti.item_type = 'anaerobic_training' THEN 'anaerobic'
              WHEN ti.item_type = 'aerobic_training' THEN 'aerobic'
              ELSE 'event'
            END,
            'subtype', CASE
              WHEN ti.item_type IN ('breakfast', 'lunch', 'dinner', 'snack') THEN ti.item_type
              ELSE NULL
            END,
            'title', ti.title,
            'time', ti.event_time,
            'fixed', COALESCE((ti.details ->> 'fixed')::BOOLEAN, FALSE),
            'foods', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'entryId', fe.id,
                    'id', COALESCE(fe.source_food_id, fe.id),
                    'name', fe.food_name_snapshot,
                    'grams', fe.quantity,
                    'cal', fe.calories_snapshot,
                    'p', fe.protein_snapshot,
                    'f', fe.fat_snapshot,
                    'c', fe.carbs_snapshot
                  )
                  ORDER BY fe.created_at, fe.id
                )
                FROM public.food_entries fe
                WHERE fe.timeline_item_id = ti.id
              ),
              '[]'::JSONB
            ),
            'detail', COALESCE(ti.notes, ''),
            'notes', ti.notes,
            'snackType', ti.details -> 'snackType',
            'bodyParts', ti.details -> 'bodyParts',
            'status', COALESCE(ti.status, 'completed'),
            'started_at', ti.started_at,
            'ended_at', ti.ended_at,
            'duration_minutes', ti.duration_minutes,
            'caloriesBurned', COALESCE(
              (ti.details ->> 'caloriesBurned')::NUMERIC,
              0
            )
          )
        )
        ORDER BY ti.event_time, ti.sort_order, ti.id
      ),
      '[]'::JSONB
    ),
    COUNT(*)::INTEGER
  INTO new_timeline_snapshot, timeline_count
  FROM public.timeline_items ti
  WHERE ti.id = ANY(target_timeline_ids);

  -- Preserve an existing archive and merge newly observed rows by timeline ID.
  -- This also makes a retry after a late insert additive instead of replacing
  -- the previously committed snapshot.
  SELECT COALESCE(jsonb_agg(deduplicated.item ORDER BY deduplicated.ordinality), '[]'::JSONB)
  INTO timeline_snapshot
  FROM (
    SELECT DISTINCT ON (item ->> 'id') item, ordinality
    FROM jsonb_array_elements(existing_timeline || new_timeline_snapshot)
      WITH ORDINALITY AS combined(item, ordinality)
    ORDER BY item ->> 'id', ordinality DESC
  ) AS deduplicated;

  SELECT jsonb_build_object(
    'calories', COALESCE(SUM((food ->> 'cal')::NUMERIC), 0),
    'protein', COALESCE(SUM((food ->> 'p')::NUMERIC), 0),
    'fat', COALESCE(SUM((food ->> 'f')::NUMERIC), 0),
    'carbs', COALESCE(SUM((food ->> 'c')::NUMERIC), 0)
  )
  INTO nutrition_totals
  FROM jsonb_array_elements(timeline_snapshot) AS item(value)
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(item.value -> 'foods', '[]'::JSONB)
  ) AS foods(food);

  IF timeline_count > 0 OR NOT existing_archive THEN
    INSERT INTO public.daily_archives (
      user_id,
      archive_date,
      archive_label,
      timeline,
      totals,
      is_completed,
      completed_at
    )
    VALUES (
      target_user_id,
      target_date,
      EXTRACT(MONTH FROM target_date)::INTEGER || '月'
        || EXTRACT(DAY FROM target_date)::INTEGER || '日 · '
        || CASE EXTRACT(DOW FROM target_date)::INTEGER
          WHEN 0 THEN '周日'
          WHEN 1 THEN '周一'
          WHEN 2 THEN '周二'
          WHEN 3 THEN '周三'
          WHEN 4 THEN '周四'
          WHEN 5 THEN '周五'
          ELSE '周六'
        END,
      timeline_snapshot,
      nutrition_totals,
      TRUE,
      clock_timestamp()
    )
    ON CONFLICT (user_id, archive_date)
    DO UPDATE SET
      archive_label = EXCLUDED.archive_label,
      timeline = EXCLUDED.timeline,
      totals = EXCLUDED.totals,
      is_completed = TRUE,
      completed_at = EXCLUDED.completed_at;
  END IF;

  DELETE FROM public.timeline_items
  WHERE id = ANY(target_timeline_ids)
    AND user_id = target_user_id
    AND event_date = target_date;
  GET DIAGNOSTICS timeline_count = ROW_COUNT;

  INSERT INTO public.automatic_archive_log (
    user_id,
    archive_date,
    archived_record_count
  )
  VALUES (target_user_id, target_date, timeline_count)
  ON CONFLICT (user_id, archive_date)
  DO UPDATE SET
    archived_record_count = public.automatic_archive_log.archived_record_count
      + EXCLUDED.archived_record_count,
    archived_at = clock_timestamp();

  RETURN QUERY SELECT 'archived'::TEXT, timeline_count;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_archive_user_records(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_archive_user_records(UUID, DATE) FROM anon;
REVOKE ALL ON FUNCTION public.auto_archive_user_records(UUID, DATE) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auto_archive_user_records(UUID, DATE) TO service_role;

NOTIFY pgrst, 'reload schema';
