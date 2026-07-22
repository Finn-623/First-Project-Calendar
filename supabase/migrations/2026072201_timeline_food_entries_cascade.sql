-- Ensure food_entries are removed automatically when timeline_items are deleted.
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'food_entries'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'timeline_item_id'
    AND ccu.table_name = 'timeline_items'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.food_entries DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE public.food_entries
    ADD CONSTRAINT food_entries_timeline_item_id_fkey
    FOREIGN KEY (timeline_item_id)
    REFERENCES public.timeline_items(id)
    ON DELETE CASCADE;
END $$;

-- Keep one daily target per user per day.
CREATE UNIQUE INDEX IF NOT EXISTS daily_targets_user_id_target_date_key
  ON public.daily_targets(user_id, target_date);
