-- Migration v7: add payment_date to closure_objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='closure_objects' AND column_name='payment_date'
  ) THEN
    ALTER TABLE public.closure_objects ADD COLUMN payment_date date DEFAULT NULL;
  END IF;
END $$;
