-- Allow an authenticated app session to catch up its own previous business day
-- using the same transactional RPC as the scheduled Edge Function.

CREATE OR REPLACE FUNCTION public.auto_archive_my_previous_day(target_date DATE)
RETURNS TABLE (
  result_status TEXT,
  deleted_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id UUID := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  RETURN QUERY
  SELECT result.result_status, result.deleted_count
  FROM public.auto_archive_user_records(caller_id, target_date) AS result;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_archive_my_previous_day(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_archive_my_previous_day(DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.auto_archive_my_previous_day(DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
