-- Migration v16b: fix profiles role constraint + enable RLS on NTS tables
-- (Applied separately from v16 to patch items missed in the initial migration)

-- 1. Extend profiles role constraint to include module_responsible
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'analyst', 'guest', 'module_responsible'));

-- 2. Enable RLS on all NTS tables and add authenticated-access policies
ALTER TABLE public.nts_entries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nts_sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nts_doc_rounds          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nts_checklist_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nts_checklist_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nts_entries_all"             ON public.nts_entries;
DROP POLICY IF EXISTS "nts_sessions_all"            ON public.nts_sessions;
DROP POLICY IF EXISTS "nts_doc_rounds_all"          ON public.nts_doc_rounds;
DROP POLICY IF EXISTS "nts_checklist_items_all"     ON public.nts_checklist_items;
DROP POLICY IF EXISTS "nts_checklist_responses_all" ON public.nts_checklist_responses;

-- Open authenticated policy — matches existing app tables (addresses, tasks, etc.)
CREATE POLICY "nts_entries_all"             ON public.nts_entries             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "nts_sessions_all"            ON public.nts_sessions             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "nts_doc_rounds_all"          ON public.nts_doc_rounds           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "nts_checklist_items_all"     ON public.nts_checklist_items      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "nts_checklist_responses_all" ON public.nts_checklist_responses  FOR ALL TO authenticated USING (true) WITH CHECK (true);
