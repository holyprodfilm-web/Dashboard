import { useState, useEffect } from 'react';
import { X, ClipboardList, GitBranch, Building2, Calendar, User, Tag, Loader2, Link2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../lib/usePermissions';
import type { Address, Task, TaskLink, Meeting } from '../types';
import { STATUS_CONFIG } from '../types';
import { getAutoStatus } from '../utils';
import TaskGraph from './TaskGraph';

interface Props {
  address: Address;
  allTasks: Task[];
  allMeetings: Meeting[];
  onClose: () => void;
}

export default function ObjectDetailModal({ address, allTasks, allMeetings, onClose }: Props) {
  const uin = address["Код УИН"];
  const { canDelete } = usePermissions();
  const [tab, setTab] = useState<'tasks' | 'graph'>('tasks');
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);

  const objectTasks = allTasks.filter(t => t.object_uin === uin);
  const meetingMap = new Map(allMeetings.map(m => [m.id, m]));

  // Group tasks by meeting
  const tasksByMeeting = objectTasks.reduce<Record<number, Task[]>>((acc, t) => {
    if (!acc[t.meeting_id]) acc[t.meeting_id] = [];
    acc[t.meeting_id].push(t);
    return acc;
  }, {});

  const loadLinks = async () => {
    setLoadingLinks(true);
    const { data } = await supabase
      .from('task_links')
      .select('*')
      .eq('object_uin', uin);
    setLinks(data || []);
    setLoadingLinks(false);
  };

  useEffect(() => { void loadLinks(); }, [uin]);

  const deleteLink = async (linkId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Удалить эту связь?')) return;
    await supabase.from('task_links').delete().eq('id', linkId);
    await loadLinks();
  };

  const getLinksForTask = (taskId: number) =>
    links.filter(l => l.from_task_id === taskId || l.to_task_id === taskId);

  const getLinkedTask = (link: TaskLink, currentTaskId: number) => {
    const otherId = link.from_task_id === currentTaskId ? link.to_task_id : link.from_task_id;
    return objectTasks.find(t => t.id === otherId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-mono font-semibold">
                  УИН: {uin}
                </span>
                {address["Тип объекта"] && (
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs flex items-center gap-1">
                    <Tag size={11} /> {address["Тип объекта"]}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900">{address["Наименование объекта"]}</h2>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500 mt-2">
                <span className="flex items-center gap-1.5"><Building2 size={13} /> {address["Городской округ"]}</span>
                {address["Год реализации"] && (
                  <span className="flex items-center gap-1.5"><Calendar size={13} /> {address["Год реализации"]}</span>
                )}
                {address["Руководитель проекта"] && (
                  <span className="flex items-center gap-1.5"><User size={13} /> {address["Руководитель проекта"]}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={22} />
            </button>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl mt-4 w-fit">
            <button
              onClick={() => setTab('tasks')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'tasks' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList size={15} />
              Поручения
              <span className="text-xs px-1.5 py-0.5 bg-slate-200 rounded-full text-slate-600">{objectTasks.length}</span>
            </button>
            <button
              onClick={() => setTab('graph')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'graph' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitBranch size={15} />
              Граф связей
              {links.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 rounded-full text-blue-600">{links.length}</span>
              )}
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {tab === 'tasks' && (
            <>
              {objectTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
                  <p>По этому объекту поручений нет</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(tasksByMeeting).map(([meetingIdStr, mTasks]) => {
                    const meetingId = Number(meetingIdStr);
                    const meeting = meetingMap.get(meetingId);
                    return (
                      <div key={meetingId}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-px flex-1 bg-slate-100" />
                          <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                            {meeting ? `${meeting.title} · ${meeting.meeting_date}` : `Протокол #${meetingId}`}
                          </span>
                          <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <div className="space-y-2">
                          {mTasks.map(task => {
                            const status = getAutoStatus(task.status, task.deadline);
                            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['new'];
                            const taskLinks = getLinksForTask(task.id);
                            return (
                              <div key={task.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-xs font-mono text-slate-400">#{task.id}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                                        {cfg.label}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-800 font-medium mb-2">{task.description}</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                      {task.responsible && <span><User size={11} className="inline mr-1" />{task.responsible}</span>}
                                      {task.deadline && <span><Calendar size={11} className="inline mr-1" />до {task.deadline}</span>}
                                    </div>

                                    {/* Links for this task */}
                                    {taskLinks.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {taskLinks.map(link => {
                                          const other = getLinkedTask(link, task.id);
                                          if (!other) return null;
                                          return (
                                            <div key={link.id} className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg">
                                              <Link2 size={11} />
                                              <span>→ #{other.id}: {other.description.slice(0, 30)}{other.description.length > 30 ? '…' : ''}</span>
                                              {canDelete && (
                                                <button
                                                  onClick={(e) => deleteLink(link.id, e)}
                                                  className="ml-1 text-blue-300 hover:text-red-500 transition"
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
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'graph' && (
            loadingLinks ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-blue-500" size={28} />
              </div>
            ) : (
              <TaskGraph tasks={objectTasks} links={links} meetings={allMeetings} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
