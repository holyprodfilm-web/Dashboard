-- v22: New closure_objects fields + updated_at trigger
ALTER TABLE closure_objects
  ADD COLUMN IF NOT EXISTS contract_link    text,
  ADD COLUMN IF NOT EXISTS contract_number  text,
  ADD COLUMN IF NOT EXISTS pik_contract_link text,
  ADD COLUMN IF NOT EXISTS federal_law      text,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz DEFAULT now();

-- Auto-update updated_at on any row update
CREATE OR REPLACE FUNCTION update_closure_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_closure_updated_at ON closure_objects;
CREATE TRIGGER trg_closure_updated_at
  BEFORE UPDATE ON closure_objects
  FOR EACH ROW EXECUTE FUNCTION update_closure_updated_at();
