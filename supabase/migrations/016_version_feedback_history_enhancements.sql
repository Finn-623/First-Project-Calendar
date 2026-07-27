-- Enhance version feedback history with editable content, deletions, completion version,
-- and admin-only status transition RPCs.

ALTER TABLE public.version_feedback
  ADD COLUMN IF NOT EXISTS completed_version TEXT NULL;

ALTER TABLE public.version_feedback
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.version_feedback
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL;

-- Legacy completed rows keep their original status and completed_at. Their
-- completed_version may remain NULL until an administrator explicitly sets a
-- real version; this migration must not invent version history.

ALTER TABLE public.version_feedback
  DROP CONSTRAINT IF EXISTS version_feedback_completed_at_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'version_feedback_completed_version_length_check'
      AND conrelid = 'public.version_feedback'::regclass
  ) THEN
    ALTER TABLE public.version_feedback
      ADD CONSTRAINT version_feedback_completed_version_length_check
      CHECK (
        completed_version IS NULL
        OR char_length(trim(completed_version)) BETWEEN 2 AND 30
      );
  END IF;
END
$$;

ALTER TABLE public.version_feedback
  DROP CONSTRAINT IF EXISTS version_feedback_completion_consistency_check;

ALTER TABLE public.version_feedback
  ADD CONSTRAINT version_feedback_completion_consistency_check
  CHECK (
    (status = 'pending' AND completed_at IS NULL AND completed_version IS NULL)
    OR (
      status = 'completed'
      AND completed_at IS NOT NULL
      AND (
        completed_version IS NULL
        OR char_length(trim(completed_version)) BETWEEN 2 AND 30
      )
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_version_feedback_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
  is_owner BOOLEAN;
BEGIN
  is_admin := public.is_app_admin(auth.uid());
  is_owner := OLD.user_id = auth.uid();

  IF NOT is_admin AND NOT is_owner THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'immutable fields changed';
  END IF;

  IF NOT is_admin THEN
    IF NEW.status IS DISTINCT FROM OLD.status
      OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
      OR NEW.completed_version IS DISTINCT FROM OLD.completed_version
    THEN
      RAISE EXCEPTION 'only title and description can be updated';
    END IF;

    NEW.title := trim(NEW.title);
    NEW.description := trim(NEW.description);
    NEW.status := OLD.status;
    NEW.completed_at := OLD.completed_at;
    NEW.completed_version := OLD.completed_version;
  ELSE
    IF NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
    THEN
      RAISE EXCEPTION 'admin cannot edit user suggestion content';
    END IF;

    IF NEW.status = 'completed' THEN
      NEW.completed_version := NULLIF(trim(COALESCE(NEW.completed_version, '')), '');

      IF NEW.completed_version IS NULL THEN
        RAISE EXCEPTION 'completed version is required';
      END IF;

      NEW.completed_at := COALESCE(NEW.completed_at, NOW());
    ELSE
      NEW.status := 'pending';
      NEW.completed_at := NULL;
      NEW.completed_version := NULL;
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_version_feedback(
  feedback_id UUID,
  version_number TEXT
)
RETURNS public.version_feedback
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_version TEXT;
  result_row public.version_feedback;
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  normalized_version := NULLIF(trim(COALESCE(version_number, '')), '');

  IF normalized_version IS NULL OR char_length(normalized_version) < 2 OR char_length(normalized_version) > 30 THEN
    RAISE EXCEPTION 'invalid completed version';
  END IF;

  UPDATE public.version_feedback
  SET
    status = 'completed',
    completed_version = normalized_version
  WHERE id = feedback_id
  RETURNING * INTO result_row;

  IF result_row.id IS NULL THEN
    RAISE EXCEPTION 'feedback not found';
  END IF;

  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_version_feedback(
  feedback_id UUID
)
RETURNS public.version_feedback
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_row public.version_feedback;
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE public.version_feedback
  SET
    status = 'pending',
    completed_at = NULL,
    completed_version = NULL
  WHERE id = feedback_id
  RETURNING * INTO result_row;

  IF result_row.id IS NULL THEN
    RAISE EXCEPTION 'feedback not found';
  END IF;

  RETURN result_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_version_feedback(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_version_feedback(UUID) TO authenticated;

DROP POLICY IF EXISTS version_feedback_update_admin_only ON public.version_feedback;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'version_feedback'
      AND policyname = 'version_feedback_update_own'
  ) THEN
    CREATE POLICY version_feedback_update_own
      ON public.version_feedback
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'version_feedback'
      AND policyname = 'version_feedback_update_admin'
  ) THEN
    CREATE POLICY version_feedback_update_admin
      ON public.version_feedback
      FOR UPDATE
      TO authenticated
      USING (public.is_app_admin(auth.uid()))
      WITH CHECK (public.is_app_admin(auth.uid()));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'version_feedback'
      AND policyname = 'version_feedback_delete_own'
  ) THEN
    CREATE POLICY version_feedback_delete_own
      ON public.version_feedback
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
