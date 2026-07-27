-- User record settings for automatic daily archiving

CREATE TABLE IF NOT EXISTS public.user_record_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_archive_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  auto_archive_time TIME NOT NULL DEFAULT '00:00:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_record_settings_user_id
  ON public.user_record_settings (user_id);

ALTER TABLE public.user_record_settings ENABLE ROW LEVEL SECURITY;

-- SELECT policy: allow users to read their own settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_record_settings'
      AND policyname = 'user_record_settings_select_own'
  ) THEN
    CREATE POLICY user_record_settings_select_own
      ON public.user_record_settings
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- INSERT policy: allow users to insert their own settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_record_settings'
      AND policyname = 'user_record_settings_insert_own'
  ) THEN
    CREATE POLICY user_record_settings_insert_own
      ON public.user_record_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- UPDATE policy: allow users to update their own settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_record_settings'
      AND policyname = 'user_record_settings_update_own'
  ) THEN
    CREATE POLICY user_record_settings_update_own
      ON public.user_record_settings
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Service role: allow backend tasks to read settings for archiving
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_record_settings'
      AND policyname = 'user_record_settings_select_service_role'
  ) THEN
    CREATE POLICY user_record_settings_select_service_role
      ON public.user_record_settings
      FOR SELECT
      TO service_role
      USING (true);
  END IF;
END
$$;

-- Create automatic archiving history table to prevent duplicate archiving
CREATE TABLE IF NOT EXISTS public.automatic_archive_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  archive_date DATE NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_record_count INT NOT NULL DEFAULT 0,
  UNIQUE(user_id, archive_date)
);

CREATE INDEX IF NOT EXISTS idx_automatic_archive_log_user_date
  ON public.automatic_archive_log (user_id, archive_date);

ALTER TABLE public.automatic_archive_log ENABLE ROW LEVEL SECURITY;

-- Service role: allow backend tasks to write archive logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'automatic_archive_log'
      AND policyname = 'automatic_archive_log_insert_service_role'
  ) THEN
    CREATE POLICY automatic_archive_log_insert_service_role
      ON public.automatic_archive_log
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'automatic_archive_log'
      AND policyname = 'automatic_archive_log_select_service_role'
  ) THEN
    CREATE POLICY automatic_archive_log_select_service_role
      ON public.automatic_archive_log
      FOR SELECT
      TO service_role
      USING (true);
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
