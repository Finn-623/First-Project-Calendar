-- Initial Supabase Schema for Diet & Schedule Tracker
-- Created: 2026-07-22

-- ============================================================================
-- 1. PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profile RLS Policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ============================================================================
-- 2. DAILY_TARGETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  calories_target NUMERIC(10, 2) NOT NULL DEFAULT 2100,
  protein_target NUMERIC(10, 2) NOT NULL DEFAULT 140,
  fat_target NUMERIC(10, 2) NOT NULL DEFAULT 65,
  carbs_target NUMERIC(10, 2) NOT NULL DEFAULT 240,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, target_date)
);

-- Enable RLS on daily_targets
ALTER TABLE daily_targets ENABLE ROW LEVEL SECURITY;

-- Daily Targets RLS Policies
CREATE POLICY "Users can view their own daily targets"
  ON daily_targets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily targets"
  ON daily_targets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily targets"
  ON daily_targets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily targets"
  ON daily_targets FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. TIMELINE_ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS timeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN (
    'breakfast',
    'lunch',
    'dinner',
    'snack',
    'anaerobic_training',
    'aerobic_training',
    'other'
  )),
  title TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on timeline_items
ALTER TABLE timeline_items ENABLE ROW LEVEL SECURITY;

-- Timeline Items RLS Policies
CREATE POLICY "Users can view their own timeline items"
  ON timeline_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own timeline items"
  ON timeline_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own timeline items"
  ON timeline_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own timeline items"
  ON timeline_items FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. FOODS TABLE (User's personal food library)
-- ============================================================================
CREATE TABLE IF NOT EXISTS foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_quantity NUMERIC(10, 2) NOT NULL DEFAULT 100,
  unit TEXT NOT NULL DEFAULT 'g',
  calories NUMERIC(10, 2) NOT NULL,
  protein NUMERIC(10, 2) NOT NULL DEFAULT 0,
  fat NUMERIC(10, 2) NOT NULL DEFAULT 0,
  carbs NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on foods
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

-- Foods RLS Policies
CREATE POLICY "Users can view their own foods"
  ON foods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own foods"
  ON foods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own foods"
  ON foods FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own foods"
  ON foods FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. FOOD_ENTRIES TABLE (Historical food consumption with snapshots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS food_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timeline_item_id UUID NOT NULL REFERENCES timeline_items(id) ON DELETE CASCADE,
  source_food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
  food_name_snapshot TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  unit_snapshot TEXT NOT NULL DEFAULT 'g',
  calories_snapshot NUMERIC(10, 2) NOT NULL,
  protein_snapshot NUMERIC(10, 2) NOT NULL DEFAULT 0,
  fat_snapshot NUMERIC(10, 2) NOT NULL DEFAULT 0,
  carbs_snapshot NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on food_entries
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;

-- Food Entries RLS Policies
CREATE POLICY "Users can view their own food entries"
  ON food_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own food entries"
  ON food_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own food entries"
  ON food_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own food entries"
  ON food_entries FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 6. FAVORITE_FOODS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS favorite_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, food_id)
);

-- Enable RLS on favorite_foods
ALTER TABLE favorite_foods ENABLE ROW LEVEL SECURITY;

-- Favorite Foods RLS Policies
CREATE POLICY "Users can view their own favorite foods"
  ON favorite_foods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorite foods"
  ON favorite_foods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorite foods"
  ON favorite_foods FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 7. INDEXES for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_daily_targets_user_date ON daily_targets(user_id, target_date);
CREATE INDEX IF NOT EXISTS idx_timeline_items_user_date ON timeline_items(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_foods_user_name ON foods(user_id, name);
CREATE INDEX IF NOT EXISTS idx_food_entries_user_timeline ON food_entries(user_id, timeline_item_id);
CREATE INDEX IF NOT EXISTS idx_food_entries_timeline ON food_entries(timeline_item_id);
CREATE INDEX IF NOT EXISTS idx_favorite_foods_user ON favorite_foods(user_id);

-- ============================================================================
-- 8. TRIGGER to update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_targets_updated_at BEFORE UPDATE ON daily_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timeline_items_updated_at BEFORE UPDATE ON timeline_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_foods_updated_at BEFORE UPDATE ON foods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_food_entries_updated_at BEFORE UPDATE ON food_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
