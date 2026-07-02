import { useMemo } from 'react';
import { ArrowLeft, Calendar, FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import type { Meeting, Task, Address } from '../types';
import { getAutoStatus } from '../utils';

interface ManagerTasksViewProps {
  managerName: string;
  meetings: Meeting[];
  tasks: Task[];
  addresses: Address[];
  onBack: () => void;
}

type TaskStatus = 'new' | 'in_progress' | 'completed' | 'overdue';

const STATUS_COLORS: Record<TaskStatus, string> = {
  new: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новое',
  in_progress: 'В работе',
  completed: 'Исполнено',
  overdue: 'Просрочено',
};

export default function ManagerTasksView({ managerName, meetings, tasks, addresses, onBack }: ManagerTasksViewProps) {
  const managerData = useMemo(() => {
    const managerMeetings = meetings.filter(m => m.manager === managerName);
    const managerMeetingIds = new Set(managerMeetings.map(m => m.id));
    const managerTasks = tasks.filter(t => managerMeetingIds.has(t.meeting_id));

    const tasksByMeeting = managerMeetings.map(meeting => {
      const meetingTasks = managerTasks.filter(t => t.meeting_id === meeting.id);
      const completed = meetingTasks.filter(t => t.status === 'completed').length;
      const total = meetingTasks.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        meeting,
        tasks: meetingTasks,
        completed,
        total,
        pct,
      };
    });

    const total = managerTasks.length;
    const completed = managerTasks.filter(t => t.status === 'completed').length;
    const inProgress = managerTasks.filter(t => t.status === 'in_progress').length;
    const newTasks = managerTasks.filter(t => t.status === 'new').length;
    const overdue = managerTasks.filter(t => {
      const status = getAutoStatus(t.status, t.deadline);
      return status === 'overdue';
    }).length;

    return {
      tasksByMeeting,
      total,
      completed,
      inProgress,
      newTasks,
      overdue,
    };
  }, [managerName, meetings, tasks]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
        >
          <ArrowLeft size={18} /> Назад к дашборду
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">{managerName}</h2>
        <p className="text-slate-500">Все поручения руководителя проекта</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={20} className="text-blue-600" />
            <span className="text-sm text-slate-500">Всего</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{managerData.total}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={20} className="text-amber-600" />
            <span className="text-sm text-slate-500">В работе</span>
          </div>
          <div className="text-3xl font-bold text-amber-600">{managerData.inProgress + managerData.newTasks}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={20} className="text-emerald-600" />
            <span className="text-sm text-slate-500">Исполнено</span>
          </div>
          <div className="text-3xl font-bold text-emerald-600">{managerData.completed}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={20} className="text-red-600" />
            <span className="text-sm text-slate-500">Просрочено</span>
          </div>
          <div className="text-3xl font-bold text-red-600">{managerData.overdue}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="text-sm text-slate-500 mb-1">Прогресс</div>
          <div className="text-3xl font-bold text-slate-900">
            {managerData.total > 0 ? Math.round((managerData.completed / managerData.total) * 100) : 0}%
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {managerData.tasksByMeeting.map(({ meeting, tasks: meetingTasks, completed, total, pct }) => (
          <div key={meeting.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{meeting.title}</h3>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500 mt-2">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} /> {meeting.meeting_date}
                    </span>
                    {meeting.protocol_number && (
                      <span className="flex items-center gap-1.5">
                        <FileText size={14} /> №{meeting.protocol_number}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-700">Прогресс</div>
                  <div className="text-xs text-slate-400">{completed} из {total}</div>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
            </div>

            <div className="p-6">
              {meetingTasks.length === 0 ? (
                <p className="text-center text-slate-400 py-4">Поручений пока нет</p>
              ) : (
                <div className="space-y-3">
                  {meetingTasks.map(task => {
                    const addr = addresses.find(a => a["Код УИН"] === task.object_uin);
                    const status = getAutoStatus(task.status, task.deadline) as TaskStatus;

                    return (
                      <div key={task.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="text-sm text-slate-900 font-medium">{task.description}</p>
                            {addr && addr["Наименование объекта"] && (
                              <p className="text-xs text-slate-500 mt-1">
                                Объект: {addr["Наименование объекта"]}
                              </p>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[status]}`}>
                            {STATUS_LABELS[status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          {task.responsible && (
                            <span>Ответственный: {task.responsible}</span>
                          )}
                          {task.deadline && (
                            <span>Срок: {task.deadline}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {managerData.tasksByMeeting.length === 0 && (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p>Совещаний и поручений пока нет</p>
          </div>
        )}
      </div>
    </div>
  );
}