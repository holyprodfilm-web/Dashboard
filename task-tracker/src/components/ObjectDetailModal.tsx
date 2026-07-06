import { useState, useEffect, useRef } from 'react';
import { X, ClipboardList, GitBranch, Building2, Calendar, User, Tag, Loader2, Link2, FlaskConical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../lib/usePermissions';
import type { Address, Task, TaskLink, Meeting, NtsEntry, NtsSession, NtsDocRound } from '../types';
import { STATUS_CONFIG, NTS_STATUS_CONFIG } from '../types';
import { getAutoStatus } from '../utils';
import TaskGraph from './TaskGraph';

interface Props {
  address: Address;
  allTasks: Task[];
  allMeetings: Meeting[];
  focusTaskId?: number;
  onClose: () => void;
}

export default function ObjectDetailModal({ address, allTasks, allMeetings, focusTaskId, onClose }: Props) {
  const uin = address["Код УИН"];
  const { canDelete } = usePermissions();
  const [tab, setTab] = useState<'tasks' | 'graph' | 'nts'>('tasks');
  const [ntsEntries, setNtsEntries] = useState<NtsEntry[]>([]);
  const [ntsSessions, setNtsSessions] = useState<NtsSession[]>([]);
  const [ntsRounds, setNtsRounds] = useState<NtsDocRound[]>([]);
  const [loadingNts, setLoadingNts] = useState(false);
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(focusTaskId ?? null);
  const taskRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (!focusTaskId) return 'all';
    const focusedTask = allTasks.find(t => t.id === focusTaskId);
    if (!focusedTask) return 'all';
    return getAutoStatus(focusedTask.status, focusedTask.deadline);
  });

  const objectTasks = allTasks.filter(t => t.object_uin === uin);
  const meetingMap = new Map(allMeetings.map(m => [m.id, m]));

  const filteredTasks = statusFilter === 'all'
    ? objectTasks
    : objectTasks.filter(t => getAutoStatus(t.status, t.deadline) === statusFilter);

  // Group tasks by meeting
  const tasksByMeeting = filteredTasks.reduce<Record<number, Task[]>>((acc, t) => {
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

  const loadNts = async () => {
    setLoadingNts(true);
    const { data: entData } = await supabase.from('nts_entries').select('*').eq('object_uin', uin).order('created_at', { ascending: false });
    const entries = (entData ?? []) as NtsEntry[];
    setNtsEntries(entries);
    if (entries.length > 0) {
      const ids = entries.map(e => e.id);
      const [sesRes, rndRes] = await Promise.all([
        supabase.from('nts_sessions').select('*').in('nts_entry_id', ids).order('session_date', { ascending: false }),
        supabase.from('nts_doc_rounds').select('*').in('nts_entry_id', ids).order('received_date', { ascending: false }),
      ]);
      setNtsSessions((sesRes.data ?? []) as NtsSession[]);
      setNtsRounds((rndRes.data ?? []) as NtsDocRound[]);
    }
    setLoadingNts(false);
  };

  useEffect(() => {
    if (tab === 'nts') void loadNts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, uin]);

  // Scroll to and highlight the focused task after render
  useEffect(() => {
    if (!focusTaskId) return;
    const el = taskRefs.current[focusTaskId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightedTaskId(focusTaskId);
    const timer = setTimeout(() => setHighlightedTaskId(null), 2500);
    return () => clearTimeout(timer);
  }, [focusTaskId]);

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
                <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded-lg text-xs font-mono font-semibold">
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
                <span className="text-xs px-1.5 py-0.5 bg-teal-100 rounded-full text-teal-600">{links.length}</span>
              )}
            </button>
            <button
              onClick={() => setTab('nts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === 'nts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FlaskConical size={15} />
              НТС
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {tab === 'tasks' && (
            <>
              {objectTasks.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {[
                    { key: 'all', label: 'Все', count: objectTasks.length },
                    ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
                      key,
                      label: cfg.label,
                      count: objectTasks.filter(t => getAutoStatus(t.status, t.deadline) === key).length,
                    })).filter(({ count }) => count > 0),
                  ].map(({ key, label, count }) => {
                    const cfg = key === 'all' ? null : STATUS_CONFIG[key];
                    const isActive = statusFilter === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          isActive
                            ? cfg
                              ? `${cfg.bg} ${cfg.color} border-current shadow-sm`
                              : 'bg-slate-800 text-white border-slate-800 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                        }`}
                      >
                        {label}
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/30' : 'bg-slate-100 text-slate-400'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
                  <p>{objectTasks.length === 0 ? 'По этому объекту поручений нет' : 'Нет поручений с таким статусом'}</p>
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
                              <div
                                key={task.id}
                                ref={(el) => { taskRefs.current[task.id] = el; }}
                                className={`p-4 rounded-xl border transition-all duration-700 ${
                                  highlightedTaskId === task.id
                                    ? 'bg-teal-50 border-teal-400 ring-2 ring-teal-300 shadow-md'
                                    : 'bg-slate-50 border-slate-100'
                                }`}
                              >
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
                                          // Determine direction relative to current task
                                          const isParent = link.from_task_id === task.id; // current → other
                                          return (
                                            <div
                                              key={link.id}
                                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                                                isParent
                                                  ? 'bg-teal-50 text-teal-700'
                                                  : 'bg-teal-50 text-teal-700'
                                              }`}
                                            >
                                              <Link2 size={11} />
                                              <span className="font-medium">
                                                {isParent ? '↓ Породило:' : '↑ Родилось из:'}
                                              </span>
                                              <span className="opacity-80">
                                                #{other.id}: {other.description.slice(0, 28)}{other.description.length > 28 ? '…' : ''}
                                              </span>
                                              {canDelete && (
                                                <button
                                                  onClick={(e) => deleteLink(link.id, e)}
                                                  className="ml-1 opacity-50 hover:opacity-100 hover:text-[#E93A58] transition"
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
                <Loader2 className="animate-spin text-teal-500" size={28} />
              </div>
            ) : (
              <TaskGraph tasks={objectTasks} links={links} meetings={allMeetings} />
            )
          )}

          {tab === 'nts' && (
            loadingNts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-indigo-500" size={28} />
              </div>
            ) : ntsEntries.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FlaskConical size={32} className="mx-auto mb-2 opacity-30" />
                <p>Записей НТС по этому объекту нет</p>
              </div>
            ) : (
              <div className="space-y-6">
                {ntsEntries.map(entry => {
                  const sCfg = NTS_STATUS_CONFIG[entry.status];
                  const entrySessions = ntsSessions.filter(s => s.nts_entry_id === entry.id);
                  const entryRounds = ntsRounds.filter(r => r.nts_entry_id === entry.id);
                  const pct = entry.contract_cost > 0
                    ? ((entry.pre_nts_cost - entry.contract_cost) / entry.contract_cost * 100)
                    : 0;
                  return (
                    <div key={entry.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      {/* Entry header */}
                      <div className="bg-slate-50 px-5 py-3 flex items-center gap-3 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sCfg.bg} ${sCfg.color}`}>
                          {sCfg.label}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{entry.contractor}</span>
                        <span className={`text-sm font-semibold ml-auto ${pct > 30 ? 'text-red-600' : 'text-amber-600'}`}>
                          {pct > 0 ? '+' : ''}{pct.toFixed(1)}% ({new Intl.NumberFormat('ru-RU').format(entry.pre_nts_cost)} тыс.)
                        </span>
                      </div>

                      {/* Sessions */}
                      {entrySessions.length > 0 && (
                        <div className="px-5 py-3 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                            Заседания ВКС ({entrySessions.length})
                          </p>
                          <div className="space-y-2">
                            {entrySessions.map(s => (
                              <div key={s.id} className="text-sm">
                                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                                  <Calendar size={12} className="text-violet-500" />
                                  {new Date(s.session_date).toLocaleDateString('ru-RU')}
                                </span>
                                {s.remarks && (
                                  <p className="text-slate-500 mt-0.5 pl-4">{s.remarks}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Doc rounds */}
                      {entryRounds.length > 0 && (
                        <div className="px-5 py-3 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                            Раунды документации ({entryRounds.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {entryRounds.map((r, idx) => (
                              <span key={r.id} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg">
                                Раунд {idx + 1}: {new Date(r.received_date).toLocaleDateString('ru-RU')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Protocol */}
                      {entry.protocol_number && (
                        <div className="px-5 py-3 border-t border-slate-100 text-sm text-slate-600">
                          <span className="font-medium">Протокол №{entry.protocol_number}</span>
                          {entry.protocol_date && (
                            <span className="ml-2 text-slate-400">от {new Date(entry.protocol_date).toLocaleDateString('ru-RU')}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
