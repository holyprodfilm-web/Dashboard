-- Migration v4b: add missing columns to closure_objects
-- Run this ONLY if you already applied migration_v4.sql and the table exists.
-- Safe to run multiple times (uses IF NOT EXISTS pattern via DO block).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='closure_objects' AND column_name='uin') THEN
    ALTER TABLE public.closure_objects ADD COLUMN uin text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='closure_objects' AND column_name='object_type') THEN
    ALTER TABLE public.closure_objects ADD COLUMN object_type text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='closure_objects' AND column_name='mogae_approved') THEN
    ALTER TABLE public.closure_objects ADD COLUMN mogae_approved text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='closure_objects' AND column_name='smr_completed') THEN
    ALTER TABLE public.closure_objects ADD COLUMN smr_completed text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='closure_objects' AND column_name='payment_reason') THEN
    ALTER TABLE public.closure_objects ADD COLUMN payment_reason text DEFAULT NULL;
  END IF;
END $$;
