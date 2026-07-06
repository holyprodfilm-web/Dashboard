-- Migration v9: add missing checkpoint columns for the 4-step closure pipeline
-- Step 1: Получение положительного заключения МОГЭ  → mogae_approved (already exists)
-- Step 2: Завершение СМР                            → smr_completed (already exists)
-- Step 3: Сдача ИД и КС в УТНКР                   → id_ks_submitted (NEW)
-- Step 4: Оплата                                    → payment_status (already exists)
--
-- Also adding:
--   smr_pct             — строительная готовность (%)
--   typical_cause_smr   — типовая причина для блока 2 (СМР)
--   typical_cause_idks  — типовая причина для блока 3 (ИД/КС)
-- NOTE: typical_cause (existing) acts as block-1 cause (МОГЭ)
--        payment_reason (existing) acts as block-4 cause (Оплата)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='closure_objects' AND column_name='id_ks_submitted'
  ) THEN
    ALTER TABLE public.closure_objects ADD COLUMN id_ks_submitted text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='closure_objects' AND column_name='smr_pct'
  ) THEN
    ALTER TABLE public.closure_objects ADD COLUMN smr_pct text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='closure_objects' AND column_name='typical_cause_smr'
  ) THEN
    ALTER TABLE public.closure_objects ADD COLUMN typical_cause_smr text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='closure_objects' AND column_name='typical_cause_idks'
  ) THEN
    ALTER TABLE public.closure_objects ADD COLUMN typical_cause_idks text DEFAULT NULL;
  END IF;
END $$;
