-- Version feedback tasks table and RLS policies

CREATE TABLE IF NOT EXISTS public.version_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'version_feedback_title_length_check'
      AND conrelid = 'public.version_feedback'::regclass
  ) THEN
    ALTER TABLE public.version_feedback
      ADD CONSTRAINT version_feedback_title_length_check
      CHECK (char_length(trim(title)) BETWEEN 2 AND 80);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'version_feedback_description_length_check'
      AND conrelid = 'public.version_feedback'::regclass
  ) THEN
    ALTER TABLE public.version_feedback
      ADD CONSTRAINT version_feedback_description_length_check
      CHECK (char_length(trim(description)) BETWEEN 5 AND 1000);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'version_feedback_status_check'
      AND conrelid = 'public.version_feedback'::regclass
  ) THEN
    ALTER TABLE public.version_feedback
      ADD CONSTRAINT version_feedback_status_check
      CHECK (status IN ('pending', 'completed'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'version_feedback_completed_at_check'
      AND conrelid = 'public.version_feedback'::regclass
  ) THEN
    ALTER TABLE public.version_feedback
      ADD CONSTRAINT version_feedback_completed_at_check
      CHECK (
        (status = 'pending' AND completed_at IS NULL)
        OR (status = 'completed' AND completed_at IS NOT NULL)
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_version_feedback_user_created
  ON public.version_feedback(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_version_feedback_status_created
  ON public.version_feedback(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_version_feedback_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'only status fields can be updated';
  END IF;

  IF NEW.status NOT IN ('pending', 'completed') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  IF NEW.status = 'completed' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
  ELSE
    NEW.completed_at := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_version_feedback_enforce_update ON public.version_feedback;

CREATE TRIGGER trg_version_feedback_enforce_update
BEFORE UPDATE ON public.version_feedback
FOR EACH ROW
EXECUTE FUNCTION public.enforce_version_feedback_update();

ALTER TABLE public.version_feedback ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'version_feedback'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.version_feedback', policy_name);
  END LOOP;
END
$$;

CREATE POLICY version_feedback_select_own_or_admin
  ON public.version_feedback
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin(auth.uid()));

CREATE POLICY version_feedback_insert_own
  ON public.version_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND completed_at IS NULL
  );

CREATE POLICY version_feedback_update_admin_only
  ON public.version_feedback
  FOR UPDATE
  TO authenticated
  USING (public.is_app_admin(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()));

-- Allow admins to resolve submitter display names/usernames for feedback history.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_admin_all'
  ) THEN
    CREATE POLICY profiles_select_admin_all
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (public.is_app_admin(auth.uid()));
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
