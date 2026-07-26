-- Atomic batch deletion for selected history dates.
-- Deletes only the authenticated user's records for target dates.

CREATE OR REPLACE FUNCTION public.delete_history_days(target_dates DATE[])
RETURNS TABLE (
  deleted_timeline_items INTEGER,
  deleted_daily_archives INTEGER,
  deleted_days INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH selected_dates AS (
    SELECT DISTINCT d::DATE AS target_date
    FROM unnest(COALESCE(target_dates, ARRAY[]::DATE[])) AS d
    WHERE d IS NOT NULL
  ),
  removed_timeline AS (
    DELETE FROM public.timeline_items ti
    USING selected_dates sd
    WHERE ti.user_id = current_user_id
      AND ti.event_date = sd.target_date
    RETURNING ti.id
  ),
  removed_archives AS (
    DELETE FROM public.daily_archives da
    USING selected_dates sd
    WHERE da.user_id = current_user_id
      AND da.archive_date = sd.target_date
    RETURNING da.id
  )
  SELECT
    COALESCE((SELECT COUNT(*)::INTEGER FROM removed_timeline), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM removed_archives), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM selected_dates), 0)
  INTO deleted_timeline_items, deleted_daily_archives, deleted_days;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_history_days(DATE[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_history_days(DATE[]) TO authenticated;
