-- Migration v18: responsible_modules as a designation, not a role

-- 1. Add responsible_modules column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS responsible_modules TEXT[] NOT NULL DEFAULT '{}';

-- 2. Migrate existing module_responsible role users → analyst + all modules
UPDATE public.profiles
  SET role = 'analyst',
      responsible_modules = ARRAY['nts', 'closure', 'dashboard', 'objects']
  WHERE role = 'module_responsible';

-- 3. Update role constraint — remove module_responsible
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'analyst', 'guest'));

-- 4. Remove module_responsible from role_permissions (no longer a role)
DELETE FROM public.role_permissions WHERE role = 'module_responsible';
