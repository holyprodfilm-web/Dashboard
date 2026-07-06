-- Migration v17: NTS doc rounds — tracking fields + checklist approval flag

ALTER TABLE public.nts_doc_rounds
  ADD COLUMN IF NOT EXISTS presentation_date        DATE,
  ADD COLUMN IF NOT EXISTS remarks_issued_at        DATE,
  ADD COLUMN IF NOT EXISTS remarks_resolved_contractor_at DATE,
  ADD COLUMN IF NOT EXISTS remarks_resolved_district_at   DATE,
  ADD COLUMN IF NOT EXISTS checklist_approved       BOOLEAN NOT NULL DEFAULT FALSE;
