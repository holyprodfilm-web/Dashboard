-- Migration v6: closure_objects audit trail + analyst write access

-- 1. Audit table for tracking changes to closure_objects
CREATE TABLE IF NOT EXISTS public.closure_changes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  object_id   bigint NOT NULL REFERENCES public.closure_objects(id) ON DELETE CASCADE,
  user_id     uuid   NOT NULL,
  user_name   text   NOT NULL DEFAULT '',
  field_name  text   NOT NULL,
  old_value   text,
  new_value   text,
  changed_at  timestamptz DEFAULT now()
);

ALTER TABLE public.closure_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "closure_changes_select" ON public.closure_changes;
CREATE POLICY "closure_changes_select" ON public.closure_changes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "closure_changes_insert" ON public.closure_changes;
CREATE POLICY "closure_changes_insert" ON public.closure_changes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. Extend closure_objects write access to analyst role
DROP POLICY IF EXISTS "closure_objects_write" ON public.closure_objects;

CREATE POLICY "closure_objects_write" ON public.closure_objects
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager', 'analyst')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager', 'analyst')
  ));
