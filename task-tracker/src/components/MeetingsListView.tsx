import { FileText, Calendar, User, Building2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../lib/usePermissions';
import type { Meeting, Task } from '../types';

interface MeetingsListViewProps {
  meetings: Meeting[];
  tasks: Task[];
  onReload: () => void;
  onSelectMeeting: (id: number) => void;
  title?: string;
  emptyMessage?: string;
}

export default function MeetingsListView({
  meetings,
  tasks,
  onReload,
  onSelectMeeting,
  title = 'Протоколы',
  emptyMessage = 'Протоколов пока нет',
}: MeetingsListViewProps) {
  const { canDelete } = usePermissions();

  const deleteMeeting = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Удалить этот протокол и все его поручения?')) return;
    await supabase.from('meetings').delete().eq('id', id);
    onReload();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-slate-500">Всего протоколов: {meetings.length}</p>
      </div>

      <div className="grid gap-4">
        {meetings.map(m => {
          const mTasks = tasks.filter(t => t.meeting_id === m.id);
          const mCompleted = mTasks.filter(t => t.status === 'completed').length;
          const pct = mTasks.length > 0 ? Math.round((mCompleted / mTasks.length) * 100) : 0;
          return (
            <div
              key={m.id}
              onClick={() => onSelectMeeting(m.id)}
              className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-xl cursor-pointer transition-all duration-300 group"
            >
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition mb-2">
                    {m.title}
                  </h3>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5"><Calendar size={14} /> {m.meeting_date}</span>
                    <span className="flex items-center gap-1.5"><User size={14} /> {m.manager}</span>
                    {m.protocol_number && (
                      <span className="flex items-center gap-1.5"><FileText size={14} /> №{m.protocol_number}</span>
                    )}
                    <span className="flex items-center gap-1.5"><Building2 size={14} /> {m.selected_objects?.length || 0} объектов</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-700">Прогресс</div>
                    <div className="text-xs text-slate-400">{mCompleted} из {mTasks.length}</div>
                  </div>
                  <div className="w-14 h-14 relative flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" stroke="#e2e8f0" strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={pct === 100 ? '#10b981' : pct > 0 ? '#3b82f6' : '#94a3b8'}
                        strokeWidth="3"
                        strokeDasharray={`${pct}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-sm font-bold text-slate-700">{pct}%</span>
                  </div>
                  {canDelete && (
                    <button
                      onClick={(e) => deleteMeeting(m.id, e)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                      title="Удалить"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {meetings.length === 0 && (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p>{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
