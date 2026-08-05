-- Add database-owned feedback numbers and administrator-controlled priorities.

CREATE TABLE IF NOT EXISTS public.version_feedback_number_counters (
  feedback_year INTEGER PRIMARY KEY,
  next_number INTEGER NOT NULL CHECK (next_number > 0)
);

ALTER TABLE public.version_feedback
  ADD COLUMN IF NOT EXISTS feedback_number TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'P2',
  ADD COLUMN IF NOT EXISTS priority_assigned_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS priority_assigned_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.version_feedback
  DROP CONSTRAINT IF EXISTS version_feedback_priority_check;

ALTER TABLE public.version_feedback
  ADD CONSTRAINT version_feedback_priority_check
  CHECK (priority IN ('P0', 'P1', 'P2', 'P3'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_version_feedback_number_unique
  ON public.version_feedback(feedback_number);

CREATE INDEX IF NOT EXISTS idx_version_feedback_priority_created
  ON public.version_feedback(priority, created_at ASC);

CREATE OR REPLACE FUNCTION public.next_version_feedback_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  allocated_number INTEGER;
BEGIN
  INSERT INTO public.version_feedback_number_counters (feedback_year, next_number)
  VALUES (current_year, 2)
  ON CONFLICT (feedback_year) DO UPDATE
    SET next_number = public.version_feedback_number_counters.next_number + 1
  RETURNING next_number - 1 INTO allocated_number;

  RETURN format('FB-%s-%s', current_year, lpad(allocated_number::TEXT, 4, '0'));
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_version_feedback_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.feedback_number := public.next_version_feedback_number();

  IF NEW.priority IS NULL OR btrim(NEW.priority) = '' THEN
    NEW.priority := 'P2';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.next_version_feedback_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_version_feedback_number() FROM PUBLIC;

ALTER TABLE public.version_feedback
  DISABLE TRIGGER trg_version_feedback_enforce_update;

DO $$
DECLARE
  target_year INTEGER;
BEGIN
  FOR target_year IN
    SELECT DISTINCT EXTRACT(YEAR FROM created_at)::INTEGER
    FROM public.version_feedback
    WHERE feedback_number IS NULL
    ORDER BY 1
  LOOP
    WITH numbered_rows AS (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS row_number
      FROM public.version_feedback
      WHERE feedback_number IS NULL
        AND EXTRACT(YEAR FROM created_at)::INTEGER = target_year
    )
    UPDATE public.version_feedback AS feedback
    SET feedback_number = format('FB-%s-%s', target_year, lpad(numbered_rows.row_number::TEXT, 4, '0'))
    FROM numbered_rows
    WHERE feedback.id = numbered_rows.id;

    INSERT INTO public.version_feedback_number_counters (feedback_year, next_number)
    SELECT target_year, COUNT(*)::INTEGER + 1
    FROM public.version_feedback AS feedback
    WHERE EXTRACT(YEAR FROM feedback.created_at)::INTEGER = target_year
    ON CONFLICT (feedback_year) DO UPDATE
      SET next_number = GREATEST(
        public.version_feedback_number_counters.next_number,
        EXCLUDED.next_number
      );
  END LOOP;
END;
$$;

ALTER TABLE public.version_feedback
  ENABLE TRIGGER trg_version_feedback_enforce_update;

ALTER TABLE public.version_feedback
  ALTER COLUMN feedback_number SET NOT NULL;

ALTER TABLE public.version_feedback
  DROP CONSTRAINT IF EXISTS version_feedback_number_format_check;

ALTER TABLE public.version_feedback
  ADD CONSTRAINT version_feedback_number_format_check
  CHECK (feedback_number ~ '^FB-[0-9]{4}-[0-9]{4}$');

DROP TRIGGER IF EXISTS trg_version_feedback_assign_number ON public.version_feedback;
CREATE TRIGGER trg_version_feedback_assign_number
BEFORE INSERT ON public.version_feedback
FOR EACH ROW
EXECUTE FUNCTION public.assign_version_feedback_number();

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

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.feedback_number IS DISTINCT FROM OLD.feedback_number
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
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
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.priority_assigned_at IS DISTINCT FROM OLD.priority_assigned_at
      OR NEW.priority_assigned_by IS DISTINCT FROM OLD.priority_assigned_by
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

    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      IF NEW.priority NOT IN ('P0', 'P1', 'P2', 'P3') THEN
        RAISE EXCEPTION 'invalid feedback priority';
      END IF;
      NEW.priority_assigned_at := NOW();
      NEW.priority_assigned_by := auth.uid();
    ELSE
      NEW.priority_assigned_at := OLD.priority_assigned_at;
      NEW.priority_assigned_by := OLD.priority_assigned_by;
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

DROP TRIGGER IF EXISTS trg_version_feedback_enforce_update ON public.version_feedback;
CREATE TRIGGER trg_version_feedback_enforce_update
BEFORE UPDATE ON public.version_feedback
FOR EACH ROW
EXECUTE FUNCTION public.enforce_version_feedback_update();

CREATE OR REPLACE FUNCTION public.set_version_feedback_priority(
  feedback_id UUID,
  feedback_priority TEXT
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

  IF feedback_priority NOT IN ('P0', 'P1', 'P2', 'P3') THEN
    RAISE EXCEPTION 'invalid feedback priority';
  END IF;

  UPDATE public.version_feedback
  SET priority = feedback_priority
  WHERE id = feedback_id
  RETURNING * INTO result_row;

  IF result_row.id IS NULL THEN
    RAISE EXCEPTION 'feedback not found';
  END IF;

  RETURN result_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_version_feedback_priority(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
