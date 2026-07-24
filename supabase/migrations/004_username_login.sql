-- Username-based login support for existing Supabase email users
-- Safe migration: augment profiles without recreating tables or auth users

-- 1) Ensure required profile columns exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2) Normalize existing usernames to lowercase + trimmed
UPDATE public.profiles
SET username = lower(trim(username))
WHERE username IS NOT NULL
  AND username <> lower(trim(username));

UPDATE public.profiles
SET username = NULL
WHERE username IS NOT NULL
  AND trim(username) = '';

-- 3) Add username format constraint (nullable during transition)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_username_format_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_format_check
      CHECK (
        username IS NULL
        OR username ~ '^[a-z0-9_]{3,30}$'
      );
  END IF;
END
$$;

-- 4) Keep username normalized server-side regardless of client behavior
CREATE OR REPLACE FUNCTION public.normalize_profile_username()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.username IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.username := lower(trim(NEW.username));

  IF NEW.username = '' THEN
    NEW.username := NULL;
  END IF;

  RETURN NEW;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_profiles_normalize_username'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER trg_profiles_normalize_username
    BEFORE INSERT OR UPDATE OF username
    ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_profile_username();
  END IF;
END
$$;

-- 5) Enforce unique username only when set
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON public.profiles (username)
  WHERE username IS NOT NULL;

-- 6) Ensure strict profile RLS (own profile only)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_name);
  END LOOP;
END
$$;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_delete_own
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- 7) Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
