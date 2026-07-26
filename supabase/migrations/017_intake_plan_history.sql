-- Intake plan history snapshots and atomic save RPC.

ALTER TABLE public.daily_targets
  ADD COLUMN IF NOT EXISTS calculated_field TEXT NOT NULL DEFAULT 'calories';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_targets_calculated_field_check'
      AND conrelid = 'public.daily_targets'::regclass
  ) THEN
    ALTER TABLE public.daily_targets
      ADD CONSTRAINT daily_targets_calculated_field_check
      CHECK (calculated_field IN ('calories', 'protein', 'fat', 'carbs'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.intake_plan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calories_kcal NUMERIC(10, 2) NOT NULL,
  protein_g NUMERIC(10, 2) NOT NULL,
  fat_g NUMERIC(10, 2) NOT NULL,
  carbs_g NUMERIC(10, 2) NOT NULL,
  calculated_field TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'intake_plan_history_calculated_field_check'
      AND conrelid = 'public.intake_plan_history'::regclass
  ) THEN
    ALTER TABLE public.intake_plan_history
      ADD CONSTRAINT intake_plan_history_calculated_field_check
      CHECK (calculated_field IN ('calories', 'protein', 'fat', 'carbs'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_intake_plan_history_user_created
  ON public.intake_plan_history (user_id, created_at DESC);

ALTER TABLE public.intake_plan_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'intake_plan_history'
      AND policyname = 'intake_plan_history_select_own'
  ) THEN
    CREATE POLICY intake_plan_history_select_own
      ON public.intake_plan_history
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'intake_plan_history'
      AND policyname = 'intake_plan_history_insert_own'
  ) THEN
    CREATE POLICY intake_plan_history_insert_own
      ON public.intake_plan_history
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.save_intake_plan_with_history(
  p_calories_kcal NUMERIC,
  p_protein_g NUMERIC,
  p_fat_g NUMERIC,
  p_carbs_g NUMERIC,
  p_calculated_field TEXT,
  p_target_date DATE DEFAULT CURRENT_DATE
)
RETURNS public.daily_targets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_target public.daily_targets;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF p_calculated_field NOT IN ('calories', 'protein', 'fat', 'carbs') THEN
    RAISE EXCEPTION 'invalid calculated field';
  END IF;

  IF p_calories_kcal < 0 OR p_protein_g < 0 OR p_fat_g < 0 OR p_carbs_g < 0 THEN
    RAISE EXCEPTION 'negative targets are not allowed';
  END IF;

  INSERT INTO public.daily_targets (
    user_id,
    target_date,
    calories_target,
    protein_target,
    fat_target,
    carbs_target,
    calculated_field
  ) VALUES (
    v_user_id,
    p_target_date,
    p_calories_kcal,
    p_protein_g,
    p_fat_g,
    p_carbs_g,
    p_calculated_field
  )
  ON CONFLICT (user_id, target_date)
  DO UPDATE SET
    calories_target = EXCLUDED.calories_target,
    protein_target = EXCLUDED.protein_target,
    fat_target = EXCLUDED.fat_target,
    carbs_target = EXCLUDED.carbs_target,
    calculated_field = EXCLUDED.calculated_field,
    updated_at = NOW()
  RETURNING * INTO v_target;

  INSERT INTO public.intake_plan_history (
    user_id,
    calories_kcal,
    protein_g,
    fat_g,
    carbs_g,
    calculated_field
  ) VALUES (
    v_user_id,
    p_calories_kcal,
    p_protein_g,
    p_fat_g,
    p_carbs_g,
    p_calculated_field
  );

  RETURN v_target;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_intake_plan_with_history(NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
