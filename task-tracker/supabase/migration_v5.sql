-- Migration v5: analyst role + module permissions + districts (v3) applied together

-- 1. Districts column (safe if already exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS districts TEXT[] NOT NULL DEFAULT '{}';

-- 2. Self-update policy for profile (from v3)
DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3. Role self-escalation guard (from v3)
CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.id = auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Недостаточно прав для смены роли';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_self_escalation();

-- 4. Add analyst role: drop the old CHECK, rename contractor → analyst, add new CHECK
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE profiles SET role = 'analyst' WHERE role = 'contractor';
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'analyst', 'guest'));

-- 5. Module permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  role    TEXT    NOT NULL,
  module  TEXT    NOT NULL,
  can_access BOOLEAN NOT NULL DEFAULT true,
  features   JSONB   NOT NULL DEFAULT '{}',
  PRIMARY KEY (role, module)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_read"  ON role_permissions;
CREATE POLICY "role_permissions_read" ON role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_permissions_write" ON role_permissions;
CREATE POLICY "role_permissions_write" ON role_permissions
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK(EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 6. Default permissions
INSERT INTO role_permissions (role, module, can_access, features) VALUES
  ('admin',   'dashboard', true,  '{"create_meeting":true,  "delete_meeting":true}'),
  ('admin',   'objects',   true,  '{"delete_objects":true}'),
  ('admin',   'closure',   true,  '{}'),
  ('manager', 'dashboard', true,  '{"create_meeting":true,  "delete_meeting":false}'),
  ('manager', 'objects',   true,  '{"delete_objects":false}'),
  ('manager', 'closure',   true,  '{}'),
  ('analyst', 'dashboard', true,  '{"create_meeting":false, "delete_meeting":false}'),
  ('analyst', 'objects',   true,  '{"delete_objects":false}'),
  ('analyst', 'closure',   true,  '{}'),
  ('guest',   'dashboard', false, '{"create_meeting":false, "delete_meeting":false}'),
  ('guest',   'objects',   false, '{"delete_objects":false}'),
  ('guest',   'closure',   true,  '{}')
ON CONFLICT (role, module) DO NOTHING;
