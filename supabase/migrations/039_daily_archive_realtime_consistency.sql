-- Daily archives are part of the canonical daily-record stream. Publish their
-- changes so Home, History and HistoryDetail invalidate the same business date.

ALTER TABLE public.daily_archives REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'daily_archives'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_archives;
  END IF;
END;
$$;
