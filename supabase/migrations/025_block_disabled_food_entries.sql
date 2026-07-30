-- v0.2.1 prevent new food-entry references to unavailable foods.
-- Existing snapshots remain readable and editable after a source food is
-- disabled. Validation runs only when a source reference is first assigned or
-- changed, and applies equally to authenticated, admin, and service roles.

CREATE OR REPLACE FUNCTION public.enforce_food_entry_source_available()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_is_available BOOLEAN := FALSE;
BEGIN
  IF NEW.source_food_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.source_food_id IS NOT DISTINCT FROM OLD.source_food_id
  THEN
    RETURN NEW;
  END IF;

  SELECT (
    review_status = 'approved'
    AND is_active = TRUE
  )
  INTO source_is_available
  FROM public.foods
  WHERE id = NEW.source_food_id;

  IF NOT COALESCE(source_is_available, FALSE) THEN
    RAISE EXCEPTION 'source food is not available for new entries';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_food_entry_source_available() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_food_entries_require_available_source
  ON public.food_entries;
CREATE TRIGGER trg_food_entries_require_available_source
BEFORE INSERT OR UPDATE OF source_food_id ON public.food_entries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_food_entry_source_available();

NOTIFY pgrst, 'reload schema';
