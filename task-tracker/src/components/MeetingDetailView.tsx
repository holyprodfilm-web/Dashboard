import { useState, useEffect } from 'react';
import { Plus, Calendar, User, FileText, ArrowLeft, Trash2, Loader2, Building2, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../lib/usePermissions';
import { canEditTask } from '../lib/dataFilters';
import type { Address, Task, Meeting, Profile } from '../types';
import { STATUS_CONFIG } from '../types';
import { getAutoStatus } from '../utils';
import CreateTaskModal from './CreateTaskModal';
import EditMeetingModal from './EditMeetingModal';

interface MeetingDetailViewProps {
  meetingId: number;
  addresses: Address[];
  tasks: Task[];
  profiles: Profile[];
  onBack: () => void;
  onReload: () => void;
}

export default function MeetingDetailView({ meetingId, addresses, tasks, profiles, onBack, onReload }: MeetingDetailViewProps) {
  const { profile } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    supabase.from('meetings').select('*').eq('id', meetingId).single().then(res => {
      if (res.data) setMeeting(res.data);
    });
  }, [meetingId]);

  const meetingTasks = tasks.filter(t => t.meeting_id === meetingId);
  const availableObjects = addresses.filter(a => meeting?.selected_objects?.includes(a["Код УИН"]));

  const updateStatus = async (taskId: number, newStatus: string) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    onReload();
  };

  const deleteTask = async (taskId: number) => {
    if (!window.confirm('Удалить поручение?')) return;
    await supabase.from('tasks').delete().eq('id', taskId);
    onReload();
  };

  if (!meeting) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <>
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition">
        <ArrowLeft size={18} /> Назад к дашборду
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{meeting.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-4">
          <span className="flex items-center gap-1.5"><Calendar size={14} /> {meeting.meeting_date}</span>
          <span className="flex items-center gap-1.5"><User size={14} /> {meeting.manager}</span>
          {meeting.protocol_number && <span className="flex items-center gap-1.5"><FileText size={14} /> №{meeting.protocol_number}</span>}
        </div>
        <div className="flex justify-between items-center">
          <div className="text-sm text-slate-600">Объектов в протоколе: <span className="font-bold text-slate-900">{meeting.selected_objects?.length || 0}</span></div>
          <div className="flex gap-2">
            {canEdit && (
              <button 
                onClick={() => setShowEditModal(true)} 
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl shadow-sm text-sm transition"
              >
                <Edit2 size={16} /> Редактировать протокол
              </button>
            )}
            {canCreate && (
              <button 
                onClick={() => setShowTaskModal(true)} 
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-md text-sm"
              >
                <Plus size={16} /> Новое поручение
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {meetingTasks.map(task => {
          const addr = addresses.find(a => a["Код УИН"] === task.object_uin);
          const autoStatus = getAutoStatus(task.status, task.deadline);
          const st = STATUS_CONFIG[autoStatus as keyof typeof STATUS_CONFIG];
          const taskEditable = canEditTask(task, profile);
          return (
            <div key={task.id} className="bg-white p-5 rounded-xl border border-slate-200 hover:shadow-md transition">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-mono">УИН: {task.object_uin}</span>
                    <span className="text-sm font-medium text-slate-700">{addr?.["Наименование объекта"]}</span>
                  </div>
                  <p className="text-slate-900 mb-3">{task.description}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5"><User size={14} /> {task.responsible}</span>
                    {task.responsible_org && (
                      <span className="flex items-center gap-1.5 text-indigo-600 font-medium">
                        <Building2 size={14} /> {task.responsible_org}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5"><Calendar size={14} /> Срок: {task.deadline}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {taskEditable ? (
                    <select value={task.status} onChange={(e) => updateStatus(task.id, e.target.value)} className={`px-3 py-1.5 rounded-lg text-xs border font-medium cursor-pointer outline-none ${st.bg} ${st.color}`}>
                      <option value="new">Новое</option>
                      <option value="in_progress">В работе</option>
                      <option value="completed">Исполнено</option>
                    </select>
                  ) : (
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ${st.bg} ${st.color}`}>
                      {st.label}
                    </span>
                  )}
                  {canDelete && (
                    <button onClick={() => deleteTask(task.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {meetingTasks.length === 0 && <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">Поручений пока нет</div>}
      </div>

      {showTaskModal && (
        <CreateTaskModal
          meetingId={meetingId}
          availableObjects={availableObjects}
          onClose={() => setShowTaskModal(false)}
          onCreated={onReload}
        />
      )}

      {showEditModal && meeting && (
        <EditMeetingModal
          meeting={meeting}
          addresses={addresses}
          profiles={profiles}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false);
            onReload();
            supabase.from('meetings').select('*').eq('id', meetingId).single().then(res => {
              if (res.data) setMeeting(res.data);
            });
          }}
        />
      )}
    </>
  );
}
