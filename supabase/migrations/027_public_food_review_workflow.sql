-- v0.2.1 controlled public-food review workflow.
-- Adds review attribution and an immutable transition audit without changing
-- imported nutrients, source identity, personal foods, or historical snapshots.

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

ALTER TABLE public.foods
  DROP CONSTRAINT IF EXISTS foods_review_note_size_check,
  ADD CONSTRAINT foods_review_note_size_check
    CHECK (review_note IS NULL OR length(review_note) <= 1000);

CREATE INDEX IF NOT EXISTS idx_foods_public_review_queue
  ON public.foods(review_status, primary_category, created_at DESC)
  WHERE visibility = 'public';

CREATE TABLE IF NOT EXISTS public.food_review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
  previous_status TEXT NOT NULL,
  next_status TEXT NOT NULL,
  reviewed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT food_review_events_previous_status_check
    CHECK (previous_status IN ('pending', 'approved', 'disabled')),
  CONSTRAINT food_review_events_next_status_check
    CHECK (next_status IN ('pending', 'approved', 'disabled')),
  CONSTRAINT food_review_events_transition_check
    CHECK (previous_status <> next_status),
  CONSTRAINT food_review_events_note_size_check
    CHECK (review_note IS NULL OR length(review_note) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_food_review_events_food_reviewed
  ON public.food_review_events(food_id, reviewed_at DESC);

ALTER TABLE public.food_review_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS food_review_events_select_admin ON public.food_review_events;
CREATE POLICY food_review_events_select_admin
  ON public.food_review_events
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin(auth.uid()));

REVOKE ALL ON TABLE public.food_review_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.food_review_events TO authenticated;
GRANT ALL ON TABLE public.food_review_events TO service_role;

CREATE OR REPLACE FUNCTION public.review_public_foods(
  p_food_ids UUID[],
  p_target_status TEXT,
  p_review_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  reviewer_id UUID := auth.uid();
  target_status TEXT := lower(trim(coalesce(p_target_status, '')));
  note_value TEXT := nullif(trim(coalesce(p_review_note, '')), '');
  requested_id UUID;
  food_row public.foods%ROWTYPE;
  seen_ids UUID[] := ARRAY[]::UUID[];
  success_items JSONB := '[]'::JSONB;
  failed_items JSONB := '[]'::JSONB;
  skipped_items JSONB := '[]'::JSONB;
  success_count INTEGER := 0;
  failed_count INTEGER := 0;
  skipped_count INTEGER := 0;
BEGIN
  IF reviewer_id IS NULL OR NOT public.is_app_admin(reviewer_id) THEN
    RAISE EXCEPTION 'public food review requires administrator';
  END IF;
  IF target_status NOT IN ('pending', 'approved', 'disabled') THEN
    RAISE EXCEPTION 'invalid public food review status';
  END IF;
  IF p_food_ids IS NULL OR cardinality(p_food_ids) = 0 THEN
    RAISE EXCEPTION 'at least one food id is required';
  END IF;
  IF cardinality(p_food_ids) > 50 THEN
    RAISE EXCEPTION 'public food review batch limit is 50';
  END IF;
  IF note_value IS NOT NULL AND length(note_value) > 1000 THEN
    RAISE EXCEPTION 'review note exceeds 1000 characters';
  END IF;

  FOREACH requested_id IN ARRAY p_food_ids LOOP
    IF requested_id = ANY(seen_ids) THEN
      skipped_count := skipped_count + 1;
      skipped_items := skipped_items || jsonb_build_array(
        jsonb_build_object('food_id', requested_id, 'reason', 'duplicate_id')
      );
      CONTINUE;
    END IF;
    seen_ids := array_append(seen_ids, requested_id);

    BEGIN
      SELECT * INTO food_row
      FROM public.foods
      WHERE id = requested_id
      FOR UPDATE;

      IF NOT FOUND THEN
        failed_count := failed_count + 1;
        failed_items := failed_items || jsonb_build_array(
          jsonb_build_object('food_id', requested_id, 'reason', 'not_found')
        );
      ELSIF food_row.visibility <> 'public' OR food_row.user_id IS NOT NULL THEN
        failed_count := failed_count + 1;
        failed_items := failed_items || jsonb_build_array(
          jsonb_build_object('food_id', requested_id, 'reason', 'not_public_food')
        );
      ELSIF food_row.review_status = target_status THEN
        skipped_count := skipped_count + 1;
        skipped_items := skipped_items || jsonb_build_array(
          jsonb_build_object('food_id', requested_id, 'reason', 'already_in_status')
        );
      ELSE
        UPDATE public.foods
        SET
          review_status = target_status,
          is_active = target_status <> 'disabled',
          reviewed_by = reviewer_id,
          reviewed_at = NOW(),
          review_note = note_value,
          updated_by = reviewer_id,
          updated_at = NOW()
        WHERE id = requested_id;

        INSERT INTO public.food_review_events (
          food_id, previous_status, next_status, reviewed_by, review_note
        ) VALUES (
          requested_id, food_row.review_status, target_status, reviewer_id, note_value
        );

        success_count := success_count + 1;
        success_items := success_items || jsonb_build_array(
          jsonb_build_object(
            'food_id', requested_id,
            'previous_status', food_row.review_status,
            'next_status', target_status
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      failed_items := failed_items || jsonb_build_array(
        jsonb_build_object('food_id', requested_id, 'reason', 'database_error')
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'requested', cardinality(p_food_ids),
    'success', success_count,
    'failed', failed_count,
    'skipped', skipped_count,
    'success_items', success_items,
    'failed_items', failed_items,
    'skipped_items', skipped_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_public_foods(UUID[], TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_public_foods(UUID[], TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.review_public_foods(UUID[], TEXT, TEXT) IS
  'Administrator-only public food review; maximum 50 explicit IDs per call.';
COMMENT ON TABLE public.food_review_events IS
  'Immutable administrator review-state transition audit for public foods.';
