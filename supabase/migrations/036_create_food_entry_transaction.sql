-- Atomically create/reuse a meal and add one idempotent food entry.

ALTER TABLE public.food_entries
  ADD COLUMN IF NOT EXISTS client_mutation_id TEXT,
  ADD COLUMN IF NOT EXISTS portion_snapshot JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_entries_user_client_mutation
  ON public.food_entries (user_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_food_entry_for_meal(
  record_date DATE,
  meal JSONB,
  food JSONB,
  mutation_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_id UUID := auth.uid();
  meal_row public.timeline_items%ROWTYPE;
  food_row public.food_entries%ROWTYPE;
  meal_type TEXT := COALESCE(NULLIF(meal->>'subtype', ''), NULLIF(meal->>'item_type', ''));
  meal_id UUID;
  source_id UUID;
  quantity_value NUMERIC;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF record_date IS NULL OR record_date::TEXT !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'INVALID_RECORD_DATE' USING ERRCODE = '22023';
  END IF;

  IF meal_type NOT IN ('breakfast', 'lunch', 'dinner', 'snack') THEN
    RAISE EXCEPTION 'INVALID_MEAL_TYPE' USING ERRCODE = '22023';
  END IF;

  IF mutation_id IS NULL OR btrim(mutation_id) = '' OR length(mutation_id) > 120 THEN
    RAISE EXCEPTION 'INVALID_MUTATION_ID' USING ERRCODE = '22023';
  END IF;

  BEGIN
    quantity_value := (food->>'quantity')::NUMERIC;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
  END;

  IF quantity_value IS NULL OR quantity_value <= 0 OR quantity_value > 99999999.99 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
  END IF;

  IF btrim(COALESCE(food->>'name', '')) = '' THEN
    RAISE EXCEPTION 'INVALID_FOOD_NAME' USING ERRCODE = '22023';
  END IF;

  -- Retries return the row created by the first request.
  SELECT * INTO food_row
  FROM public.food_entries
  WHERE user_id = caller_id AND client_mutation_id = mutation_id;

  IF FOUND THEN
    SELECT * INTO meal_row FROM public.timeline_items WHERE id = food_row.timeline_item_id;
    RETURN jsonb_build_object('meal', to_jsonb(meal_row), 'food_entry', to_jsonb(food_row));
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(caller_id::TEXT || ':' || record_date::TEXT || ':' || meal_type, 0));

  BEGIN
    meal_id := NULLIF(meal->>'id', '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    meal_id := NULL;
  END;

  IF meal_id IS NOT NULL THEN
    SELECT * INTO meal_row
    FROM public.timeline_items
    WHERE id = meal_id AND user_id = caller_id AND event_date = record_date AND item_type = meal_type;
  END IF;

  IF meal_row.id IS NULL AND meal_type IN ('breakfast', 'lunch', 'dinner') THEN
    SELECT * INTO meal_row
    FROM public.timeline_items
    WHERE user_id = caller_id AND event_date = record_date AND item_type = meal_type
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF meal_row.id IS NULL THEN
    INSERT INTO public.timeline_items (
      user_id, event_date, event_time, item_type, title, notes, details, sort_order
    ) VALUES (
      caller_id,
      record_date,
      COALESCE(NULLIF(meal->>'time', '')::TIME, '12:00'::TIME),
      meal_type,
      COALESCE(NULLIF(btrim(meal->>'title'), ''), '餐次'),
      NULLIF(meal->>'notes', ''),
      COALESCE(meal->'details', '{}'::JSONB),
      COALESCE((meal->>'sort_order')::INTEGER, 0)
    ) RETURNING * INTO meal_row;
  END IF;

  BEGIN
    source_id := NULLIF(food->>'food_id', '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'INVALID_SOURCE_FOOD_ID' USING ERRCODE = '22023';
  END;

  INSERT INTO public.food_entries (
    user_id, timeline_item_id, source_food_id, food_name_snapshot, quantity,
    unit_snapshot, calories_snapshot, protein_snapshot, fat_snapshot,
    carbs_snapshot, client_mutation_id, portion_snapshot
  ) VALUES (
    caller_id,
    meal_row.id,
    source_id,
    btrim(food->>'name'),
    quantity_value,
    COALESCE(NULLIF(food->>'unit', ''), 'g'),
    COALESCE((food->>'calories')::NUMERIC, 0),
    COALESCE((food->>'protein')::NUMERIC, 0),
    COALESCE((food->>'fat')::NUMERIC, 0),
    COALESCE((food->>'carbs')::NUMERIC, 0),
    mutation_id,
    food->'portion'
  )
  ON CONFLICT (user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL
  DO UPDATE SET client_mutation_id = EXCLUDED.client_mutation_id
  RETURNING * INTO food_row;

  RETURN jsonb_build_object('meal', to_jsonb(meal_row), 'food_entry', to_jsonb(food_row));
END;
$$;

REVOKE ALL ON FUNCTION public.create_food_entry_for_meal(DATE, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_food_entry_for_meal(DATE, JSONB, JSONB, TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_food_entry_for_meal(DATE, JSONB, JSONB, TEXT) IS
  'Creates/reuses an owned meal and inserts one food snapshot atomically; mutation_id makes retries idempotent.';
