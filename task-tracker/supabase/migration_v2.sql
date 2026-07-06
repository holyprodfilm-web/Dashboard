-- Миграция v2: вложения к протоколам и связи между поручениями
-- Выполните этот SQL в SQL Editor вашего проекта Supabase

-- 1. Вложения к протоколам (PDF, Word)
CREATE TABLE IF NOT EXISTS meeting_attachments (
  id BIGSERIAL PRIMARY KEY,
  meeting_id BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Связи между поручениями одного объекта
CREATE TABLE IF NOT EXISTS task_links (
  id BIGSERIAL PRIMARY KEY,
  from_task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  to_task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  object_uin TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_task_id, to_task_id)
);

-- RLS
ALTER TABLE meeting_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;

-- Вложения: чтение для всех авторизованных, загрузка для admin/manager, удаление для admin/manager
CREATE POLICY "attachments_select" ON meeting_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "attachments_insert" ON meeting_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "attachments_delete" ON meeting_attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- Связи: чтение для всех, создание для admin/manager, удаление для admin/manager
CREATE POLICY "task_links_select" ON task_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_links_insert" ON task_links FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "task_links_delete" ON task_links FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- 3. Настройка Supabase Storage (выполните через Dashboard → Storage):
--    а) Создайте bucket с именем "meeting-files" (Private)
--    б) Создайте политики для bucket в Storage → Policies:
--
--    Policy: "Authenticated users can upload"
--    Operation: INSERT
--    Target roles: authenticated
--    Policy: (auth.role() = 'authenticated')
--
--    Policy: "Authenticated users can read"
--    Operation: SELECT
--    Target roles: authenticated
--    Policy: (auth.role() = 'authenticated')
--
--    Policy: "Admin/manager can delete"
--    Operation: DELETE
--    Target roles: authenticated
--    Policy: (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')))
