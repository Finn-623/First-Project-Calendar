-- Fix admin RLS compatibility for public foods.
-- Supports both new role-based admins and legacy app_admins mapping.

CREATE OR REPLACE FUNCTION public.is_app_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_profile_admin BOOLEAN := FALSE;
  has_legacy_admin BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT TRUE
  INTO has_profile_admin
  FROM public.profiles
  WHERE id = p_user_id
    AND (
      lower(coalesce(role, '')) = 'admin'
      OR lower(coalesce(account_type, '')) = 'admin'
      OR coalesce(is_admin, FALSE) = TRUE
    )
  LIMIT 1;

  IF coalesce(has_profile_admin, FALSE) THEN
    RETURN TRUE;
  END IF;

  IF to_regclass('public.app_admins') IS NULL THEN
    RETURN FALSE;
  END IF;

  BEGIN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = $1)'
      INTO has_legacy_admin
      USING p_user_id;

    IF coalesce(has_legacy_admin, FALSE) THEN
      RETURN TRUE;
    END IF;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  BEGIN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE id = $1)'
      INTO has_legacy_admin
      USING p_user_id;
  EXCEPTION
    WHEN undefined_column THEN
      has_legacy_admin := FALSE;
  END;

  RETURN coalesce(has_legacy_admin, FALSE);
END;
$$;

DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'foods'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.foods', policy_name);
  END LOOP;
END
$$;

CREATE POLICY foods_select_public_or_own_private_or_admin
  ON public.foods
  FOR SELECT
  TO authenticated
  USING (
    (
      visibility = 'public'
      AND is_active = TRUE
    )
    OR (
      visibility = 'private'
      AND user_id = auth.uid()
    )
    OR public.is_app_admin(auth.uid())
  );

CREATE POLICY foods_insert_private_own_only
  ON public.foods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    visibility = 'private'
    AND user_id = auth.uid()
  );

CREATE POLICY foods_insert_public_admin_only
  ON public.foods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    visibility = 'public'
    AND user_id IS NULL
    AND is_active = TRUE
    AND length(trim(coalesce(notes, ''))) > 0
    AND public.is_app_admin(auth.uid())
  );

CREATE POLICY foods_update_private_own_only
  ON public.foods
  FOR UPDATE
  TO authenticated
  USING (
    visibility = 'private'
    AND user_id = auth.uid()
  )
  WITH CHECK (
    visibility = 'private'
    AND user_id = auth.uid()
  );

CREATE POLICY foods_update_public_admin_only
  ON public.foods
  FOR UPDATE
  TO authenticated
  USING (
    visibility = 'public'
    AND public.is_app_admin(auth.uid())
  )
  WITH CHECK (
    visibility = 'public'
    AND public.is_app_admin(auth.uid())
    AND length(trim(coalesce(notes, ''))) > 0
  );

CREATE POLICY foods_delete_private_own_only
  ON public.foods
  FOR DELETE
  TO authenticated
  USING (
    visibility = 'private'
    AND user_id = auth.uid()
  );

CREATE POLICY foods_delete_public_admin_only
  ON public.foods
  FOR DELETE
  TO authenticated
  USING (
    visibility = 'public'
    AND public.is_app_admin(auth.uid())
  );

NOTIFY pgrst, 'reload schema';
