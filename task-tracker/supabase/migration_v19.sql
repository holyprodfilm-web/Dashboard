-- Migration v19: Add updated_by to nts_entries for realtime change attribution

ALTER TABLE public.nts_entries
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
