-- P0 #20: atomically copy an approved public food into the current user's
-- private library. The source relationship already exists from migration 022.

CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_one_private_copy_per_public_source
  ON public.foods(user_id, source_public_food_id)
  WHERE visibility = 'private' AND source_public_food_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.copy_public_food_to_personal(
  p_source_food_id UUID,
  p_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id UUID := auth.uid();
  source_food public.foods%ROWTYPE;
  copied_food public.foods%ROWTYPE;
  final_name TEXT;
  alias_count INTEGER := 0;
  portion_count INTEGER := 0;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_source_food_id IS NULL THEN
    RAISE EXCEPTION 'source food is required';
  END IF;

  -- Serialize repeated clicks and retries for the same user/source pair.
  PERFORM pg_advisory_xact_lock(hashtextextended(caller_id::TEXT || ':' || p_source_food_id::TEXT, 0));

  SELECT * INTO source_food
  FROM public.foods
  WHERE id = p_source_food_id
    AND visibility = 'public'
    AND review_status = 'approved'
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'public food is not available';
  END IF;

  SELECT * INTO copied_food
  FROM public.foods
  WHERE user_id = caller_id
    AND visibility = 'private'
    AND source_public_food_id = source_food.id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'food_id', copied_food.id,
      'created', FALSE,
      'already_exists', TRUE
    );
  END IF;

  final_name := COALESCE(NULLIF(trim(p_name), ''), source_food.name);

  INSERT INTO public.foods (
    user_id, visibility, name, name_en, brand, image_url,
    default_quantity, unit, calories, protein, fat, carbs, notes,
    source_public_food_id, review_status, preparation_state,
    primary_category, secondary_category, intake_types,
    energy_kcal, protein_g, carbohydrate_g, fat_g, fiber_g,
    saturated_fat_g, monounsaturated_fat_g, polyunsaturated_fat_g,
    trans_fat_g, total_sugar_g, added_sugar_g, sugar_alcohol_g,
    sodium_mg, potassium_mg, is_active, created_by, updated_by
  ) VALUES (
    caller_id, 'private', final_name, source_food.name_en, source_food.brand,
    source_food.image_url, source_food.default_quantity, source_food.unit,
    source_food.calories, source_food.protein, source_food.fat, source_food.carbs,
    '复制自公共食品：' || source_food.name,
    source_food.id, 'approved', source_food.preparation_state,
    source_food.primary_category, source_food.secondary_category,
    source_food.intake_types, source_food.energy_kcal, source_food.protein_g,
    source_food.carbohydrate_g, source_food.fat_g, source_food.fiber_g,
    source_food.saturated_fat_g, source_food.monounsaturated_fat_g,
    source_food.polyunsaturated_fat_g, source_food.trans_fat_g,
    source_food.total_sugar_g, source_food.added_sugar_g,
    source_food.sugar_alcohol_g, source_food.sodium_mg, source_food.potassium_mg,
    TRUE, caller_id, caller_id
  )
  RETURNING * INTO copied_food;

  INSERT INTO public.food_private_aliases (food_id, user_id, alias)
  SELECT copied_food.id, caller_id, trim(public_alias.alias)
  FROM public.food_public_aliases AS public_alias
  WHERE public_alias.food_id = source_food.id
    AND length(trim(public_alias.alias)) > 0
    AND lower(trim(public_alias.alias)) <> lower(trim(final_name))
    AND lower(trim(public_alias.alias)) <> lower(trim(source_food.name))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS alias_count = ROW_COUNT;

  INSERT INTO public.food_portions (food_id, portion_name, grams, is_default)
  SELECT copied_food.id, portion.portion_name, portion.grams, portion.is_default
  FROM public.food_portions AS portion
  WHERE portion.food_id = source_food.id
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS portion_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'food_id', copied_food.id,
    'created', TRUE,
    'already_exists', FALSE,
    'alias_count', alias_count,
    'portion_count', portion_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.copy_public_food_to_personal(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_public_food_to_personal(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.copy_public_food_to_personal(UUID, TEXT) IS
  'Atomically copies one approved active public food and its visible aliases/portions into auth.uid() private library.';

NOTIFY pgrst, 'reload schema';
