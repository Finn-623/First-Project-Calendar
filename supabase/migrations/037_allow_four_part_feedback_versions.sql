-- The application version can include a fourth numeric release segment (for
-- example 0.2.1.1). Keep feedback numbering and RLS validation aligned with it.

ALTER TABLE public.version_feedback
  DROP CONSTRAINT IF EXISTS version_feedback_target_version_check;

ALTER TABLE public.version_feedback
  ADD CONSTRAINT version_feedback_target_version_check
  CHECK (target_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?(-[0-9A-Za-z.-]+)?$');

ALTER TABLE public.version_feedback
  DROP CONSTRAINT IF EXISTS version_feedback_number_format_check;

ALTER TABLE public.version_feedback
  ADD CONSTRAINT version_feedback_number_format_check
  CHECK (feedback_number ~ '^FB-v[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?(-[0-9A-Za-z.-]+)?-[0-9]{3}$');

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
    AND target_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?(-[0-9A-Za-z.-]+)?$'
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
  IF normalized_version !~ '^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?(-[0-9A-Za-z.-]+)?$' THEN
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

REVOKE ALL ON FUNCTION public.next_version_feedback_number(TEXT) FROM PUBLIC;
