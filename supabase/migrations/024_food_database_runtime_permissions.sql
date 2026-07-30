-- v0.2.1 local runtime permission hardening.
-- RLS policies still decide which rows are visible or writable. These grants
-- only make the policies reachable through PostgREST after a clean migration
-- replay, where dashboard-created implicit table grants do not exist.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON TABLE public.foods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.foods TO authenticated;
GRANT ALL ON TABLE public.foods TO service_role;

GRANT SELECT ON TABLE public.food_portions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.food_portions TO authenticated;
GRANT ALL ON TABLE public.food_portions TO service_role;

GRANT SELECT ON TABLE public.food_public_aliases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.food_public_aliases TO authenticated;
GRANT ALL ON TABLE public.food_public_aliases TO service_role;

REVOKE ALL ON TABLE public.food_private_aliases FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.food_private_aliases TO authenticated;
GRANT ALL ON TABLE public.food_private_aliases TO service_role;

-- The integration setup and the application both require profile access.
-- service_role is the only role allowed to assign administrator status.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'user' THEN
    RAISE EXCEPTION 'administrator role may only be assigned by service role';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'administrator role may only be assigned by service role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_role_escalation
  ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_role_escalation
BEFORE INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- 022 validates alias ownership through the related food. Under RLS an
-- invisible food produces an empty row, and SQL three-valued logic must not
-- turn that absence into an accepted relationship.
CREATE OR REPLACE FUNCTION public.enforce_food_alias_relationship()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_food public.foods%ROWTYPE;
BEGIN
  SELECT *
  INTO target_food
  FROM public.foods
  WHERE id = NEW.food_id;

  IF target_food.id IS NULL THEN
    RAISE EXCEPTION 'alias target food is not visible';
  END IF;

  IF TG_TABLE_NAME = 'food_public_aliases' THEN
    IF target_food.visibility IS DISTINCT FROM 'public' THEN
      RAISE EXCEPTION 'public aliases must reference a public food';
    END IF;
  ELSIF NOT (
    target_food.visibility = 'public'
    OR (
      target_food.visibility = 'private'
      AND target_food.user_id = NEW.user_id
    )
  ) THEN
    RAISE EXCEPTION 'private aliases may only reference visible foods';
  END IF;

  RETURN NEW;
END;
$$;

-- Existing food-entry snapshots are part of the food compatibility contract.
-- Explicit grants make that contract reproducible after a clean local reset;
-- their existing owner-only RLS policies remain unchanged.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.timeline_items TO authenticated;
GRANT ALL ON TABLE public.timeline_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.food_entries TO authenticated;
GRANT ALL ON TABLE public.food_entries TO service_role;

NOTIFY pgrst, 'reload schema';
