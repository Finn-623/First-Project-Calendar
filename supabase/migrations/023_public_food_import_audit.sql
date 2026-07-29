-- v0.2.1 public food import audit and atomic item import.
-- No import endpoint is exposed publicly. Application roles may only use these
-- objects when public.is_app_admin(auth.uid()) is true; service_role retains the
-- controlled server-side batch import path.

-- ---------------------------------------------------------------------------
-- 1. Import run and row error audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.food_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  input_identifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  total_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  executor_role TEXT NOT NULL DEFAULT COALESCE(auth.role(), 'unknown'),
  error_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT food_import_runs_source_required_check
    CHECK (length(trim(source_name)) > 0),
  CONSTRAINT food_import_runs_input_required_check
    CHECK (
      length(trim(input_identifier)) > 0
      AND length(input_identifier) <= 512
    ),
  CONSTRAINT food_import_runs_status_check
    CHECK (status IN ('running', 'completed', 'partially_failed', 'failed')),
  CONSTRAINT food_import_runs_counts_nonnegative_check
    CHECK (
      total_count >= 0
      AND success_count >= 0
      AND skipped_count >= 0
      AND failed_count >= 0
    ),
  CONSTRAINT food_import_runs_counts_within_total_check
    CHECK (success_count + skipped_count + failed_count <= total_count),
  CONSTRAINT food_import_runs_completion_check
    CHECK (
      (status = 'running' AND completed_at IS NULL)
      OR
      (status <> 'running' AND completed_at IS NOT NULL)
    ),
  CONSTRAINT food_import_runs_metadata_object_check
    CHECK (
      jsonb_typeof(metadata) = 'object'
      AND octet_length(metadata::TEXT) <= 16384
    ),
  CONSTRAINT food_import_runs_error_summary_size_check
    CHECK (error_summary IS NULL OR length(error_summary) <= 4000)
);

CREATE TABLE IF NOT EXISTS public.food_import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL
    REFERENCES public.food_import_runs(id) ON DELETE CASCADE,
  row_number INTEGER,
  external_food_id TEXT,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  raw_summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT food_import_errors_row_number_check
    CHECK (row_number IS NULL OR row_number > 0),
  CONSTRAINT food_import_errors_code_required_check
    CHECK (length(trim(error_code)) > 0),
  CONSTRAINT food_import_errors_message_required_check
    CHECK (
      length(trim(error_message)) > 0
      AND length(error_message) <= 2000
    ),
  CONSTRAINT food_import_errors_raw_summary_object_check
    CHECK (
      jsonb_typeof(raw_summary) = 'object'
      AND octet_length(raw_summary::TEXT) <= 4096
    )
);

CREATE INDEX IF NOT EXISTS idx_food_import_runs_started
  ON public.food_import_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_food_import_runs_source_started
  ON public.food_import_runs(source_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_food_import_errors_run
  ON public.food_import_errors(import_run_id, row_number);

COMMENT ON TABLE public.food_import_runs IS
  'Administrator/service-role audit for public food import batches.';
COMMENT ON COLUMN public.food_import_runs.input_identifier IS
  'Input file name or non-sensitive batch identifier; never store credentials.';
COMMENT ON COLUMN public.food_import_runs.metadata IS
  'Small non-sensitive import metadata only; never store keys or authorization headers.';
COMMENT ON COLUMN public.food_import_errors.raw_summary IS
  'Whitelisted row identity/name summary only, not the complete source row.';

CREATE OR REPLACE FUNCTION public.set_food_import_audit_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.executor_role := COALESCE(auth.role(), 'unknown');
    NEW.started_at := COALESCE(NEW.started_at, NOW());
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.executor_role := OLD.executor_role;
    NEW.started_at := OLD.started_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_food_import_runs_audit_identity
  ON public.food_import_runs;
CREATE TRIGGER trg_food_import_runs_audit_identity
BEFORE INSERT OR UPDATE ON public.food_import_runs
FOR EACH ROW
EXECUTE FUNCTION public.set_food_import_audit_identity();

-- ---------------------------------------------------------------------------
-- 2. Admin-only RLS. service_role bypasses RLS and is granted explicitly.
-- ---------------------------------------------------------------------------
ALTER TABLE public.food_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY food_import_runs_admin_all
  ON public.food_import_runs
  FOR ALL
  TO authenticated
  USING (public.is_app_admin(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()));

CREATE POLICY food_import_errors_admin_all
  ON public.food_import_errors
  FOR ALL
  TO authenticated
  USING (public.is_app_admin(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()));

REVOKE ALL ON TABLE public.food_import_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.food_import_errors FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.food_import_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.food_import_errors TO authenticated;
GRANT ALL ON TABLE public.food_import_runs TO service_role;
GRANT ALL ON TABLE public.food_import_errors TO service_role;

-- ---------------------------------------------------------------------------
-- 3. One food plus portions and aliases is imported atomically.
-- Existing source_name + external_food_id is returned as skipped; existing
-- public foods are never updated by this default import function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_public_food_item(
  p_import_run_id UUID,
  p_food JSONB,
  p_portions JSONB DEFAULT '[]'::JSONB,
  p_aliases JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  imported_food_id UUID;
  existing_food_id UUID;
  caller_is_service BOOLEAN := auth.role() = 'service_role';
  caller_is_admin BOOLEAN := public.is_app_admin(auth.uid());
  source_value TEXT := NULLIF(trim(p_food ->> 'source_name'), '');
  external_id_value TEXT := NULLIF(trim(p_food ->> 'external_food_id'), '');
  run_source_value TEXT;
  display_name_value TEXT := COALESCE(
    NULLIF(trim(p_food ->> 'name_zh'), ''),
    NULLIF(trim(p_food ->> 'name_en'), '')
  );
BEGIN
  IF NOT caller_is_service AND NOT caller_is_admin THEN
    RAISE EXCEPTION 'public food import requires administrator or service role';
  END IF;

  SELECT source_name
  INTO run_source_value
  FROM public.food_import_runs
  WHERE id = p_import_run_id
    AND status = 'running';

  IF run_source_value IS NULL THEN
    RAISE EXCEPTION 'valid food import run is required';
  END IF;

  IF jsonb_typeof(p_food) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_portions) IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_aliases) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'food, portions, and aliases use invalid JSON shapes';
  END IF;

  IF source_value IS NULL
    OR external_id_value IS NULL
    OR display_name_value IS NULL
  THEN
    RAISE EXCEPTION 'source, external id, and food name are required';
  END IF;

  IF run_source_value IS DISTINCT FROM source_value THEN
    RAISE EXCEPTION 'food source must match the import run source';
  END IF;

  IF NULLIF(trim(p_food ->> 'category_primary'), '') IS NULL
    OR p_food ->> 'energy_kcal' IS NULL
    OR p_food ->> 'protein_g' IS NULL
    OR p_food ->> 'carbohydrate_g' IS NULL
    OR p_food ->> 'fat_g' IS NULL
    OR p_food ->> 'fiber_g' IS NULL
  THEN
    RAISE EXCEPTION 'category and five core nutrients are required for public import';
  END IF;

  SELECT id
  INTO existing_food_id
  FROM public.foods
  WHERE visibility = 'public'
    AND source_name = source_value
    AND external_food_id = external_id_value
  LIMIT 1;

  IF existing_food_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'skipped',
      'food_id', existing_food_id
    );
  END IF;

  BEGIN
    INSERT INTO public.foods (
      visibility,
      user_id,
      name,
      name_en,
      brand,
      source_name,
      external_food_id,
      review_status,
      is_active,
      preparation_state,
      primary_category,
      secondary_category,
      intake_types,
      default_quantity,
      unit,
      calories,
      protein,
      carbs,
      fat,
      energy_kcal,
      protein_g,
      carbohydrate_g,
      fat_g,
      fiber_g,
      saturated_fat_g,
      monounsaturated_fat_g,
      polyunsaturated_fat_g,
      trans_fat_g,
      total_sugar_g,
      added_sugar_g,
      sugar_alcohol_g,
      sodium_mg,
      potassium_mg,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      'public',
      NULL,
      display_name_value,
      NULLIF(trim(p_food ->> 'name_en'), ''),
      NULLIF(trim(p_food ->> 'brand'), ''),
      source_value,
      external_id_value,
      'pending',
      TRUE,
      COALESCE(NULLIF(trim(p_food ->> 'preparation_state'), ''), 'unspecified'),
      NULLIF(trim(p_food ->> 'category_primary'), ''),
      NULLIF(trim(p_food ->> 'category_secondary'), ''),
      ARRAY(
        SELECT jsonb_array_elements_text(
          COALESCE(p_food -> 'intake_types', '[]'::JSONB)
        )
      ),
      100,
      'g',
      (p_food ->> 'energy_kcal')::NUMERIC,
      (p_food ->> 'protein_g')::NUMERIC,
      (p_food ->> 'carbohydrate_g')::NUMERIC,
      (p_food ->> 'fat_g')::NUMERIC,
      (p_food ->> 'energy_kcal')::NUMERIC,
      (p_food ->> 'protein_g')::NUMERIC,
      (p_food ->> 'carbohydrate_g')::NUMERIC,
      (p_food ->> 'fat_g')::NUMERIC,
      (p_food ->> 'fiber_g')::NUMERIC,
      (p_food ->> 'saturated_fat_g')::NUMERIC,
      (p_food ->> 'monounsaturated_fat_g')::NUMERIC,
      (p_food ->> 'polyunsaturated_fat_g')::NUMERIC,
      (p_food ->> 'trans_fat_g')::NUMERIC,
      (p_food ->> 'total_sugar_g')::NUMERIC,
      (p_food ->> 'added_sugar_g')::NUMERIC,
      (p_food ->> 'sugar_alcohol_g')::NUMERIC,
      (p_food ->> 'sodium_mg')::NUMERIC,
      (p_food ->> 'potassium_mg')::NUMERIC,
      'Imported from ' || source_value || '; pending administrator review.',
      auth.uid(),
      auth.uid()
    )
    RETURNING id INTO imported_food_id;

    INSERT INTO public.food_portions (
      food_id,
      portion_name,
      grams,
      is_default
    )
    SELECT
      imported_food_id,
      trim(portion ->> 'name'),
      (portion ->> 'grams')::NUMERIC,
      COALESCE((portion ->> 'is_default')::BOOLEAN, FALSE)
    FROM jsonb_array_elements(p_portions) AS portion;

    INSERT INTO public.food_public_aliases (
      food_id,
      alias,
      created_by
    )
    SELECT
      imported_food_id,
      trim(alias_value),
      auth.uid()
    FROM jsonb_array_elements_text(p_aliases) AS alias_value;

    RETURN jsonb_build_object(
      'status', 'success',
      'food_id', imported_food_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id
      INTO existing_food_id
      FROM public.foods
      WHERE visibility = 'public'
        AND source_name = source_value
        AND external_food_id = external_id_value
      LIMIT 1;

      IF existing_food_id IS NULL THEN
        RAISE;
      END IF;

      RETURN jsonb_build_object(
        'status', 'skipped',
        'food_id', existing_food_id
      );
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.import_public_food_item(UUID, JSONB, JSONB, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_public_food_item(UUID, JSONB, JSONB, JSONB)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
