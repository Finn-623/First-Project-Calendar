-- Add visibility support for public/private food libraries
-- Safe, idempotent migration for existing foods table

-- 1) Ensure foods.visibility exists and defaults to private
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS visibility TEXT;

ALTER TABLE public.foods
  ALTER COLUMN visibility SET DEFAULT 'private';

UPDATE public.foods
SET visibility = 'private'
WHERE visibility IS NULL
  AND user_id IS NOT NULL;

UPDATE public.foods
SET visibility = 'public'
WHERE visibility IS NULL
  AND user_id IS NULL;

ALTER TABLE public.foods
  ALTER COLUMN visibility SET NOT NULL;

-- 2) Allow public foods by making user_id nullable
ALTER TABLE public.foods
  ALTER COLUMN user_id DROP NOT NULL;

-- 3) Enforce valid visibility values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.foods'::regclass
      AND conname = 'foods_visibility_values_check'
  ) THEN
    ALTER TABLE public.foods
      ADD CONSTRAINT foods_visibility_values_check
      CHECK (visibility IN ('public', 'private'));
  END IF;
END
$$;

-- 4) Enforce visibility/user_id relationship
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.foods'::regclass
      AND conname = 'foods_visibility_user_id_consistency_check'
  ) THEN
    ALTER TABLE public.foods
      ADD CONSTRAINT foods_visibility_user_id_consistency_check
      CHECK (
        (visibility = 'public' AND user_id IS NULL)
        OR
        (visibility = 'private' AND user_id IS NOT NULL)
      );
  END IF;
END
$$;

-- 5) Ensure RLS is enabled
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

-- 6) Replace existing foods policies with visibility-aware policies
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

CREATE POLICY foods_select_public_or_own_private
  ON public.foods
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR user_id = auth.uid()
  );

CREATE POLICY foods_insert_own_private_only
  ON public.foods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    visibility = 'private'
    AND user_id = auth.uid()
  );

CREATE POLICY foods_update_own_private_only
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

CREATE POLICY foods_delete_own_private_only
  ON public.foods
  FOR DELETE
  TO authenticated
  USING (
    visibility = 'private'
    AND user_id = auth.uid()
  );

-- 7) Ensure food_entries.source_food_id FK uses ON DELETE SET NULL
DO $$
DECLARE
  source_food_attnum SMALLINT;
  existing_fk_name TEXT;
  existing_fk_deltype "char";
BEGIN
  SELECT a.attnum
  INTO source_food_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.food_entries'::regclass
    AND a.attname = 'source_food_id'
    AND NOT a.attisdropped;

  IF source_food_attnum IS NULL THEN
    RETURN;
  END IF;

  SELECT c.conname, c.confdeltype
  INTO existing_fk_name, existing_fk_deltype
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid = 'public.food_entries'::regclass
    AND c.confrelid = 'public.foods'::regclass
    AND source_food_attnum = ANY (c.conkey)
  LIMIT 1;

  IF existing_fk_name IS NULL THEN
    ALTER TABLE public.food_entries
      ADD CONSTRAINT food_entries_source_food_id_fkey
      FOREIGN KEY (source_food_id)
      REFERENCES public.foods(id)
      ON DELETE SET NULL;
  ELSIF existing_fk_deltype <> 'n' THEN
    EXECUTE format(
      'ALTER TABLE public.food_entries DROP CONSTRAINT %I',
      existing_fk_name
    );

    ALTER TABLE public.food_entries
      ADD CONSTRAINT food_entries_source_food_id_fkey
      FOREIGN KEY (source_food_id)
      REFERENCES public.foods(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- 8) Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
