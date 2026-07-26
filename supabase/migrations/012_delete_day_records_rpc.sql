-- Atomic full-day deletion for history list cards
-- Deletes only the authenticated user's records for the target date.

CREATE OR REPLACE FUNCTION public.delete_day_records(target_date DATE)
RETURNS TABLE (
  deleted_timeline_items INTEGER,
  deleted_daily_archives INTEGER
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

  WITH removed_timeline AS (
    DELETE FROM public.timeline_items
    WHERE user_id = current_user_id
      AND event_date = target_date
    RETURNING id
  ),
  removed_archives AS (
    DELETE FROM public.daily_archives
    WHERE user_id = current_user_id
      AND archive_date = target_date
    RETURNING id
  )
  SELECT
    COALESCE((SELECT COUNT(*)::INTEGER FROM removed_timeline), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM removed_archives), 0)
  INTO deleted_timeline_items, deleted_daily_archives;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_day_records(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_day_records(DATE) TO authenticated;
