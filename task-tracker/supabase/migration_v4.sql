-- Migration v4: closure_objects table for «Закрытие объектов» module
-- Apply in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.closure_objects (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  omsu            text NOT NULL DEFAULT '',
  object_name     text NOT NULL DEFAULT '',
  contractor      text DEFAULT '',
  payment_status  text NOT NULL DEFAULT 'not_paid'
                  CHECK (payment_status IN ('paid','partial','not_paid','terminated')),
  contract_sum    numeric(15,2) DEFAULT 0,
  paid_sum        numeric(15,2) DEFAULT 0,
  remaining_sum   numeric(15,2) DEFAULT 0,
  mogae_status    text DEFAULT NULL
                  CHECK (mogae_status IS NULL OR mogae_status IN ('Заходили','В МОГЭ','Не заходили ни разу')),
  typical_cause   text DEFAULT NULL,
  typical_block   text DEFAULT NULL,
  comment         text DEFAULT '',
  actions         text DEFAULT '',
  snapshot_date   date NOT NULL DEFAULT CURRENT_DATE,
  created_at      timestamptz DEFAULT now()
);

-- Row-level security
ALTER TABLE public.closure_objects ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "closure_objects_select"
  ON public.closure_objects FOR SELECT
  TO authenticated
  USING (true);

-- Admin and manager can insert / update / delete
CREATE POLICY "closure_objects_write"
  ON public.closure_objects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','manager')
    )
  );
