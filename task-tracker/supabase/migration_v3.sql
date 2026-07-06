-- Migration v3: Add districts array to profiles for manager role

-- 1. Add districts column (list of assigned city districts), not nullable
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS districts TEXT[] NOT NULL DEFAULT '{}';

-- 2. Allow users to update their own profile (full_name, districts only).
--    A trigger below prevents self-escalation of the role column.
DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3. Trigger: block non-admins from changing their own role via self-update.
--    Admins still change roles through the existing profiles_update_admin policy.
CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only intercept when a user is updating their own row
  IF NEW.id = auth.uid() THEN
    -- If role is being changed...
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      -- ...and the actor is not an admin, block it
      IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
      ) THEN
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
