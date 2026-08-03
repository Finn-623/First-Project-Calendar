-- Multi-device timeline consistency foundation.
-- Full replica identity keeps user/date/parent information in DELETE payloads.
-- The partial unique index prevents concurrent devices from creating duplicate
-- system breakfast/lunch/dinner rows for the same user and recording date.

ALTER TABLE public.timeline_items REPLICA IDENTITY FULL;
ALTER TABLE public.food_entries REPLICA IDENTITY FULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_timeline_items_unique_default_meal
  ON public.timeline_items (user_id, event_date, item_type)
  WHERE item_type IN ('breakfast', 'lunch', 'dinner');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'timeline_items'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.timeline_items;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'food_entries'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.food_entries;
    END IF;
  END IF;
END $$;
