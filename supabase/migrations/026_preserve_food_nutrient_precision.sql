-- v0.2.1 preserve the normalized source precision used by the verified
-- AFCD/USDA import model. Legacy display columns retain their existing scale;
-- canonical per-100g fields store the import model's four decimal places.

ALTER TABLE public.foods
  ALTER COLUMN energy_kcal TYPE NUMERIC(14, 4),
  ALTER COLUMN protein_g TYPE NUMERIC(14, 4),
  ALTER COLUMN carbohydrate_g TYPE NUMERIC(14, 4),
  ALTER COLUMN fat_g TYPE NUMERIC(14, 4),
  ALTER COLUMN fiber_g TYPE NUMERIC(14, 4),
  ALTER COLUMN saturated_fat_g TYPE NUMERIC(14, 4),
  ALTER COLUMN monounsaturated_fat_g TYPE NUMERIC(14, 4),
  ALTER COLUMN polyunsaturated_fat_g TYPE NUMERIC(14, 4),
  ALTER COLUMN trans_fat_g TYPE NUMERIC(14, 4),
  ALTER COLUMN total_sugar_g TYPE NUMERIC(14, 4),
  ALTER COLUMN added_sugar_g TYPE NUMERIC(14, 4),
  ALTER COLUMN sugar_alcohol_g TYPE NUMERIC(14, 4),
  ALTER COLUMN sodium_mg TYPE NUMERIC(14, 4),
  ALTER COLUMN potassium_mg TYPE NUMERIC(14, 4);

NOTIFY pgrst, 'reload schema';
