ALTER TABLE timeline_items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timeline_items_status_check'
      AND conrelid = 'timeline_items'::regclass
  ) THEN
    ALTER TABLE timeline_items
      ADD CONSTRAINT timeline_items_status_check
      CHECK (status IN ('running', 'completed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_timeline_items_one_running_per_user
  ON timeline_items(user_id)
  WHERE status = 'running';
