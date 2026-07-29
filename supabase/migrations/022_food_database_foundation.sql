-- v0.2.1 food database foundation.
-- Extends the existing foods table in place so current personal foods and
-- food_entries snapshots remain valid. Expanded nutrient columns stay nullable:
-- NULL means unknown and must never be rewritten to zero. The four legacy
-- nutrient columns are backfilled into their canonical per-100g counterparts.
-- fiber_g cannot be inferred safely, so enforcing all five core nutrients is a
-- staged follow-up after legacy rows and the food editor have been upgraded.

-- ---------------------------------------------------------------------------
-- 1. Food identity, provenance, review state, classification and nutrients
-- ---------------------------------------------------------------------------
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS external_food_id TEXT,
  ADD COLUMN IF NOT EXISTS source_public_food_id UUID
    REFERENCES public.foods(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS preparation_state TEXT NOT NULL DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS primary_category TEXT NOT NULL DEFAULT '其他',
  ADD COLUMN IF NOT EXISTS secondary_category TEXT,
  ADD COLUMN IF NOT EXISTS intake_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS energy_kcal NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS protein_g NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS carbohydrate_g NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS fat_g NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS fiber_g NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS saturated_fat_g NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS monounsaturated_fat_g NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS polyunsaturated_fat_g NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS trans_fat_g NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS total_sugar_g NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS added_sugar_g NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS sugar_alcohol_g NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS sodium_mg NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS potassium_mg NUMERIC(10, 2);

UPDATE public.foods
SET
  energy_kcal = COALESCE(energy_kcal, calories),
  protein_g = COALESCE(protein_g, protein),
  carbohydrate_g = COALESCE(carbohydrate_g, carbs),
  fat_g = COALESCE(fat_g, fat),
  review_status = CASE
    WHEN is_active = FALSE THEN 'disabled'
    ELSE COALESCE(review_status, 'approved')
  END,
  preparation_state = COALESCE(NULLIF(trim(preparation_state), ''), 'unspecified'),
  primary_category = COALESCE(NULLIF(trim(primary_category), ''), '其他'),
  intake_types = COALESCE(intake_types, ARRAY[]::TEXT[]);

ALTER TABLE public.foods
  DROP CONSTRAINT IF EXISTS foods_review_status_check,
  ADD CONSTRAINT foods_review_status_check
    CHECK (review_status IN ('pending', 'approved', 'disabled')),
  DROP CONSTRAINT IF EXISTS foods_preparation_state_check,
  ADD CONSTRAINT foods_preparation_state_check
    CHECK (preparation_state IN ('raw', 'cooked', 'unspecified')),
  DROP CONSTRAINT IF EXISTS foods_primary_category_required_check,
  ADD CONSTRAINT foods_primary_category_required_check
    CHECK (length(trim(primary_category)) > 0),
  DROP CONSTRAINT IF EXISTS foods_intake_types_allowed_check,
  ADD CONSTRAINT foods_intake_types_allowed_check
    CHECK (
      intake_types <@ ARRAY['carbohydrate', 'protein', 'fat', 'fiber']::TEXT[]
    ),
  DROP CONSTRAINT IF EXISTS foods_source_public_private_only_check,
  ADD CONSTRAINT foods_source_public_private_only_check
    CHECK (source_public_food_id IS NULL OR visibility = 'private'),
  DROP CONSTRAINT IF EXISTS foods_nutrients_nonnegative_check,
  ADD CONSTRAINT foods_nutrients_nonnegative_check
    CHECK (
      calories >= 0
      AND protein >= 0
      AND fat >= 0
      AND carbs >= 0
      AND (energy_kcal IS NULL OR energy_kcal >= 0)
      AND (protein_g IS NULL OR protein_g >= 0)
      AND (carbohydrate_g IS NULL OR carbohydrate_g >= 0)
      AND (fat_g IS NULL OR fat_g >= 0)
      AND (fiber_g IS NULL OR fiber_g >= 0)
      AND (saturated_fat_g IS NULL OR saturated_fat_g >= 0)
      AND (monounsaturated_fat_g IS NULL OR monounsaturated_fat_g >= 0)
      AND (polyunsaturated_fat_g IS NULL OR polyunsaturated_fat_g >= 0)
      AND (trans_fat_g IS NULL OR trans_fat_g >= 0)
      AND (total_sugar_g IS NULL OR total_sugar_g >= 0)
      AND (added_sugar_g IS NULL OR added_sugar_g >= 0)
      AND (sugar_alcohol_g IS NULL OR sugar_alcohol_g >= 0)
      AND (sodium_mg IS NULL OR sodium_mg >= 0)
      AND (potassium_mg IS NULL OR potassium_mg >= 0)
    ) NOT VALID,
  DROP CONSTRAINT IF EXISTS foods_total_sugar_within_carbohydrate_check,
  ADD CONSTRAINT foods_total_sugar_within_carbohydrate_check
    CHECK (
      total_sugar_g IS NULL
      OR carbohydrate_g IS NULL
      OR total_sugar_g <= carbohydrate_g
    ) NOT VALID,
  DROP CONSTRAINT IF EXISTS foods_added_sugar_within_total_check,
  ADD CONSTRAINT foods_added_sugar_within_total_check
    CHECK (
      added_sugar_g IS NULL
      OR total_sugar_g IS NULL
      OR added_sugar_g <= total_sugar_g
    ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_public_source_external_unique
  ON public.foods(source_name, external_food_id)
  WHERE visibility = 'public'
    AND source_name IS NOT NULL
    AND external_food_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_foods_source_public_food_id
  ON public.foods(source_public_food_id)
  WHERE source_public_food_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_foods_visibility_review_active_name
  ON public.foods(visibility, review_status, is_active, name);

CREATE OR REPLACE FUNCTION public.enforce_food_foundation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  source_visibility TEXT;
BEGIN
  -- Keep current clients and canonical per-100g columns consistent.
  IF TG_OP = 'INSERT' THEN
    NEW.energy_kcal := COALESCE(NEW.energy_kcal, NEW.calories);
    NEW.calories := COALESCE(NEW.energy_kcal, NEW.calories);
    NEW.protein_g := COALESCE(NEW.protein_g, NEW.protein);
    NEW.protein := NEW.protein_g;
    NEW.carbohydrate_g := COALESCE(NEW.carbohydrate_g, NEW.carbs);
    NEW.carbs := NEW.carbohydrate_g;
    NEW.fat_g := COALESCE(NEW.fat_g, NEW.fat);
    NEW.fat := NEW.fat_g;
  ELSIF NEW.calories IS DISTINCT FROM OLD.calories THEN
    NEW.energy_kcal := NEW.calories;
  ELSIF NEW.energy_kcal IS DISTINCT FROM OLD.energy_kcal THEN
    NEW.calories := NEW.energy_kcal;
  END IF;

  IF TG_OP <> 'INSERT' AND NEW.protein IS DISTINCT FROM OLD.protein THEN
    NEW.protein_g := NEW.protein;
  ELSIF TG_OP <> 'INSERT' AND NEW.protein_g IS DISTINCT FROM OLD.protein_g THEN
    NEW.protein := NEW.protein_g;
  END IF;

  IF TG_OP <> 'INSERT' AND NEW.carbs IS DISTINCT FROM OLD.carbs THEN
    NEW.carbohydrate_g := NEW.carbs;
  ELSIF TG_OP <> 'INSERT' AND NEW.carbohydrate_g IS DISTINCT FROM OLD.carbohydrate_g THEN
    NEW.carbs := NEW.carbohydrate_g;
  END IF;

  IF TG_OP <> 'INSERT' AND NEW.fat IS DISTINCT FROM OLD.fat THEN
    NEW.fat_g := NEW.fat;
  ELSIF TG_OP <> 'INSERT' AND NEW.fat_g IS DISTINCT FROM OLD.fat_g THEN
    NEW.fat := NEW.fat_g;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.review_status = 'disabled'
    AND NEW.is_active = TRUE
    AND NEW.review_status = OLD.review_status
  THEN
    NEW.review_status := 'approved';
  ELSIF NEW.review_status = 'disabled' OR NEW.is_active = FALSE THEN
    NEW.review_status := 'disabled';
    NEW.is_active := FALSE;
  END IF;

  IF NEW.source_public_food_id IS NOT NULL THEN
    SELECT visibility
    INTO source_visibility
    FROM public.foods
    WHERE id = NEW.source_public_food_id;

    IF source_visibility IS DISTINCT FROM 'public' THEN
      RAISE EXCEPTION 'source_public_food_id must reference a public food';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_foods_enforce_foundation ON public.foods;
CREATE TRIGGER trg_foods_enforce_foundation
BEFORE INSERT OR UPDATE ON public.foods
FOR EACH ROW
EXECUTE FUNCTION public.enforce_food_foundation();

CREATE OR REPLACE FUNCTION public.prevent_referenced_food_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND EXISTS (
    SELECT 1
    FROM public.food_entries
    WHERE source_food_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'referenced foods must be disabled, not deleted';
  END IF;

  IF OLD.visibility = 'public' AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'public foods must be disabled, not deleted';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_foods_prevent_referenced_delete ON public.foods;
CREATE TRIGGER trg_foods_prevent_referenced_delete
BEFORE DELETE ON public.foods
FOR EACH ROW
EXECUTE FUNCTION public.prevent_referenced_food_delete();

-- ---------------------------------------------------------------------------
-- 2. Portions, public aliases and user-private aliases
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.food_portions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  portion_name TEXT NOT NULL,
  grams NUMERIC(10, 2) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT food_portions_name_required_check
    CHECK (length(trim(portion_name)) > 0),
  CONSTRAINT food_portions_grams_positive_check
    CHECK (grams > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_portions_food_name_unique
  ON public.food_portions(food_id, lower(trim(portion_name)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_portions_one_default
  ON public.food_portions(food_id)
  WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS public.food_public_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT food_public_aliases_alias_required_check
    CHECK (length(trim(alias)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_public_aliases_food_alias_unique
  ON public.food_public_aliases(food_id, lower(trim(alias)));

CREATE TABLE IF NOT EXISTS public.food_private_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT food_private_aliases_alias_required_check
    CHECK (length(trim(alias)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_private_aliases_user_food_alias_unique
  ON public.food_private_aliases(user_id, food_id, lower(trim(alias)));

CREATE INDEX IF NOT EXISTS idx_food_private_aliases_user
  ON public.food_private_aliases(user_id);

CREATE OR REPLACE FUNCTION public.enforce_food_alias_relationship()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_food public.foods%ROWTYPE;
BEGIN
  SELECT *
  INTO target_food
  FROM public.foods
  WHERE id = NEW.food_id;

  IF TG_TABLE_NAME = 'food_public_aliases' THEN
    IF target_food.visibility IS DISTINCT FROM 'public' THEN
      RAISE EXCEPTION 'public aliases must reference a public food';
    END IF;
  ELSE
    IF NOT (
      target_food.visibility = 'public'
      OR (
        target_food.visibility = 'private'
        AND target_food.user_id = NEW.user_id
      )
    ) THEN
      RAISE EXCEPTION 'private aliases may only reference visible foods';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_food_public_alias_relationship
  ON public.food_public_aliases;
CREATE TRIGGER trg_food_public_alias_relationship
BEFORE INSERT OR UPDATE ON public.food_public_aliases
FOR EACH ROW
EXECUTE FUNCTION public.enforce_food_alias_relationship();

DROP TRIGGER IF EXISTS trg_food_private_alias_relationship
  ON public.food_private_aliases;
CREATE TRIGGER trg_food_private_alias_relationship
BEFORE INSERT OR UPDATE ON public.food_private_aliases
FOR EACH ROW
EXECUTE FUNCTION public.enforce_food_alias_relationship();

-- ---------------------------------------------------------------------------
-- 3. RLS: approved public data, own private data, admin public management
-- ---------------------------------------------------------------------------
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_portions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_public_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_private_aliases ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'foods'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.foods', policy_name);
  END LOOP;
END
$$;

CREATE POLICY foods_select_approved_public
  ON public.foods
  FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'public'
    AND review_status = 'approved'
    AND is_active = TRUE
  );

CREATE POLICY foods_select_own_private
  ON public.foods
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'private'
    AND user_id = auth.uid()
  );

CREATE POLICY foods_select_public_admin
  ON public.foods
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    AND public.is_app_admin(auth.uid())
  );

CREATE POLICY foods_insert_own_private
  ON public.foods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    visibility = 'private'
    AND user_id = auth.uid()
  );

CREATE POLICY foods_update_own_private
  ON public.foods
  FOR UPDATE
  TO authenticated
  USING (
    visibility = 'private'
    AND user_id = auth.uid()
  )
  WITH CHECK (
    visibility = 'private'
    AND user_id = auth.uid()
  );

CREATE POLICY foods_delete_unreferenced_own_private
  ON public.foods
  FOR DELETE
  TO authenticated
  USING (
    visibility = 'private'
    AND user_id = auth.uid()
  );

CREATE POLICY foods_insert_public_admin
  ON public.foods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    visibility = 'public'
    AND user_id IS NULL
    AND public.is_app_admin(auth.uid())
  );

CREATE POLICY foods_update_public_admin
  ON public.foods
  FOR UPDATE
  TO authenticated
  USING (
    visibility = 'public'
    AND public.is_app_admin(auth.uid())
  )
  WITH CHECK (
    visibility = 'public'
    AND user_id IS NULL
    AND public.is_app_admin(auth.uid())
  );

CREATE POLICY food_portions_select_visible_food
  ON public.food_portions
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.foods
      WHERE foods.id = food_portions.food_id
    )
  );

CREATE POLICY food_portions_insert_follow_food
  ON public.food_portions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.foods
      WHERE foods.id = food_portions.food_id
        AND (
          (foods.visibility = 'private' AND foods.user_id = auth.uid())
          OR (foods.visibility = 'public' AND public.is_app_admin(auth.uid()))
        )
    )
  );

CREATE POLICY food_portions_update_follow_food
  ON public.food_portions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.foods
      WHERE foods.id = food_portions.food_id
        AND (
          (foods.visibility = 'private' AND foods.user_id = auth.uid())
          OR (foods.visibility = 'public' AND public.is_app_admin(auth.uid()))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.foods
      WHERE foods.id = food_portions.food_id
        AND (
          (foods.visibility = 'private' AND foods.user_id = auth.uid())
          OR (foods.visibility = 'public' AND public.is_app_admin(auth.uid()))
        )
    )
  );

CREATE POLICY food_portions_delete_follow_food
  ON public.food_portions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.foods
      WHERE foods.id = food_portions.food_id
        AND (
          (foods.visibility = 'private' AND foods.user_id = auth.uid())
          OR (foods.visibility = 'public' AND public.is_app_admin(auth.uid()))
        )
    )
  );

CREATE POLICY food_public_aliases_select_visible
  ON public.food_public_aliases
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.foods
      WHERE foods.id = food_public_aliases.food_id
    )
  );

CREATE POLICY food_public_aliases_insert_admin
  ON public.food_public_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_app_admin(auth.uid()));

CREATE POLICY food_public_aliases_update_admin
  ON public.food_public_aliases
  FOR UPDATE
  TO authenticated
  USING (public.is_app_admin(auth.uid()))
  WITH CHECK (public.is_app_admin(auth.uid()));

CREATE POLICY food_public_aliases_delete_admin
  ON public.food_public_aliases
  FOR DELETE
  TO authenticated
  USING (public.is_app_admin(auth.uid()));

CREATE POLICY food_private_aliases_select_own
  ON public.food_private_aliases
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY food_private_aliases_insert_own
  ON public.food_private_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY food_private_aliases_update_own
  ON public.food_private_aliases
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY food_private_aliases_delete_own
  ON public.food_private_aliases
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON COLUMN public.foods.energy_kcal IS
  'Canonical energy per 100g. Nullable only for staged legacy compatibility.';
COMMENT ON COLUMN public.foods.fiber_g IS
  'Fiber per 100g. NULL means unknown; never substitute zero.';
COMMENT ON COLUMN public.foods.source_public_food_id IS
  'Public source used to create a user-owned private copy.';
COMMENT ON TABLE public.food_portions IS
  'Named gram-equivalent portions; permissions follow the related food.';
COMMENT ON TABLE public.food_public_aliases IS
  'Administrator-maintained aliases for public foods.';
COMMENT ON TABLE public.food_private_aliases IS
  'User-private aliases for visible public foods or the user own food.';

NOTIFY pgrst, 'reload schema';
