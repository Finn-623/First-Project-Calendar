-- Explicit completion status for daily archives

ALTER TABLE daily_archives
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE daily_archives
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE daily_archives
SET
  is_completed = TRUE,
  completed_at = COALESCE(completed_at, created_at, NOW())
WHERE is_completed = FALSE;

CREATE INDEX IF NOT EXISTS idx_daily_archives_user_completed
  ON daily_archives(user_id, archive_date, is_completed);