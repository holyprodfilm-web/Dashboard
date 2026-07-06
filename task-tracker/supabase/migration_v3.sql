-- Миграция v3: права администратора на управление справочником объектов
-- Выполните этот SQL в SQL Editor вашего проекта Supabase

-- Политики записи для таблицы addresses (только admin)
CREATE POLICY "addresses_insert" ON addresses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "addresses_update" ON addresses FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "addresses_delete" ON addresses FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
