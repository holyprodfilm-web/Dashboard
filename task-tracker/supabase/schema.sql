-- Профили пользователей (связаны с auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('admin', 'manager', 'contractor', 'guest')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Справочник объектов
CREATE TABLE IF NOT EXISTS addresses (
  "Код УИН" TEXT PRIMARY KEY,
  "Наименование объекта" TEXT NOT NULL,
  "Городской округ" TEXT NOT NULL,
  "Руководитель проекта" TEXT,
  "Тип объекта" TEXT,
  "Год реализации" TEXT
);

-- Совещания / протоколы
CREATE TABLE IF NOT EXISTS meetings (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  protocol_number TEXT,
  meeting_date DATE NOT NULL,
  manager TEXT NOT NULL,
  selected_objects TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Поручения
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  meeting_id BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  object_uin TEXT NOT NULL,
  description TEXT NOT NULL,
  responsible TEXT,
  responsible_org TEXT,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Автоматическое создание профиля при регистрации
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'guest')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Профили: все авторизованные могут читать, только admin может менять роли
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Справочник объектов: чтение для всех авторизованных
CREATE POLICY "addresses_select" ON addresses FOR SELECT TO authenticated USING (true);

-- Совещания: чтение для всех, создание/редактирование для admin и manager
CREATE POLICY "meetings_select" ON meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "meetings_insert" ON meetings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "meetings_update" ON meetings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "meetings_delete" ON meetings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Поручения: чтение для всех, создание для admin/manager, редактирование для admin/manager/contractor
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'contractor')));
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
