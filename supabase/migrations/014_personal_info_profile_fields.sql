-- Personal info fields for settings/personal-info page
-- Adds nullable body information columns on profiles with minimal constraints

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_gender_allowed_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_gender_allowed_check
      CHECK (
        gender IS NULL OR gender IN ('male', 'female', 'other', 'prefer_not_to_say')
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_birth_date_not_future_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_birth_date_not_future_check
      CHECK (
        birth_date IS NULL OR birth_date <= CURRENT_DATE
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_height_cm_range_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_height_cm_range_check
      CHECK (
        height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 250)
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_weight_kg_range_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_weight_kg_range_check
      CHECK (
        weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 500)
      );
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
