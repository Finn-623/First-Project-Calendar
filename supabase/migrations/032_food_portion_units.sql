-- Preserve existing gram portions while allowing explicit units and unknown ml density.
ALTER TABLE public.food_portions
  ALTER COLUMN grams DROP NOT NULL;

ALTER TABLE public.food_portions
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS unit TEXT;

UPDATE public.food_portions
SET amount = grams,
    unit = 'g'
WHERE amount IS NULL OR unit IS NULL;

ALTER TABLE public.food_portions
  ALTER COLUMN amount SET NOT NULL,
  ALTER COLUMN unit SET DEFAULT 'g',
  ALTER COLUMN unit SET NOT NULL;

ALTER TABLE public.food_portions
  DROP CONSTRAINT IF EXISTS food_portions_grams_positive_check,
  ADD CONSTRAINT food_portions_grams_positive_check
    CHECK (grams IS NULL OR grams > 0),
  ADD CONSTRAINT food_portions_amount_positive_check
    CHECK (amount > 0),
  ADD CONSTRAINT food_portions_unit_check
    CHECK (unit IN ('g', 'ml')),
  ADD CONSTRAINT food_portions_ml_grams_consistency_check
    CHECK (unit = 'g' AND grams = amount OR unit = 'ml');

CREATE OR REPLACE FUNCTION public.sync_food_portion_unit_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.unit := COALESCE(NULLIF(trim(NEW.unit), ''), 'g');
  IF NEW.amount IS NULL AND NEW.grams IS NOT NULL THEN
    NEW.amount := NEW.grams;
  END IF;
  IF NEW.unit = 'g' THEN
    NEW.grams := NEW.amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_food_portion_unit_defaults ON public.food_portions;
CREATE TRIGGER sync_food_portion_unit_defaults
  BEFORE INSERT OR UPDATE ON public.food_portions
  FOR EACH ROW EXECUTE FUNCTION public.sync_food_portion_unit_defaults();

CREATE OR REPLACE FUNCTION public.save_personal_food(
  p_food_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_name_en TEXT DEFAULT NULL,
  p_brand TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_intake_types JSONB DEFAULT '[]'::JSONB,
  p_calories NUMERIC DEFAULT 0,
  p_protein NUMERIC DEFAULT 0,
  p_fat NUMERIC DEFAULT 0,
  p_carbs NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_portions JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id UUID := auth.uid();
  food_row public.foods;
  portion_row JSONB;
  portion_name TEXT;
  portion_unit TEXT;
  portion_amount NUMERIC;
  portion_grams NUMERIC;
  portion_default BOOLEAN;
  default_count INTEGER := 0;
  portion_count INTEGER := 0;
  normalized_portions JSONB := '[]'::JSONB;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NULLIF(trim(COALESCE(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'food name is required';
  END IF;

  IF p_calories IS NULL OR p_calories < 0
    OR p_protein IS NULL OR p_protein < 0
    OR p_fat IS NULL OR p_fat < 0
    OR p_carbs IS NULL OR p_carbs < 0 THEN
    RAISE EXCEPTION 'nutrients must be non-negative';
  END IF;

  IF jsonb_typeof(COALESCE(p_portions, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'portions must be an array';
  END IF;

  FOR portion_row IN SELECT value FROM jsonb_array_elements(COALESCE(p_portions, '[]'::JSONB)) LOOP
    portion_name := NULLIF(trim(COALESCE(portion_row->>'name', portion_row->>'portion_name', '')), '');
    portion_unit := lower(NULLIF(trim(COALESCE(portion_row->>'unit', '')), ''));
    portion_amount := NULLIF(trim(COALESCE(portion_row->>'amount', '')), '')::NUMERIC;
    portion_grams := NULLIF(trim(COALESCE(portion_row->>'grams', '')), '')::NUMERIC;
    portion_default := COALESCE((portion_row->>'isDefault')::BOOLEAN, (portion_row->>'is_default')::BOOLEAN, FALSE);

    IF portion_name IS NULL THEN
      RAISE EXCEPTION 'portion name is required';
    END IF;
    IF portion_unit NOT IN ('g', 'ml') THEN
      RAISE EXCEPTION 'portion unit must be g or ml';
    END IF;
    IF portion_amount IS NULL OR portion_amount <= 0 THEN
      RAISE EXCEPTION 'portion amount must be greater than zero';
    END IF;
    IF portion_unit = 'g' THEN
      portion_grams := portion_amount;
    ELSIF portion_grams IS NOT NULL AND portion_grams <= 0 THEN
      RAISE EXCEPTION 'portion grams must be greater than zero when provided';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(normalized_portions) AS existing(value)
      WHERE lower(trim(existing.value->>'name')) = lower(portion_name)
    ) THEN
      RAISE EXCEPTION 'portion names must be unique';
    END IF;

    IF portion_default THEN
      default_count := default_count + 1;
    END IF;
    portion_count := portion_count + 1;
    normalized_portions := normalized_portions || jsonb_build_array(jsonb_build_object(
      'name', portion_name,
      'amount', portion_amount,
      'unit', portion_unit,
      'grams', portion_grams,
      'isDefault', portion_default
    ));
  END LOOP;

  IF default_count > 1 THEN
    RAISE EXCEPTION 'only one default portion is allowed';
  END IF;

  IF p_food_id IS NULL THEN
    INSERT INTO public.foods (
      user_id, visibility, is_active, name, name_en, brand,
      primary_category, intake_types, default_quantity, unit,
      calories, protein, fat, carbs, energy_kcal, protein_g,
      carbohydrate_g, fat_g, notes
    ) VALUES (
      caller_id, 'private', TRUE, trim(p_name), NULLIF(trim(p_name_en), ''),
      NULLIF(trim(p_brand), ''), COALESCE(NULLIF(trim(p_category), ''), '其他'),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_intake_types, '[]'::JSONB))), ARRAY[]::TEXT[]),
      100, 'g', p_calories, p_protein, p_fat, p_carbs,
      p_calories, p_protein, p_carbs, p_fat, NULLIF(trim(p_notes), '')
    ) RETURNING * INTO food_row;
  ELSE
    UPDATE public.foods
    SET name = trim(p_name),
        name_en = NULLIF(trim(p_name_en), ''),
        brand = NULLIF(trim(p_brand), ''),
        primary_category = COALESCE(NULLIF(trim(p_category), ''), '其他'),
        intake_types = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_intake_types, '[]'::JSONB))), ARRAY[]::TEXT[]),
        calories = p_calories,
        protein = p_protein,
        fat = p_fat,
        carbs = p_carbs,
        energy_kcal = p_calories,
        protein_g = p_protein,
        carbohydrate_g = p_carbs,
        fat_g = p_fat,
        notes = NULLIF(trim(p_notes), ''),
        updated_at = NOW()
    WHERE id = p_food_id
      AND user_id = caller_id
      AND visibility = 'private'
      AND is_active = TRUE
    RETURNING * INTO food_row;

    IF food_row.id IS NULL THEN
      RAISE EXCEPTION 'personal food not found or not owned by caller';
    END IF;

    DELETE FROM public.food_portions WHERE food_id = food_row.id;
  END IF;

  INSERT INTO public.food_portions (food_id, portion_name, amount, unit, grams, is_default)
  SELECT food_row.id, value->>'name', (value->>'amount')::NUMERIC, value->>'unit',
    NULLIF(value->>'grams', '')::NUMERIC, (value->>'isDefault')::BOOLEAN
  FROM jsonb_array_elements(normalized_portions);

  RETURN jsonb_build_object(
    'food_id', food_row.id,
    'created', p_food_id IS NULL,
    'portion_count', portion_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_personal_food(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_personal_food(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) TO authenticated;