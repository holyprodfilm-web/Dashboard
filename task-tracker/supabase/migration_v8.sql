-- Migration v8: allow analyst role to insert/update tasks
-- Previously only admin+manager could write tasks; analyst (renamed from contractor) lost access

DO $$
BEGIN
  -- Drop the old restrictive insert policy and replace it
  DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
  
  CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'manager', 'analyst')
      )
    );

  -- Also extend the update policy if it exists
  DROP POLICY IF EXISTS "tasks_update" ON public.tasks;

  CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'manager', 'analyst')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'manager', 'analyst')
      )
    );
END $$;
