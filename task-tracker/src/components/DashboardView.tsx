import { useMemo } from 'react';
import { FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import type { Task, Meeting } from '../types';
import { getAutoStatus } from '../utils';
import KpiCard from './KpiCard';

interface DashboardViewProps {
  tasks: Task[];
  meetings: Meeting[];
  onManagerClick: (managerName: string) => void;
}

export default function DashboardView({ tasks, meetings, onManagerClick }: DashboardViewProps) {
  const analytics = useMemo(() => {
    const meetingManagerMap = new Map(meetings.map(m => [m.id, m.manager]));
    
    let total = 0, completed = 0, inProgress = 0, overdue = 0, newTasks = 0;
    const byManager: Record<string, { total: number; completed: number; overdue: number; inProgress: number; newTasks: number }> = {};

    tasks.forEach(t => {
      if (!t.object_uin) return;
      
      total++;
      const manager = meetingManagerMap.get(t.meeting_id) || "Не указан";
      const status = getAutoStatus(t.status, t.deadline);

      if (!byManager[manager]) {
        byManager[manager] = { 
          total: 0, 
          completed: 0, 
          overdue: 0, 
          inProgress: 0,
          newTasks: 0
        };
      }
      
      byManager[manager].total++;

      if (status === 'completed') { 
        completed++; 
        byManager[manager].completed++; 
      }
      else if (status === 'in_progress') {
        inProgress++;
        byManager[manager].inProgress++;
      }
      else if (status === 'overdue') { 
        overdue++; 
        byManager[manager].overdue++; 
      }
      else if (status === 'new') {
        newTasks++;
        byManager[manager].newTasks++;
      }
    });

    return { total, completed, inProgress, overdue, newTasks, byManager };
  }, [tasks, meetings]);

  const progressPercent = analytics.total > 0 ? Math.round((analytics.completed / analytics.total) * 100) : 0;

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Дашборд</h2>
        <p className="text-slate-500">Аналитика и статистика исполнения поручений</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <KpiCard title="Всего поручений" value={analytics.total} icon={<FileText size={20} />} color="blue" />
        <KpiCard title="В работе" value={analytics.inProgress + analytics.newTasks} icon={<Clock size={20} />} color="amber" />
        <KpiCard title="Исполнено" value={analytics.completed} icon={<CheckCircle size={20} />} color="emerald" />
        <KpiCard title="Просрочено" value={analytics.overdue} icon={<AlertTriangle size={20} />} color="red" />
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="text-sm text-slate-500 mb-1">Общий прогресс</div>
          <div className="text-3xl font-bold text-slate-900">{progressPercent}%</div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Количество протокольных поручений по руководителям проектов</h3>
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
                    className="hover:bg-blue-50 transition cursor-pointer"
                  >
                    <td className="px-6 py-4 font-medium text-blue-600 hover:text-blue-700">{manager}</td>
                    <td className="px-6 py-4 text-center font-semibold">{data.total}</td>
                    <td className="px-6 py-4 text-center text-emerald-600 font-semibold">{data.completed}</td>
                    <td className="px-6 py-4 text-center text-amber-600 font-semibold">{data.inProgress + data.newTasks}</td>
                    <td className="px-6 py-4 text-center text-red-600 font-semibold">{data.overdue}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
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