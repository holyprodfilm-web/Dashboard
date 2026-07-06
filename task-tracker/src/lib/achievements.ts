import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AchievementModule = 'nts' | 'tasks' | 'closure';
export type AchievementKind = 'positive' | 'negative';

export interface Achievement {
  id: string;           // e.g. 'nts_views_1'
  module: AchievementModule;
  category: string;     // human-readable category name
  tier: number;         // 1..4
  name: string;         // funny name
  description: string;  // what you did / what it means
  icon: string;         // emoji
  kind: AchievementKind;
  /** For negative achievements: the maximum count at which this tier is active (inclusive) */
  maxCount?: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  notified: boolean;
}

// ── Achievement catalogue ──────────────────────────────────────────────────────

export const ACHIEVEMENTS: Achievement[] = [
  // ─── НТС: просмотрено НТС ───────────────────────────────────────────────────
  {
    id: 'nts_views_1',
    module: 'nts',
    category: 'Просмотрено НТС',
    tier: 1,
    name: '🐣 Яйцо НТС',
    description: 'Ты открыл первую НТС и не убежал. Это уже достижение.',
    icon: '🐣',
    kind: 'positive',
  },
  {
    id: 'nts_views_2',
    module: 'nts',
    category: 'Просмотрено НТС',
    tier: 2,
    name: '📋 Листатель документов',
    description: 'Пять НТС — и ты начинаешь узнавать аббревиатуры.',
    icon: '📋',
    kind: 'positive',
  },
  {
    id: 'nts_views_3',
    module: 'nts',
    category: 'Просмотрено НТС',
    tier: 3,
    name: '🧙 Гуру НТС',
    description: 'Пятнадцать НТС. Коллеги смотрят на тебя с уважением и страхом.',
    icon: '🧙',
    kind: 'positive',
  },
  {
    id: 'nts_views_4',
    module: 'nts',
    category: 'Просмотрено НТС',
    tier: 4,
    name: '🏛️ Академик системы',
    description: 'Тридцать НТС. В другой жизни ты был бы библиотекарем Хогвартса.',
    icon: '🏛️',
    kind: 'positive',
  },

  // ─── НТС: чистые раунды ─────────────────────────────────────────────────────
  {
    id: 'nts_clean_1',
    module: 'nts',
    category: 'Чистые раунды',
    tier: 1,
    name: '✨ Без сучка',
    description: 'Первый раунд без единого замечания. Случайность? Едва ли.',
    icon: '✨',
    kind: 'positive',
  },
  {
    id: 'nts_clean_2',
    module: 'nts',
    category: 'Чистые раунды',
    tier: 2,
    name: '🎯 Снайпер чек-листа',
    description: 'Пять чистых раундов. Ты читаешь ТЗ — это редкий талант.',
    icon: '🎯',
    kind: 'positive',
  },
  {
    id: 'nts_clean_3',
    module: 'nts',
    category: 'Чистые раунды',
    tier: 3,
    name: '🏆 Непогрешимый',
    description: 'Десять раундов — ноль замечаний. Легенда.',
    icon: '🏆',
    kind: 'positive',
  },
  {
    id: 'nts_clean_4',
    module: 'nts',
    category: 'Чистые раунды',
    tier: 4,
    name: '💎 Алмаз чек-листа',
    description: 'Двадцать чистых раундов. Замечания просто стесняются тебя беспокоить.',
    icon: '💎',
    kind: 'positive',
  },

  // ─── НТС: просрочки (negative, dynamic — only highest active tier is shown) ──
  {
    id: 'nts_overdue_1',
    module: 'nts',
    category: 'Просрочки НТС',
    tier: 1,
    name: '😅 Немного завис',
    description: 'Всё нормально, ты просто думаешь над ответом. Долго.',
    icon: '😅',
    kind: 'negative',
    maxCount: 2,
  },
  {
    id: 'nts_overdue_2',
    module: 'nts',
    category: 'Просрочки НТС',
    tier: 2,
    name: '😬 Мастер завтра',
    description: '«Сделаю завтра» — говорит человек с тремя просрочками.',
    icon: '😬',
    kind: 'negative',
    maxCount: 5,
  },
  {
    id: 'nts_overdue_3',
    module: 'nts',
    category: 'Просрочки НТС',
    tier: 3,
    name: '💀 Чёрная дыра НТС',
    description: 'Документы входят, но не выходят. Исправь это, пожалуйста.',
    icon: '💀',
    kind: 'negative',
  },

  // ─── Поручения: выполнено поручений ─────────────────────────────────────────
  {
    id: 'tasks_done_1',
    module: 'tasks',
    category: 'Выполнено поручений',
    tier: 1,
    name: '🐾 Дитя дисциплины',
    description: 'Пять поручений выполнено. Галочки — лучшее изобретение человечества.',
    icon: '🐾',
    kind: 'positive',
  },
  {
    id: 'tasks_done_2',
    module: 'tasks',
    category: 'Выполнено поручений',
    tier: 2,
    name: '⚙️ Рабочая лошадка',
    description: 'Двадцать закрытых задач. Ты движешь проект вперёд, это правда.',
    icon: '⚙️',
    kind: 'positive',
  },
  {
    id: 'tasks_done_3',
    module: 'tasks',
    category: 'Выполнено поручений',
    tier: 3,
    name: '🚂 Паровоз',
    description: 'Пятьдесят поручений. На тебя можно положиться как на расписание поезда.',
    icon: '🚂',
    kind: 'positive',
  },
  {
    id: 'tasks_done_4',
    module: 'tasks',
    category: 'Выполнено поручений',
    tier: 4,
    name: '🌌 Машина поручений',
    description: 'Сто задач. Ты не человек — ты процесс.',
    icon: '🌌',
    kind: 'positive',
  },

  // ─── Поручения: выполнено с дедлайном ───────────────────────────────────────
  {
    id: 'tasks_ontime_1',
    module: 'tasks',
    category: 'Поручения с дедлайном',
    tier: 1,
    name: '⏱️ Пунктуальный человек',
    description: 'Пять поручений с дедлайном выполнено. Ты знаешь, что такое сроки.',
    icon: '⏱️',
    kind: 'positive',
  },
  {
    id: 'tasks_ontime_2',
    module: 'tasks',
    category: 'Поручения с дедлайном',
    tier: 2,
    name: '🕰️ Швейцарские часы',
    description: 'Двадцать выполненных поручений с дедлайном. Ты позоришь всех остальных (это комплимент).',
    icon: '🕰️',
    kind: 'positive',
  },
  {
    id: 'tasks_ontime_3',
    module: 'tasks',
    category: 'Поручения с дедлайном',
    tier: 3,
    name: '🏅 Легенда дедлайна',
    description: 'Пятьдесят выполненных поручений с дедлайном. Хронос кивает с уважением.',
    icon: '🏅',
    kind: 'positive',
  },

  // ─── Поручения: просрочки (negative) ────────────────────────────────────────
  {
    id: 'tasks_overdue_1',
    module: 'tasks',
    category: 'Просрочки поручений',
    tier: 1,
    name: '🐌 Чуть тормозит',
    description: 'Пара просрочек — ещё не катастрофа, но уже заметно.',
    icon: '🐌',
    kind: 'negative',
    maxCount: 2,
  },
  {
    id: 'tasks_overdue_2',
    module: 'tasks',
    category: 'Просрочки поручений',
    tier: 2,
    name: '🌧️ Хронический должник',
    description: 'Каждое совещание — напоминание о твоих поручениях.',
    icon: '🌧️',
    kind: 'negative',
    maxCount: 5,
  },
  {
    id: 'tasks_overdue_3',
    module: 'tasks',
    category: 'Просрочки поручений',
    tier: 3,
    name: '🌊 Тонет в поручениях',
    description: 'Поручения объявили тебя своей территорией.',
    icon: '🌊',
    kind: 'negative',
    maxCount: 9,
  },
  {
    id: 'tasks_overdue_4',
    module: 'tasks',
    category: 'Просрочки поручений',
    tier: 4,
    name: '☄️ Апокалипсис дедлайнов',
    description: 'Руководство плачет. Система плачет. Плачь и ты — это катарсис.',
    icon: '☄️',
    kind: 'negative',
  },

  // ─── Закрытие: закрыто объектов ─────────────────────────────────────────────
  {
    id: 'closure_closed_1',
    module: 'closure',
    category: 'Закрыто объектов',
    tier: 1,
    name: '🔒 Первый засов',
    description: 'Ты закрыл первый объект. Где-то зазвонил колокол.',
    icon: '🔒',
    kind: 'positive',
  },
  {
    id: 'closure_closed_2',
    module: 'closure',
    category: 'Закрыто объектов',
    tier: 2,
    name: '🗝️ Связка ключей',
    description: 'Пять закрытых объектов. Носишь их с гордостью.',
    icon: '🗝️',
    kind: 'positive',
  },
  {
    id: 'closure_closed_3',
    module: 'closure',
    category: 'Закрыто объектов',
    tier: 3,
    name: '🏗️ Укротитель объектов',
    description: 'Пятнадцать объектов. Ты знаешь акт сдачи-приёмки наизусть.',
    icon: '🏗️',
    kind: 'positive',
  },
  {
    id: 'closure_closed_4',
    module: 'closure',
    category: 'Закрыто объектов',
    tier: 4,
    name: '🌆 Строитель города',
    description: 'Тридцать объектов. Твои проекты видны с карты.',
    icon: '🌆',
    kind: 'positive',
  },

  // ─── Закрытие: скорость закрытия ────────────────────────────────────────────
  {
    id: 'closure_speed_1',
    module: 'closure',
    category: 'Скорость закрытия',
    tier: 1,
    name: '⚡ Быстрый старт',
    description: 'Три объекта закрыто почти вовремя. Почти — это всё равно хорошо.',
    icon: '⚡',
    kind: 'positive',
  },
  {
    id: 'closure_speed_2',
    module: 'closure',
    category: 'Скорость закрытия',
    tier: 2,
    name: '🚀 Ракета закрытий',
    description: 'Десять быстрых закрытий. Ты делаешь это как будто без усилий.',
    icon: '🚀',
    kind: 'positive',
  },
];

// ── Threshold map for positive achievements ───────────────────────────────────

const POSITIVE_THRESHOLDS: Record<string, number> = {
  nts_views_1: 1,
  nts_views_2: 5,
  nts_views_3: 15,
  nts_views_4: 30,
  nts_clean_1: 1,
  nts_clean_2: 5,
  nts_clean_3: 10,
  nts_clean_4: 20,
  tasks_done_1: 5,
  tasks_done_2: 20,
  tasks_done_3: 50,
  tasks_done_4: 100,
  tasks_ontime_1: 5,
  tasks_ontime_2: 20,
  tasks_ontime_3: 50,
  closure_closed_1: 1,
  closure_closed_2: 5,
  closure_closed_3: 15,
  closure_closed_4: 30,
  closure_speed_1: 3,
  closure_speed_2: 10,
};

// ── Compute earned achievements for a user ────────────────────────────────────

export async function computeEarnedAchievements(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any>,
): Promise<string[]> {
  const earned: string[] = [];

  // ── NTS metrics ────────────────────────────────────────────────────────────
  const ntsEntriesRes = await sb
    .from('nts_entries')
    .select('id')
    .or(`rp_main_id.eq.${userId},rp2_id.eq.${userId}`);
  if (ntsEntriesRes.error) throw new Error(`NTS entries query failed: ${ntsEntriesRes.error.message}`);

  const ntsViewCount = ntsEntriesRes.data?.length ?? 0;

  // Clean rounds: rounds where checklist is approved AND entry's rp_main_id is this user
  const cleanRoundsRes = await sb
    .from('nts_doc_rounds')
    .select('id, nts_entry_id, checklist_approved, nts_entries!inner(rp_main_id)')
    .eq('checklist_approved', true)
    .eq('nts_entries.rp_main_id', userId);
  if (cleanRoundsRes.error) throw new Error(`Clean rounds query failed: ${cleanRoundsRes.error.message}`);
  const cleanRoundCount = cleanRoundsRes.data?.length ?? 0;

  // Overdue NTS rounds assigned to this user
  const overdueNtsRes = await sb
    .from('nts_doc_rounds')
    .select('id, received_date, nts_entries!inner(rp_main_id, rp2_id)')
    .eq('checklist_approved', false)
    .is('remarks_issued_at', null);
  if (overdueNtsRes.error) throw new Error(`Overdue NTS query failed: ${overdueNtsRes.error.message}`);

  const now = new Date();
  const overdueNtsCount = (overdueNtsRes.data ?? []).filter(r => {
    const entries = r.nts_entries as unknown as { rp_main_id: string | null; rp2_id: string | null };
    const isAssigned = entries.rp_main_id === userId || entries.rp2_id === userId;
    if (!isAssigned) return false;
    const deadline = new Date(r.received_date);
    deadline.setDate(deadline.getDate() + 3);
    return now > deadline;
  }).length;

  // ── Task metrics ───────────────────────────────────────────────────────────
  // tasks.responsible stores the user's display name, not UUID — look it up first
  const { data: profileData } = await sb
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();
  const userFullName = profileData?.full_name ?? '';

  let tasksData: Array<{ id: number; status: string; deadline: string | null; responsible: string | null }> = [];
  if (userFullName) {
    const { data } = await sb
      .from('tasks')
      .select('id, status, deadline, responsible')
      .eq('responsible', userFullName);
    tasksData = data ?? [];
  }

  const doneTasks = tasksData.filter(t => t.status === 'completed');
  const doneCount = doneTasks.length;

  // "On-time" category: completed tasks that had a deadline (no completion timestamp
  // available in the data model, so we count completed tasks with a deadline field)
  const onTimeCount = doneTasks.filter(t => !!t.deadline).length;

  // Overdue: currently overdue (not completed and deadline passed)
  const overdueTasks = tasksData.filter(t =>
    t.status === 'overdue' ||
    (t.status !== 'completed' && t.deadline && new Date(t.deadline) < now)
  );
  const overdueTaskCount = overdueTasks.length;

  // ── Closure metrics ────────────────────────────────────────────────────────
  // closure_objects doesn't track per-user assignments directly.
  // We look at closure_changes where user_id = userId and field indicates completion.
  const closureChangesRes = await sb
    .from('closure_changes')
    .select('object_id, field_name, new_value, changed_at')
    .eq('user_id', userId);
  if (closureChangesRes.error) throw new Error(`Closure changes query failed: ${closureChangesRes.error.message}`);

  const closureChanges = closureChangesRes.data ?? [];

  // Count distinct objects where user made at least one change (proxy for participation)
  const closureObjectIds = new Set(closureChanges.map(c => c.object_id));
  const closureParticipatedCount = closureObjectIds.size;

  // Quick closures: objects where all user changes happened within 30 days
  const closureQuickCount = (() => {
    const byObject: Record<number, string[]> = {};
    for (const c of closureChanges) {
      if (!byObject[c.object_id]) byObject[c.object_id] = [];
      byObject[c.object_id].push(c.changed_at);
    }
    let quick = 0;
    for (const dates of Object.values(byObject)) {
      const sorted = dates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
      if (sorted.length >= 2) {
        const spanDays = (sorted[sorted.length - 1] - sorted[0]) / 86400000;
        if (spanDays <= 30) quick++;
      }
    }
    return quick;
  })();

  // ── Evaluate positive achievements ────────────────────────────────────────
  const metrics: Record<string, number> = {
    nts_views: ntsViewCount,
    nts_clean: cleanRoundCount,
    tasks_done: doneCount,
    tasks_ontime: onTimeCount,
    closure_closed: closureParticipatedCount,
    closure_speed: closureQuickCount,
  };

  const metricForId = (id: string): number => {
    if (id.startsWith('nts_views')) return metrics.nts_views;
    if (id.startsWith('nts_clean')) return metrics.nts_clean;
    if (id.startsWith('tasks_done')) return metrics.tasks_done;
    if (id.startsWith('tasks_ontime')) return metrics.tasks_ontime;
    if (id.startsWith('closure_closed')) return metrics.closure_closed;
    if (id.startsWith('closure_speed')) return metrics.closure_speed;
    return 0;
  };

  for (const ach of ACHIEVEMENTS.filter(a => a.kind === 'positive')) {
    const threshold = POSITIVE_THRESHOLDS[ach.id];
    if (threshold !== undefined && metricForId(ach.id) >= threshold) {
      earned.push(ach.id);
    }
  }

  // ── Evaluate negative achievements (only the highest active tier) ──────────
  const negCategories = [
    {
      prefix: 'nts_overdue',
      count: overdueNtsCount,
    },
    {
      prefix: 'tasks_overdue',
      count: overdueTaskCount,
    },
  ];

  for (const { prefix, count } of negCategories) {
    if (count === 0) continue;
    const tiers = ACHIEVEMENTS
      .filter(a => a.id.startsWith(prefix))
      .sort((a, b) => b.tier - a.tier); // highest tier first

    for (const tier of tiers) {
      // This tier is active if count > previous tier's maxCount (or just >= 1 for tier 1)
      const prevTierMax = tier.tier === 1 ? 0 : (tiers.find(t => t.tier === tier.tier - 1)?.maxCount ?? 0);
      if (count > prevTierMax) {
        earned.push(tier.id);
        break;
      }
    }
  }

  return earned;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

/** Group achievements by module → category */
export function groupAchievements(): Record<AchievementModule, Record<string, Achievement[]>> {
  const result = {} as Record<AchievementModule, Record<string, Achievement[]>>;
  for (const a of ACHIEVEMENTS) {
    if (!result[a.module]) result[a.module] = {};
    if (!result[a.module][a.category]) result[a.module][a.category] = [];
    result[a.module][a.category].push(a);
  }
  return result;
}

export const MODULE_LABELS: Record<AchievementModule, { label: string; icon: string; color: string }> = {
  nts:     { label: 'НТС',                   icon: '🔬', color: 'indigo' },
  tasks:   { label: 'Протокольные поручения', icon: '📋', color: 'teal'   },
  closure: { label: 'Закрытие объектов',      icon: '🏗️', color: 'amber'  },
};
