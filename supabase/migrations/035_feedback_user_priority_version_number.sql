-- Correct feedback priorities and numbers to match the final product rules.
-- Historical rows without a submitted version are assigned to the current 0.1.3 release:
-- completed rows use completed_version; pending rows use the current application version.

CREATE TABLE IF NOT EXISTS public.version_feedback_counters (
  version_number TEXT PRIMARY KEY,
  next_sequence INTEGER NOT NULL CHECK (next_sequence > 0)
);

ALTER TABLE public.version_feedback
  ADD COLUMN IF NOT EXISTS submitted_priority TEXT,
  ADD COLUMN IF NOT EXISTS target_version TEXT;

ALTER TABLE public.version_feedback
  DROP CONSTRAINT IF EXISTS version_feedback_number_format_check;

ALTER TABLE public.version_feedback
  DROP CONSTRAINT IF EXISTS version_feedback_submitted_priority_check;

ALTER TABLE public.version_feedback
  DROP CONSTRAINT IF EXISTS version_feedback_target_version_check;

ALTER TABLE public.version_feedback
  DISABLE TRIGGER trg_version_feedback_enforce_update;

UPDATE public.version_feedback
SET submitted_priority = priority
WHERE submitted_priority IS NULL;

ALTER TABLE public.version_feedback
  ALTER COLUMN submitted_priority SET NOT NULL;

ALTER TABLE public.version_feedback
  ADD CONSTRAINT version_feedback_submitted_priority_check
  CHECK (submitted_priority IN ('P0', 'P1', 'P2', 'P3'));

UPDATE public.version_feedback
SET target_version = CASE
  WHEN status = 'completed' AND completed_version IS NOT NULL
    THEN regexp_replace(trim(completed_version), '^v', '')
  ELSE '0.1.3'
END
WHERE target_version IS NULL;

ALTER TABLE public.version_feedback
  ALTER COLUMN target_version SET NOT NULL;

ALTER TABLE public.version_feedback
  ADD CONSTRAINT version_feedback_target_version_check
  CHECK (target_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$');

-- The old annual values occupy the unique index, so move them to unique temporary
-- values before assigning the version-local identifiers.
UPDATE public.version_feedback
SET feedback_number = 'FB-legacy-' || id::TEXT;

DO $$
DECLARE
  row_data RECORD;
  version_sequence INTEGER;
BEGIN
  FOR row_data IN
    SELECT
      id,
      target_version,
      ROW_NUMBER() OVER (
        PARTITION BY target_version
        ORDER BY created_at ASC, id ASC
      )::INTEGER AS row_number
    FROM public.version_feedback
  LOOP
    UPDATE public.version_feedback
    SET feedback_number = format('FB-v%s-%s', row_data.target_version, lpad(row_data.row_number::TEXT, 3, '0'))
    WHERE id = row_data.id;
  END LOOP;

  FOR row_data IN
    SELECT target_version, MAX(number_value)::INTEGER AS max_number
    FROM (
      SELECT
        target_version,
        substring(feedback_number FROM '-([0-9]+)$')::INTEGER AS number_value
      FROM public.version_feedback
    ) numbered_feedback
    GROUP BY target_version
  LOOP
    version_sequence := row_data.max_number + 1;
    INSERT INTO public.version_feedback_counters (version_number, next_sequence)
    VALUES (row_data.target_version, version_sequence)
    ON CONFLICT (version_number) DO UPDATE
      SET next_sequence = GREATEST(
        public.version_feedback_counters.next_sequence,
        EXCLUDED.next_sequence
      );
  END LOOP;
END;
$$;

ALTER TABLE public.version_feedback
  ENABLE TRIGGER trg_version_feedback_enforce_update;

ALTER TABLE public.version_feedback
  ADD CONSTRAINT version_feedback_number_format_check
  CHECK (feedback_number ~ '^FB-v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?-[0-9]{3}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_version_feedback_number_unique
  ON public.version_feedback(feedback_number);

CREATE INDEX IF NOT EXISTS idx_version_feedback_version_priority_created
  ON public.version_feedback(target_version, priority, created_at ASC);

DROP POLICY IF EXISTS version_feedback_insert_own ON public.version_feedback;
CREATE POLICY version_feedback_insert_own
  ON public.version_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND completed_at IS NULL
    AND submitted_priority IN ('P0', 'P1', 'P2', 'P3')
    AND target_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
  );

CREATE OR REPLACE FUNCTION public.next_version_feedback_number(target_version_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized_version TEXT := regexp_replace(trim(target_version_input), '^v', '');
  allocated_sequence INTEGER;
BEGIN
  IF normalized_version !~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$' THEN
    RAISE EXCEPTION 'invalid target version';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('version-feedback:' || normalized_version, 0));

  INSERT INTO public.version_feedback_counters (version_number, next_sequence)
  VALUES (normalized_version, 2)
  ON CONFLICT (version_number) DO UPDATE
    SET next_sequence = public.version_feedback_counters.next_sequence + 1
  RETURNING next_sequence - 1 INTO allocated_sequence;

  IF allocated_sequence > 999 THEN
    RAISE EXCEPTION 'feedback number sequence exhausted for version %', normalized_version;
  END IF;

  RETURN format('FB-v%s-%s', normalized_version, lpad(allocated_sequence::TEXT, 3, '0'));
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_version_feedback_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.target_version IS NULL OR btrim(NEW.target_version) = '' THEN
    RAISE EXCEPTION 'target version is required';
  END IF;

  IF NEW.submitted_priority IS NULL OR NEW.submitted_priority NOT IN ('P0', 'P1', 'P2', 'P3') THEN
    RAISE EXCEPTION 'submitted priority is required';
  END IF;

  NEW.target_version := regexp_replace(trim(NEW.target_version), '^v', '');
  NEW.feedback_number := public.next_version_feedback_number(NEW.target_version);
  NEW.priority := NEW.submitted_priority;
  NEW.priority_assigned_at := NULL;
  NEW.priority_assigned_by := NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.next_version_feedback_number(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_version_feedback_number() FROM PUBLIC;
REVOKE ALL ON TABLE public.version_feedback_counters FROM PUBLIC, anon, authenticated;

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
    OR NEW.submitted_priority IS DISTINCT FROM OLD.submitted_priority
    OR NEW.target_version IS DISTINCT FROM OLD.target_version
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'immutable feedback fields changed';
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
REVOKE ALL ON FUNCTION public.set_version_feedback_priority(UUID, TEXT) FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
