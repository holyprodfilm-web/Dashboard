-- Migration v21: extend meeting_attachments + storage RLS to allow analyst role
-- Previously only admin/manager could insert/delete; analyst has canCreate=true in the UI
-- so they saw the upload button but got RLS violations on insert.

-- Table policies
DROP POLICY IF EXISTS "attachments_insert" ON meeting_attachments;
CREATE POLICY "attachments_insert" ON meeting_attachments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'analyst')
    )
  );

DROP POLICY IF EXISTS "attachments_delete" ON meeting_attachments;
CREATE POLICY "attachments_delete" ON meeting_attachments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'analyst')
    )
  );

-- Storage policies: allow analyst to upload/delete in meeting-files bucket
DROP POLICY IF EXISTS "Admin/manager can upload" ON storage.objects;
DROP POLICY IF EXISTS "Admin/manager/analyst can upload" ON storage.objects;
CREATE POLICY "Admin/manager/analyst can upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'meeting-files'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'analyst')
    )
  );

DROP POLICY IF EXISTS "Admin/manager can delete" ON storage.objects;
DROP POLICY IF EXISTS "Admin/manager/analyst can delete" ON storage.objects;
CREATE POLICY "Admin/manager/analyst can delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'meeting-files'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'analyst')
    )
  );

-- task_links policies: also extend to analyst
DROP POLICY IF EXISTS "task_links_insert" ON task_links;
CREATE POLICY "task_links_insert" ON task_links FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'analyst')
    )
  );

DROP POLICY IF EXISTS "task_links_delete" ON task_links;
CREATE POLICY "task_links_delete" ON task_links FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'analyst')
    )
  );
