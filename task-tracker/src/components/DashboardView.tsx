import { useMemo } from 'react';
import {
  FileText, Clock, CheckCircle, AlertTriangle,
  CalendarClock, Sunrise, User, Building2,
} from 'lucide-react';
import type { Task, Meeting, Address } from '../types';
import { getAutoStatus } from '../utils';
import KpiCard from './KpiCard';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD in *local* timezone — safe for date-only comparisons. */
function localDateStr(d: Date): string {
  return d.toLocaleDateString('sv'); // 'sv' locale always gives ISO YYYY-MM-DD
}

// ─── module-level sub-components (stable identity across renders) ────────────

interface TaskRowProps {
  t: Task;
  meetingManagerMap: Map<number, string>;
  addressNameMap: Map<string, string>;
}

function TaskRow({ t, meetingManagerMap, addressNameMap }: TaskRowProps) {
  const manager = meetingManagerMap.get(t.meeting_id) ?? 'Не указан';
  const objName = addressNameMap.get(t.object_uin) ?? t.object_uin;
  return (
    <div className="px-4 py-3 border-b last:border-0 border-slate-100 hover:bg-slate-50 transition">
      <p className="text-xs font-medium text-slate-500 truncate mb-0.5">{objName}</p>
      <p className="text-sm text-slate-800 leading-snug line-clamp-2">{t.description}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {t.responsible && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <User size={11} /> {t.responsible}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Building2 size={11} /> {manager}
        </span>
      </div>
    </div>
  );
}

interface DeadlineGroupProps {
  title: string;
  subtitle: string;
  tasks: Task[];
  icon: React.ReactNode;
  headerBg: string;
  headerText: string;
  countBg: string;
  emptyText: string;
  meetingManagerMap: Map<number, string>;
  addressNameMap: Map<string, string>;
}

function DeadlineGroup({
  title, subtitle, tasks, icon,
  headerBg, headerText, countBg, emptyText,
  meetingManagerMap, addressNameMap,
}: DeadlineGroupProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className={`${headerBg} px-5 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <span className={headerText}>{icon}</span>
          <div>
            <h3 className={`text-sm font-bold ${headerText}`}>{title}</h3>
            <p className={`text-xs ${headerText} opacity-70`}>{subtitle}</p>
          </div>
        </div>
        <span className={`${countBg} text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-sm`}>
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto max-h-72">
        {tasks.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">{emptyText}</p>
        ) : (
          tasks.map(t => (
            <TaskRow
              key={t.id}
              t={t}
              meetingManagerMap={meetingManagerMap}
              addressNameMap={addressNameMap}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

interface DashboardViewProps {
  tasks: Task[];
  meetings: Meeting[];
  addresses: Address[];
  onManagerClick: (managerName: string) => void;
  onStatusFilter?: (status: 'in_progress' | 'completed' | 'overdue') => void;
}

export default function DashboardView({
  tasks, meetings, addresses, onManagerClick, onStatusFilter,
}: DashboardViewProps) {

  const meetingManagerMap = useMemo(
    () => new Map(meetings.map(m => [m.id, m.manager])),
    [meetings],
  );

  const addressNameMap = useMemo(
    () => new Map(addresses.map(a => [a['Код УИН'], a['Наименование объекта']])),
    [addresses],
  );

  // ── aggregate KPI + per-manager stats ──────────────────────────────────────
  const analytics = useMemo(() => {
    let total = 0, completed = 0, inProgress = 0, overdue = 0, newTasks = 0;
    const byManager: Record<string, {
      total: number; completed: number; overdue: number; inProgress: number; newTasks: number;
    }> = {};

    tasks.forEach(t => {
      if (!t.object_uin) return;
      total++;
      const manager = meetingManagerMap.get(t.meeting_id) ?? 'Не указан';
      const status = getAutoStatus(t.status, t.deadline);

      if (!byManager[manager]) {
        byManager[manager] = { total: 0, completed: 0, overdue: 0, inProgress: 0, newTasks: 0 };
      }
      byManager[manager].total++;

      if      (status === 'completed')  { completed++;  byManager[manager].completed++;  }
      else if (status === 'in_progress'){ inProgress++; byManager[manager].inProgress++; }
      else if (status === 'overdue')    { overdue++;    byManager[manager].overdue++;    }
      else if (status === 'new')        { newTasks++;   byManager[manager].newTasks++;   }
    });

    return { total, completed, inProgress, overdue, newTasks, byManager };
  }, [tasks, meetings, meetingManagerMap]);

  // ── today / tomorrow buckets (timezone-safe string comparison) ─────────────
  const { dueToday, dueTomorrow, todayLabel, tomorrowLabel } = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr    = localDateStr(now);
    const tomorrowStr = localDateStr(tomorrow);

    const dueToday: Task[]    = [];
    const dueTomorrow: Task[] = [];

    tasks.forEach(t => {
      if (!t.deadline || !t.object_uin) return;
      if (getAutoStatus(t.status, t.deadline) === 'completed') return;

      const dayStr = t.deadline.slice(0, 10); // YYYY-MM-DD, already local in the DB
      if      (dayStr === todayStr)    dueToday.push(t);
      else if (dayStr === tomorrowStr) dueTomorrow.push(t);
    });

    const fmt = (d: Date) =>
      d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

    return {
      dueToday,
      dueTomorrow,
      todayLabel:    fmt(now),
      tomorrowLabel: fmt(tomorrow),
    };
  }, [tasks]);

  const progressPercent = analytics.total > 0
    ? Math.round((analytics.completed / analytics.total) * 100)
    : 0;

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#8A4C08]">Дашборд</h2>
        <p className="text-slate-500">Аналитика и статистика исполнения поручений</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KpiCard title="Всего поручений" value={analytics.total} icon={<FileText size={20} />} color="blue" />
        <KpiCard title="В работе" value={analytics.inProgress + analytics.newTasks} icon={<Clock size={20} />} color="amber"
          onClick={onStatusFilter ? () => onStatusFilter('in_progress') : undefined} />
        <KpiCard title="Исполнено" value={analytics.completed} icon={<CheckCircle size={20} />} color="emerald"
          onClick={onStatusFilter ? () => onStatusFilter('completed') : undefined} />
        <KpiCard title="Просрочено" value={analytics.overdue} icon={<AlertTriangle size={20} />} color="red"
          onClick={onStatusFilter ? () => onStatusFilter('overdue') : undefined} />
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="text-sm text-slate-500 mb-1">Общий прогресс</div>
          <div className="text-3xl font-bold text-slate-900">{progressPercent}%</div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
            <div
              className="bg-gradient-to-r from-[#E97386] to-[#EFA566] h-2 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Deadline groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <DeadlineGroup
          title="Срок истекает сегодня"
          subtitle={todayLabel}
          tasks={dueToday}
          icon={<CalendarClock size={16} />}
          headerBg="bg-[#FFF0F3]"
          headerText="text-[#E93A58]"
          countBg="bg-[#E93A58]"
          emptyText="Нет поручений со сроком сегодня"
          meetingManagerMap={meetingManagerMap}
          addressNameMap={addressNameMap}
        />
        <DeadlineGroup
          title="Срок истекает завтра"
          subtitle={tomorrowLabel}
          tasks={dueTomorrow}
          icon={<Sunrise size={16} />}
          headerBg="bg-amber-50"
          headerText="text-amber-700"
          countBg="bg-amber-500"
          emptyText="Нет поручений со сроком завтра"
          meetingManagerMap={meetingManagerMap}
          addressNameMap={addressNameMap}
        />
      </div>

      {/* Manager breakdown table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-[#8A4C08]">
            Количество протокольных поручений по руководителям проектов
          </h3>
          <p className="text-sm text-slate-500">Общее количество поручений по всем совещаниям</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Руководитель проекта</th>
                <th className="px-6 py-3 text-center font-medium">Всего поручений</th>
                <th className="px-6 py-3 text-center font-medium">Выполнено</th>
                <th className="px-6 py-3 text-center font-medium">В работе</th>
                <th className="px-6 py-3 text-center font-medium">Просрочено</th>
                <th className="px-6 py-3 text-left font-medium w-48">Прогресс</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(analytics.byManager).map(([manager, data]) => {
                const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                return (
                  <tr
                    key={manager}
                    onClick={() => onManagerClick(manager)}
                    className="hover:bg-teal-50 transition cursor-pointer"
                  >
                    <td className="px-6 py-4 font-medium text-teal-600 hover:text-teal-700">{manager}</td>
                    <td className="px-6 py-4 text-center font-semibold">{data.total}</td>
                    <td className="px-6 py-4 text-center text-emerald-600 font-semibold">{data.completed}</td>
                    <td className="px-6 py-4 text-center text-amber-600 font-semibold">
                      {data.inProgress + data.newTasks}
                    </td>
                    <td className="px-6 py-4 text-center text-[#E93A58] font-semibold">{data.overdue}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-500 w-8">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {Object.keys(analytics.byManager).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Поручений пока нет. Создайте первое совещание!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
