-- Keep completed version feedback immutable in normal application flows.
-- Pending owners may still edit/delete their own content, and administrators
-- may still complete or reopen feedback through the existing controlled RPCs.

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

  IF OLD.status = 'completed' THEN
    IF NOT is_admin THEN
      RAISE EXCEPTION 'completed feedback is read only';
    END IF;

    IF NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
    THEN
      RAISE EXCEPTION 'completed feedback content is read only';
    END IF;
  END IF;

  IF NOT is_admin THEN
    IF OLD.status <> 'pending'
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
      OR NEW.completed_version IS DISTINCT FROM OLD.completed_version
    THEN
      RAISE EXCEPTION 'only pending feedback content can be updated';
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

CREATE OR REPLACE FUNCTION public.prevent_completed_version_feedback_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed'
    AND COALESCE(auth.role(), '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'completed feedback cannot be deleted';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_version_feedback_prevent_completed_delete
  ON public.version_feedback;

CREATE TRIGGER trg_version_feedback_prevent_completed_delete
BEFORE DELETE ON public.version_feedback
FOR EACH ROW
EXECUTE FUNCTION public.prevent_completed_version_feedback_delete();

DROP POLICY IF EXISTS version_feedback_update_own ON public.version_feedback;
CREATE POLICY version_feedback_update_own
  ON public.version_feedback
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS version_feedback_delete_own ON public.version_feedback;
CREATE POLICY version_feedback_delete_own
  ON public.version_feedback
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE INDEX IF NOT EXISTS idx_version_feedback_completed_sort
  ON public.version_feedback(status, completed_at DESC, updated_at DESC, created_at DESC);

NOTIFY pgrst, 'reload schema';
