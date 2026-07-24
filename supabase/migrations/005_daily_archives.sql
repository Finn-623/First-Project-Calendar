-- Daily archives for durable history snapshots

CREATE TABLE IF NOT EXISTS daily_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  archive_date DATE NOT NULL,
  archive_label TEXT NOT NULL,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, archive_date)
);

ALTER TABLE daily_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily archives"
  ON daily_archives FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily archives"
  ON daily_archives FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily archives"
  ON daily_archives FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily archives"
  ON daily_archives FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_archives_user_date ON daily_archives(user_id, archive_date);

CREATE TRIGGER update_daily_archives_updated_at
BEFORE UPDATE ON daily_archives
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();