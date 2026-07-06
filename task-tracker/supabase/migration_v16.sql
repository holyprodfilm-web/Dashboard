-- Migration v16: НТС module — tables, role, permissions, checklist seed

-- ── 1. Main NTS entries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nts_entries (
  id               BIGSERIAL PRIMARY KEY,
  object_uin       TEXT NOT NULL,
  object_name      TEXT NOT NULL,
  contractor       TEXT NOT NULL,
  contract_cost    NUMERIC(15,2) NOT NULL,
  pre_nts_cost     NUMERIC(15,2) NOT NULL,
  post_nts_cost    NUMERIC(15,2),
  mogae_cost       NUMERIC(15,2),
  rp_main_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rp2_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'rp_review'
                   CHECK (status IN ('rp_review','vks_scheduled','remarks_fix','positive_mogae','below_30')),
  protocol_number  TEXT,
  protocol_date    DATE,
  protocol_status  TEXT CHECK (protocol_status IN ('preparing','msed','sent_omsu')),
  protocol_file_path TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.nts_entries ENABLE ROW LEVEL SECURITY;

-- ── 2. Presentation and VKS dates (stored as jsonb arrays in the entry) ──────
-- presentation_dates and vks_dates are jsonb[] columns, added here:
ALTER TABLE public.nts_entries
  ADD COLUMN IF NOT EXISTS presentation_dates JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS vks_dates JSONB NOT NULL DEFAULT '[]';

-- ── 3. Sessions (ВКС / заседания) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nts_sessions (
  id             BIGSERIAL PRIMARY KEY,
  nts_entry_id   BIGINT NOT NULL REFERENCES public.nts_entries(id) ON DELETE CASCADE,
  session_date   DATE NOT NULL,
  remarks        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.nts_sessions ENABLE ROW LEVEL SECURITY;

-- ── 4. Document receipt rounds ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nts_doc_rounds (
  id             BIGSERIAL PRIMARY KEY,
  nts_entry_id   BIGINT NOT NULL REFERENCES public.nts_entries(id) ON DELETE CASCADE,
  received_date  DATE NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.nts_doc_rounds ENABLE ROW LEVEL SECURITY;

-- ── 5. Static checklist items (seeded from Excel НТС template) ───────────────
CREATE TABLE IF NOT EXISTS public.nts_checklist_items (
  id           BIGSERIAL PRIMARY KEY,
  item_num     INTEGER NOT NULL,
  section_title TEXT,
  description  TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.nts_checklist_items ENABLE ROW LEVEL SECURITY;

-- Seed only if empty
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.nts_checklist_items) = 0 THEN
    INSERT INTO public.nts_checklist_items (item_num, section_title, description, sort_order) VALUES
(1, 'Решение Штаба', 'Штабное решение и приложения к штабному решению (+ все изменения к штабному решению при их наличии).', 1),
(2, 'Решение Штаба', 'Указать текстом и приложить скан решения штаба, где указаны мероприятия', 2),
(3, 'Техническое задание (ТЗ)', 'ТЗ', 3),
(4, 'Техническое задание (ТЗ)', 'Сравнительный анализ между штабным решением и ТЗ.', 4),
(5, 'Техническое задание (ТЗ)', 'Сравнительный анализ между проектным решением и ТЗ.', 5),
(6, 'Техническое задание (ТЗ)', 'Показать увеличение/снижение объёмов работ относительно ТЗ.', 6),
(7, 'Описание мероприятия, объекта, состава работ, схемных и технических решений', 'Описание мероприятия, объекта и состава работ.', 7),
(8, 'Описание мероприятия, объекта, состава работ, схемных и технических решений', 'Описание схемных и технических решений. Было – Планируется.', 8),
(9, 'Описание мероприятия, объекта, состава работ, схемных и технических решений', 'Описание выполненных схемных решений.', 9),
(10, 'Описание мероприятия, объекта, состава работ, схемных и технических решений', 'Схема объекта до реконструкции и после реконструкции.', 10),
(11, 'Описание мероприятия, объекта, состава работ, схемных и технических решений', 'По объектам котельных, БМК и ЦТП: Нагрузка (МВт) согласно утвержденной схеме теплоснабжения; договорная нагрузка на каждого потребителя; установленная мощность.', 11),
(12, 'Обоснованность внесения изменений в ТЗ', 'Обоснование внесения изменений в ТЗ. При необходимости указать некорректные данные в ТЗ (если такое выявлено).', 12),
(13, 'Обоснованность принятых технических решений', 'Обоснование принятых технических решений. Обязательно со ссылками на нормативную техническую документацию (Своды, правила и т.д.)', 13),
(14, 'Обоснованность принятых технических решений', 'Обоснование причины изменений, отклонений. При необходимости приложить расчеты (гидравлический и т.п.), обосновать необходимость прокладки байпаса.', 14),
(15, 'Обоснованность принятых технических решений', 'Теплосеть. Указать тип используемого трубопровода для тепловых сетей и ГВС.', 15),
(16, 'Обоснованность принятых технических решений', 'Обоснование выбора материала трубопровода.', 16),
(17, 'Обоснованность принятых технических решений', 'Обоснование необходимости байпаса (при его наличии) с учетом закольцовок.', 17),
(18, 'Обоснованность принятых технических решений', 'Обоснование необходимости демонтажа старой теплотрассы при прокладке новой теплосети параллельным способом.', 18),
(19, 'Обоснованность принятых технических решений', 'Обоснование усложнения при проведении работ (прохождение дорог, ГНБ, создание плана дорожного движения, глубокая прокладка тепловых сетей).', 19),
(20, 'Обоснованность принятых технических решений', 'Обоснование необходимости применения канальной прокладки.', 20),
(21, 'Обоснованность принятых технических решений', 'Приоритетный способ прокладки трубопроводов ПЭ оболочке — бесканальный. В случае проектирования в канале, футляре — необходимо ТЭО.', 21),
(22, 'Обоснованность принятых технических решений', 'Приоритетный способ узлов врезки ПЭ — бескамерный. В случае проектирования тепловых камер — необходимо ТЭО.', 22),
(23, 'Обоснованность принятых технических решений', 'При необходимости обосновать увеличение диаметра тепловой сети с учетом действующих нагрузок.', 23),
(24, 'Обоснованность принятых технических решений', 'Показать технические решения о необходимости устройства/капитального ремонта камер (дефектные ведомости, заключения спец. организаций).', 24),
(25, 'Обоснованность принятых технических решений', 'Обоснование конъюнктурного выбора оборудования. Приложить ценовые предложения заводов-изготовителей.', 25),
(26, 'Обоснованность принятых технических решений', 'При реконструкции тепловых камер — приложить отчет обследования, подтверждающий аварийное состояние.', 26),
(27, 'Обоснованность принятых технических решений', 'Подтверждение категории каждой дороги с документами — при канальной прокладке под дорогами.', 27),
(28, 'Обоснованность принятых технических решений', 'При 4-х трубной системе — заключение специализированной организации о невозможности выполнения работ без затрагивания существующих коммуникаций.', 28),
(29, 'Котельные', 'Заключения пром. безопасности, результаты обследования, подтверждающие аварийное состояние заменяемого основного оборудования (котлы, дым. трубы, деаэраторы, ХВП и т.д.)', 29),
(30, 'Котельные', 'При строительстве БМК — обоснование необходимости демонтажа старого здания котельной и других технологических зданий.', 30),
(31, 'Котельные', 'Технико-экономическое обоснование использования РТХ, аккумуляторных баков запаса воды.', 31),
(32, 'Котельные', 'Обоснование по необходимости замены ВРУ.', 32),
(33, 'Котельные', 'Раскрыть информацию по техническим решениям разделов ОВ, АТМ, АГСВ.', 33),
(34, 'Котельные', 'Обоснование (дефектные ведомости) по вспомогательному оборудованию и вспомогательным системам котельной, подлежащих ремонту.', 34),
(35, 'Котельные', 'Обоснование конъюнктурного выбора оборудования. Приложить ценовые предложения заводов-изготовителей.', 35),
(36, 'ЦТП', 'Указать полный состав оборудования, включенный в данный модуль.', 36),
(37, 'ЦТП', 'Принципиальная схема ЦТП', 37),
(38, 'ЦТП', 'Обоснование необходимости установки ЧРП, при его наличии. Расчет экономической составляющей по установке ЧРП.', 38),
(39, 'ЦТП', 'Расписывать весь объем необходимых работ (электромонтажные работы, установка автоматики насосов, пуско-наладочные работы и т.д.)', 39),
(40, 'ЦТП', 'Обоснование конъюнктурного выбора оборудования. Приложить ценовые предложения заводов-изготовителей.', 40),
(41, 'Благоустройство', 'Обоснование необходимости создания разворотных площадок, газонов, посадки насаждений, выбор полигона для вывоза грунта.', 41),
(42, 'Благоустройство', 'Подтверждение объемов благоустройства приложенным фотоотчетом и нанесением зон прохождения тепловой сети.', 42),
(43, 'Соответствие Технической политике МО', 'Ведомость основного оборудования, материалов со ссылкой на соответствие раздела Технической политики.', 43),
(44, 'Национальный режим ФЗ 44, ФЗ 223', 'Ведомость основного оборудования, материалов со ссылкой на производителя, с указанием города и страны производителя.', 44),
(45, 'Справочники ФГИС ЦС и КТЦ МО', 'Ведомость основного оборудования, материалов со ссылкой на соответствие справочникам ФГИС ЦС и ЦТЦ МО.', 45),
(46, 'Справочники ФГИС ЦС и КТЦ МО', 'Указать общую стоимость оборудования, материалов в составе всей суммы по проекту, процентное соотношение.', 46),
(47, 'Конъюнктурный анализ', 'Ведомость основного оборудования и материалов, прошедших через конъюнктуру с указанием причин применения данных материалов.', 47),
(48, 'Конъюнктурный анализ', 'Указать общую стоимость оборудования, материалов в составе всей суммы по проекту, процентное соотношение.', 48),
(49, 'Использование аванса', 'Указать дату, сумму получения аванса, дату заказа, закупки оборудования с учетом величины аванса.', 49),
(50, 'Использование аванса', 'Ведомость оборудования, закупленного под аванс', 50),
(51, 'Использование аванса', 'Платежные документы.', 51),
(52, 'Схема теплоснабжения', 'Скан схемы теплоснабжения, где указано мероприятие', 52),
(53, 'Стоимость проекта по разделам', 'Расписать укрупненно стоимость проекта.', 53),
(54, 'Стоимость проекта по разделам', 'Показать позиции, за счет которых образована разница между ценой контракта и НТС.', 54),
(55, 'Стоимость проекта по разделам', 'Выкопировка из договора (если в расчете включены затраты на банковскую гарантию).', 55),
(56, 'Гидравлические расчёты', 'Гидравлические расчеты по тепловой сети.', 56),
(57, 'Гидравлические расчёты', 'Гидравлический расчет на байпас (при наличии)', 57),
(58, 'Предельные значения стоимости', 'Расчет стоимости по Предельным значениям.', 58),
(59, 'Предельные значения стоимости', 'Соблюдение корректности расчёта стоимости мероприятия по Предельным значениям стоимостных показателей.', 59),
(60, 'Предельные значения стоимости', 'Расчет мероприятий по предельным значениям стоимостных показателей в соответствии с методикой постановления правительства.', 60),
(61, 'НМЦК', 'Расчёт начальной максимальной цены контракта. Если применяется снижающий коэффициент — обосновать причину.', 61);
  END IF;
END $$;

-- ── 6. Checklist responses (per round, per item, per respondent role) ─────────
CREATE TABLE IF NOT EXISTS public.nts_checklist_responses (
  id               BIGSERIAL PRIMARY KEY,
  round_id         BIGINT NOT NULL REFERENCES public.nts_doc_rounds(id) ON DELETE CASCADE,
  item_id          BIGINT NOT NULL REFERENCES public.nts_checklist_items(id) ON DELETE CASCADE,
  respondent_role  TEXT NOT NULL CHECK (respondent_role IN ('rp','rp2','responsible')),
  status           TEXT CHECK (status IN ('ok','fail','clarify','na')),
  comment          TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (round_id, item_id, respondent_role)
);
ALTER TABLE public.nts_checklist_responses ENABLE ROW LEVEL SECURITY;

-- ── 7. RLS policies — open authenticated access (matches existing app tables) ─
CREATE POLICY IF NOT EXISTS "nts_entries_all"             ON public.nts_entries             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "nts_sessions_all"            ON public.nts_sessions             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "nts_doc_rounds_all"          ON public.nts_doc_rounds           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "nts_checklist_items_all"     ON public.nts_checklist_items      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "nts_checklist_responses_all" ON public.nts_checklist_responses  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 8. Extend profiles role constraint to include module_responsible ──────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'analyst', 'guest', 'module_responsible'));

-- ── 9. Role permissions for НТС module ───────────────────────────────────────
INSERT INTO public.role_permissions (role, module, can_access, features)
VALUES
  ('manager',  'nts', true,  '{}'),
  ('analyst',  'nts', false, '{}'),
  ('guest',    'nts', false, '{}')
ON CONFLICT (role, module) DO NOTHING;

-- module_responsible role — same permissions as manager + nts access
INSERT INTO public.role_permissions (role, module, can_access, features)
VALUES
  ('module_responsible', 'dashboard', true,  '{}'),
  ('module_responsible', 'objects',   true,  '{}'),
  ('module_responsible', 'closure',   false, '{}'),
  ('module_responsible', 'nts',       true,  '{}')
ON CONFLICT (role, module) DO NOTHING;
