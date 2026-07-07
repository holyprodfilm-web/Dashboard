import { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, User, FileText, ArrowLeft, Trash2, Loader2, Building2, Edit2, Link2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../lib/usePermissions';
import { canEditTask } from '../lib/dataFilters';
import type { Address, Task, Meeting, Profile, TaskLink } from '../types';
import { STATUS_CONFIG } from '../types';
import { getAutoStatus } from '../utils';
import Toast from './Toast';
import CreateTaskModal from './CreateTaskModal';
import EditMeetingModal from './EditMeetingModal';
import MeetingAttachments from './MeetingAttachments';
import AddTaskLinkModal from './AddTaskLinkModal';

interface MeetingDetailViewProps {
  meetingId: number;
  addresses: Address[];
  tasks: Task[];         // все поручения (видимые пользователю)
  profiles: Profile[];
  meetings: Meeting[];   // все совещания (для поиска по объекту)
  onBack: () => void;
  onReload: () => void;
  onTaskCreated: (task: Task) => void;
}

export default function MeetingDetailView({
  meetingId, addresses, tasks, profiles, meetings, onBack, onReload, onTaskCreated,
}: MeetingDetailViewProps) {
  const { profile } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [linkTargetTask, setLinkTargetTask] = useState<Task | null>(null);
  const [taskLinks, setTaskLinks] = useState<TaskLink[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const meetingTasks = tasks.filter(t => t.meeting_id === meetingId);
  const availableObjects = addresses.filter(a => meeting?.selected_objects?.includes(a["Код УИН"]));

  const loadMeeting = useCallback(() => {
    supabase.from('meetings').select('*').eq('id', meetingId).single().then(res => {
      if (res.data) setMeeting(res.data);
    });
  }, [meetingId]);

  const loadLinks = useCallback(async () => {
    const taskIds = tasks.filter(t => t.meeting_id === meetingId).map(t => t.id);
    if (taskIds.length === 0) { setTaskLinks([]); return; }
    const [fromRes, toRes] = await Promise.all([
      supabase.from('task_links').select('*').in('from_task_id', taskIds),
      supabase.from('task_links').select('*').in('to_task_id', taskIds),
    ]);
    const all = [...(fromRes.data || []), ...(toRes.data || [])];
    // Deduplicate by id
    const seen = new Set<number>();
    setTaskLinks(all.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; }));
  }, [meetingId, tasks]);

  useEffect(() => { loadMeeting(); }, [loadMeeting]);
  useEffect(() => { void loadLinks(); }, [loadLinks]);

  const updateStatus = async (taskId: number, newStatus: string) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    // Real-time subscription in App.tsx propagates the UPDATE automatically
    setToast('Статус обновлён');
  };

  const deleteTask = async (taskId: number) => {
    if (!window.confirm('Удалить поручение?')) return;
    await supabase.from('tasks').delete().eq('id', taskId);
    // Real-time subscription in App.tsx propagates the DELETE automatically
    setToast('Поручение удалено');
  };

  const deleteLink = async (linkId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Удалить связь?')) return;
    await supabase.from('task_links').delete().eq('id', linkId);
    await loadLinks();
    setToast('Связь удалена');
  };

  const getLinksForTask = (taskId: number) =>
    taskLinks.filter(l => l.from_task_id === taskId || l.to_task_id === taskId);

  const getLinkedTask = (link: TaskLink, currentTaskId: number) => {
    const otherId = link.from_task_id === currentTaskId ? link.to_task_id : link.from_task_id;
    return tasks.find(t => t.id === otherId);
  };

  if (!meeting) return (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin text-teal-600" size={32} />
    </div>
  );

  return (
    <>
      {toast && (
        <Toast message={toast} duration={2000} onClose={() => setToast(null)} />
      )}
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition">
        <ArrowLeft size={18} /> Назад к дашборду
      </button>

      {/* Protocol header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{meeting.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-4">
          <span className="flex items-center gap-1.5"><Calendar size={14} /> {meeting.meeting_date}</span>
          <span className="flex items-center gap-1.5"><User size={14} /> {meeting.manager}</span>
          {meeting.protocol_number && (
            <span className="flex items-center gap-1.5"><FileText size={14} /> №{meeting.protocol_number}</span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <div className="text-sm text-slate-600">
            Объектов в протоколе: <span className="font-bold text-slate-900">{meeting.selected_objects?.length || 0}</span>
          </div>
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
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#E97386] to-[#EFA566] text-white rounded-xl shadow-md text-sm"
              >
                <Plus size={16} /> Новое поручение
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="grid gap-3 mb-4">
        {meetingTasks.map(task => {
          const addr = addresses.find(a => a["Код УИН"] === task.object_uin);
          const autoStatus = getAutoStatus(task.status, task.deadline);
          const st = STATUS_CONFIG[autoStatus as keyof typeof STATUS_CONFIG];
          const taskEditable = canEditTask(task, profile);
          const linksForTask = getLinksForTask(task.id);
          // Other tasks for same object (across all meetings) for link creation
          const sameObjectTasks = tasks.filter(t => t.object_uin === task.object_uin && t.id !== task.id);

          return (
            <div key={task.id} className="bg-white p-5 rounded-xl border border-slate-200 hover:shadow-md transition">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded-lg text-xs font-mono">
                      УИН: {task.object_uin}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{addr?.["Наименование объекта"]}</span>
                  </div>
                  <p className="text-slate-900 mb-3">{task.description}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5"><User size={14} /> {task.responsible}</span>
                    {task.responsible_org && (
                      <span className="flex items-center gap-1.5 text-teal-600 font-medium">
                        <Building2 size={14} /> {task.responsible_org}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5"><Calendar size={14} /> Срок: {task.deadline}</span>
                  </div>

                  {/* Task links */}
                  {linksForTask.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {linksForTask.map(link => {
                        const other = getLinkedTask(link, task.id);
                        if (!other) return null;
                        return (
                          <div key={link.id} className="flex items-center gap-1 text-xs px-2 py-1 bg-teal-50 text-teal-600 rounded-lg border border-blue-100">
                            <Link2 size={10} />
                            <span>→ #{other.id}: {other.description.slice(0, 35)}{other.description.length > 35 ? '…' : ''}</span>
                            {(canEdit || canDelete) && (
                              <button
                                onClick={(e) => deleteLink(link.id, e)}
                                className="ml-1 text-teal-300 hover:text-[#E93A58] transition"
                                title="Удалить связь"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {taskEditable ? (
                    <select
                      value={task.status}
                      onChange={(e) => updateStatus(task.id, e.target.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs border font-medium cursor-pointer outline-none ${st.bg} ${st.color}`}
                    >
                      <option value="new">Новое</option>
                      <option value="in_progress">В работе</option>
                      <option value="completed">Исполнено</option>
                    </select>
                  ) : (
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ${st.bg} ${st.color}`}>
                      {st.label}
                    </span>
                  )}
                  {canCreate && sameObjectTasks.length > 0 && (
                    <button
                      onClick={() => setLinkTargetTask(task)}
                      className="p-2 text-slate-300 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition"
                      title="Добавить связь с другим поручением"
                    >
                      <Link2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-2 text-slate-300 hover:text-[#E93A58] hover:bg-[#FFF0F3] rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {meetingTasks.length === 0 && (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">
            Поручений пока нет
          </div>
        )}
      </div>

      {/* Attachments */}
      <MeetingAttachments meetingId={meetingId} />

      {/* Modals */}
      {showTaskModal && (
        <CreateTaskModal
          meetingId={meetingId}
          availableObjects={availableObjects}
          onClose={() => setShowTaskModal(false)}
          onCreated={(task) => {
            onTaskCreated(task); // мгновенно добавляем в глобальный state — без полной перезагрузки
            setToast('Поручение создано');
          }}
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
            setToast('Протокол обновлён');
            onReload();
            loadMeeting();
          }}
        />
      )}

      {linkTargetTask && (
        <AddTaskLinkModal
          currentTask={linkTargetTask}
          allTasks={tasks}
          existingLinks={getLinksForTask(linkTargetTask.id)}
          meetings={meetings}
          onClose={() => setLinkTargetTask(null)}
          onCreated={() => { setLinkTargetTask(null); void loadLinks(); setToast('Связь добавлена'); }}
        />
      )}
    </>
  );
}
