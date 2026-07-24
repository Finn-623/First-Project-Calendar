-- Make admin detection tolerant to profile schema differences.
-- Some environments do not have account_type or is_admin columns.

CREATE OR REPLACE FUNCTION public.is_app_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_profile_admin BOOLEAN := FALSE;
  has_legacy_admin BOOLEAN := FALSE;
  has_role_column BOOLEAN := FALSE;
  has_account_type_column BOOLEAN := FALSE;
  has_is_admin_column BOOLEAN := FALSE;
  profile_condition TEXT := '';
  profile_sql TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) INTO has_role_column;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'account_type'
  ) INTO has_account_type_column;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'is_admin'
  ) INTO has_is_admin_column;

  IF has_role_column THEN
    profile_condition := profile_condition || 'lower(coalesce(role, '''')) = ''admin''';
  END IF;

  IF has_account_type_column THEN
    IF profile_condition <> '' THEN
      profile_condition := profile_condition || ' OR ';
    END IF;
    profile_condition := profile_condition || 'lower(coalesce(account_type, '''')) = ''admin''';
  END IF;

  IF has_is_admin_column THEN
    IF profile_condition <> '' THEN
      profile_condition := profile_condition || ' OR ';
    END IF;
    profile_condition := profile_condition || 'coalesce(is_admin, FALSE) = TRUE';
  END IF;

  IF profile_condition <> '' THEN
    profile_sql :=
      'SELECT EXISTS (' ||
      'SELECT 1 FROM public.profiles WHERE id = $1 AND (' || profile_condition || ')' ||
      ')';

    EXECUTE profile_sql INTO has_profile_admin USING p_user_id;
  END IF;

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

NOTIFY pgrst, 'reload schema';
