-- Separate personal food deactivation from permanent deletion.
-- Historical food_entries block deletion; non-historical child rows are removed in this transaction.

CREATE OR REPLACE FUNCTION public.delete_personal_food_permanently(
  p_food_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id UUID := auth.uid();
  food_row public.foods%ROWTYPE;
  usage_count INTEGER;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT *
  INTO food_row
  FROM public.foods
  WHERE id = p_food_id
    AND user_id = caller_id
    AND visibility = 'private'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'personal food not found or not owned by caller';
  END IF;

  SELECT COUNT(*)
  INTO usage_count
  FROM public.food_entries
  WHERE source_food_id = p_food_id;

  IF usage_count > 0 THEN
    RAISE EXCEPTION 'personal food is used by historical records and cannot be permanently deleted';
  END IF;

  DELETE FROM public.favorite_foods
  WHERE food_id = p_food_id
    AND user_id = caller_id;

  DELETE FROM public.food_private_aliases
  WHERE food_id = p_food_id
    AND user_id = caller_id;

  DELETE FROM public.food_portions
  WHERE food_id = p_food_id;

  DELETE FROM public.foods
  WHERE id = p_food_id
    AND user_id = caller_id
    AND visibility = 'private';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'personal food was not deleted';
  END IF;

  RETURN jsonb_build_object('deleted', TRUE, 'food_id', p_food_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_personal_food_permanently(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_personal_food_permanently(UUID) TO authenticated;

COMMENT ON FUNCTION public.delete_personal_food_permanently(UUID) IS
  'Permanently deletes only the caller''s private food when no food_entries reference it; child aliases, portions and favorites are removed atomically.';

NOTIFY pgrst, 'reload schema';
