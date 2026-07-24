-- Admin-managed public foods, role-based access, and food audit fields

-- 1) Profiles: add role field for admin checks
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('admin', 'user'));
  END IF;
END
$$;

-- 2) Foods: add admin/public metadata fields without breaking private foods
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS brand TEXT;

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.foods
SET created_by = COALESCE(created_by, user_id)
WHERE created_by IS NULL
  AND user_id IS NOT NULL;

UPDATE public.foods
SET updated_by = COALESCE(updated_by, user_id)
WHERE updated_by IS NULL
  AND user_id IS NOT NULL;

UPDATE public.foods
SET is_active = TRUE
WHERE is_active IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'foods_public_notes_required'
      AND conrelid = 'public.foods'::regclass
  ) THEN
    ALTER TABLE public.foods
      ADD CONSTRAINT foods_public_notes_required
      CHECK (
        visibility <> 'public'
        OR length(trim(coalesce(notes, ''))) > 0
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_foods_visibility_active_name
  ON public.foods(visibility, is_active, name);

CREATE INDEX IF NOT EXISTS idx_foods_public_brand_name
  ON public.foods(visibility, brand, name);

-- 3) Replace food policies with role-aware policies
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

CREATE POLICY foods_select_public_or_own_private_or_admin
  ON public.foods
  FOR SELECT
  TO authenticated
  USING (
    (
      visibility = 'public'
      AND is_active = TRUE
    )
    OR (
      visibility = 'private'
      AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY foods_insert_private_own_only
  ON public.foods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    visibility = 'private'
    AND user_id = auth.uid()
  );

CREATE POLICY foods_insert_public_admin_only
  ON public.foods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    visibility = 'public'
    AND user_id IS NULL
    AND is_active = TRUE
    AND length(trim(coalesce(notes, ''))) > 0
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY foods_update_private_own_only
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

CREATE POLICY foods_update_public_admin_only
  ON public.foods
  FOR UPDATE
  TO authenticated
  USING (
    visibility = 'public'
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    visibility = 'public'
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
    AND length(trim(coalesce(notes, ''))) > 0
  );

CREATE POLICY foods_delete_private_own_only
  ON public.foods
  FOR DELETE
  TO authenticated
  USING (
    visibility = 'private'
    AND user_id = auth.uid()
  );

CREATE POLICY foods_delete_public_admin_only
  ON public.foods
  FOR DELETE
  TO authenticated
  USING (
    visibility = 'public'
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- 4) Audit fields for foods
CREATE OR REPLACE FUNCTION public.set_food_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by = COALESCE(NEW.updated_by, auth.uid());
    NEW.created_at = COALESCE(NEW.created_at, NOW());
    NEW.updated_at = COALESCE(NEW.updated_at, NOW());
  ELSE
    NEW.updated_by = COALESCE(auth.uid(), NEW.updated_by);
    NEW.updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_foods_updated_at ON public.foods;
DROP TRIGGER IF EXISTS set_foods_audit_fields ON public.foods;

CREATE TRIGGER set_foods_audit_fields
BEFORE INSERT OR UPDATE ON public.foods
FOR EACH ROW
EXECUTE FUNCTION public.set_food_audit_fields();

-- 5) Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';