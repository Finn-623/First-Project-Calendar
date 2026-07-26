-- Add UPDATE and DELETE permissions for intake plan history

-- UPDATE policy: allow users to edit their own history records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'intake_plan_history'
      AND policyname = 'intake_plan_history_update_own'
  ) THEN
    CREATE POLICY intake_plan_history_update_own
      ON public.intake_plan_history
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- DELETE policy: allow users to delete their own history records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'intake_plan_history'
      AND policyname = 'intake_plan_history_delete_own'
  ) THEN
    CREATE POLICY intake_plan_history_delete_own
      ON public.intake_plan_history
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
