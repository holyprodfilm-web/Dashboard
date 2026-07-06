-- Migration v18b: extend self-escalation guard to cover responsible_modules and districts

CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.id = auth.uid() THEN
    -- Block self-change of role
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Недостаточно прав для смены роли';
      END IF;
    END IF;
    -- Block self-change of districts
    IF NEW.districts IS DISTINCT FROM OLD.districts THEN
      IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Недостаточно прав для изменения районов';
      END IF;
    END IF;
    -- Block self-change of responsible_modules
    IF NEW.responsible_modules IS DISTINCT FROM OLD.responsible_modules THEN
      IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Недостаточно прав для изменения назначений по модулям';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Re-create trigger (function replacement is enough, but explicit for clarity)
DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_self_escalation();
