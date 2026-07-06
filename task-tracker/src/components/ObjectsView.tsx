import { useState, useEffect } from 'react';
import { Search, Building2, User, Calendar, Tag, GitBranch, Upload, Trash2, ClipboardList, X as XIcon, Filter, Link as LinkIcon, Check } from 'lucide-react';
import type { Address, Task, Meeting } from '../types';
import { STATUS_CONFIG } from '../types';
import { getAutoStatus } from '../utils';
import ObjectDetailModal from './ObjectDetailModal';
import AddressUploadModal from './AddressUploadModal';
import { supabase } from '../lib/supabase';

const STATUS_FILTER_LABELS: Record<string, string> = {
  in_work: 'В работе',
  completed: 'Исполнено',
  overdue: 'Просрочено',
};

interface ObjectsViewProps {
  addresses: Address[];
  tasks: Task[];
  meetings: Meeting[];
  isAdmin?: boolean;
  onReload?: () => void;
  statusFilter?: 'in_work' | 'completed' | 'overdue' | null;
  onClearFilter?: () => void;
}

export default function ObjectsView({ addresses, tasks, meetings, isAdmin, onReload, statusFilter, onClearFilter }: ObjectsViewProps) {
  const [search, setSearch] = useState<string>(
    () => localStorage.getItem('objectsSearch') ?? ''
  );
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [selectedFocusTaskId, setSelectedFocusTaskId] = useState<number | null>(null);
  const [deleteDialogDetailAddress, setDeleteDialogDetailAddress] = useState<Address | null>(null);
  const [deleteDialogFocusTaskId, setDeleteDialogFocusTaskId] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  // Local health-badge filter (independent of the external statusFilter prop)
  // Initialise from URL query param (direct navigation) or sessionStorage (returning from another view)
  const [localStatusFilter, setLocalStatusFilter] = useState<string | null>(() => {
    const valid = ['overdue', 'in_progress', 'new', 'completed'];
    const params = new URLSearchParams(window.location.search);
    const s = params.get('status');
    if (s && valid.includes(s)) return s;
    const stored = localStorage.getItem('objectsLocalStatusFilter');
    return stored && valid.includes(stored) ? stored : null;
  });

  // Keep URL and sessionStorage in sync with the active filter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (localStatusFilter) {
      params.set('status', localStatusFilter);
      localStorage.setItem('objectsLocalStatusFilter', localStatusFilter);
    } else {
      params.delete('status');
      localStorage.removeItem('objectsLocalStatusFilter');
    }
    const newSearch = params.toString();
    const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [localStatusFilter]);

  // Clear the ?status= param from the URL when leaving the objects view
  useEffect(() => {
    return () => {
      const params = new URLSearchParams(window.location.search);
      params.delete('status');
      const newSearch = params.toString();
      const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    };
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('Код УИН', deleteTarget['Код УИН']);
    setDeleting(false);
    if (error) {
      setDeleteError('Ошибка удаления: ' + error.message);
    } else {
      setDeleteTarget(null);
      onReload?.();
    }
  };

  const tasksByUin = (uin: string) => tasks.filter(t => t.object_uin === uin);

  // Global health counts across all objects (for the badge row)
  const statusOrder = ['overdue', 'in_progress', 'new', 'completed'] as const;
  const globalStatusCounts = (() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      const s = getAutoStatus(task.status, task.deadline);
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  })();

  const filtered = addresses.filter((a) => {
    const matchesSearch =
      a["Код УИН"].toLowerCase().includes(search.toLowerCase()) ||
      a["Наименование объекта"].toLowerCase().includes(search.toLowerCase()) ||
      a["Городской округ"].toLowerCase().includes(search.toLowerCase()) ||
      (a["Руководитель проекта"] || '').toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    const addrTasks = tasks.filter(t => t.object_uin === a["Код УИН"]);

    // External filter from dashboard (in_work covers in_progress + new)
    if (statusFilter) {
      const passesExternal = addrTasks.some(t => {
        const s = getAutoStatus(t.status, t.deadline);
        if (statusFilter === 'in_work') return s === 'in_progress' || s === 'new';
        return s === statusFilter;
      });
      if (!passesExternal) return false;
    }

    // Local health-badge filter
    if (localStatusFilter) {
      const passesLocal = addrTasks.some(t => getAutoStatus(t.status, t.deadline) === localStatusFilter);
      if (!passesLocal) return false;
    }

    return true;
  });

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#8A4C08] mb-1">Справочник объектов</h2>
          <p className="text-slate-500 mb-3">
            {statusFilter
              ? `Показаны объекты: ${STATUS_FILTER_LABELS[statusFilter]} · ${filtered.length} из ${addresses.length}`
              : `Всего объектов: ${addresses.length}`}
          </p>
          {/* External filter indicator (from dashboard KPI navigation) */}
          {statusFilter && (
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={onClearFilter}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition font-medium"
              >
                <Filter size={12} />
                Фильтр: {STATUS_FILTER_LABELS[statusFilter]}
                <XIcon size={12} className="ml-1 opacity-60" />
                Сбросить
              </button>
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition font-medium border ${
                  linkCopied
                    ? 'bg-teal-50 border-teal-200 text-teal-700'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
                title="Скопировать ссылку на текущий фильтр"
              >
                {linkCopied ? (
                  <>
                    <Check size={12} className="text-teal-600" />
                    Ссылка скопирована!
                  </>
                ) : (
                  <>
                    <LinkIcon size={12} />
                    Скопировать ссылку
                  </>
                )}
              </button>
            </div>
          )}
          {/* Health summary badge row */}
          {tasks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {statusOrder.filter(s => globalStatusCounts[s]).map(s => {
                const cfg = STATUS_CONFIG[s];
                const count = globalStatusCounts[s];
                const isActive = localStatusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setLocalStatusFilter(isActive ? null : s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition
                      ${isActive
                        ? `${cfg.bg} ${cfg.color} border-current shadow-sm ring-2 ring-offset-1 ring-current/30`
                        : `${cfg.bg} ${cfg.color} border-transparent opacity-80 hover:opacity-100 hover:border-current`
                      }`}
                    title={isActive ? 'Сбросить фильтр' : `Показать только объекты со статусом «${cfg.label}»`}
                  >
                    <span className="text-sm font-bold">{count}</span>
                    <span>{cfg.label.toLowerCase()}</span>
                  </button>
                );
              })}
              {localStatusFilter && (
                <button
                  onClick={() => setLocalStatusFilter(null)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-100 transition"
                  title="Сбросить фильтр"
                >
                  × сбросить
                </button>
              )}
            </div>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition text-sm font-medium shadow-sm shrink-0"
          >
            <Upload size={16} />
            Загрузить CSV
          </button>
        )}
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          value={search}
          onChange={e => {
            const v = e.target.value;
            setSearch(v);
            if (v) localStorage.setItem('objectsSearch', v);
            else localStorage.removeItem('objectsSearch');
          }}
          placeholder="Поиск по УИН, названию, округу или руководителю..."
          className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition shadow-sm"
        />
      </div>

      <div className="grid gap-3">
        {filtered.slice(0, 100).map((addr) => {
          const addrTasks = tasksByUin(addr["Код УИН"]);
          const tCount = addrTasks.length;
          const SHOW_MAX = 3;
          const visibleTasks = addrTasks.slice(0, SHOW_MAX);
          return (
            <div
              key={addr["Код УИН"]}
              className="bg-white p-5 rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => { setSelectedAddress(addr); setSelectedFocusTaskId(null); }}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded-lg text-xs font-mono font-semibold">
                      УИН: {addr["Код УИН"]}
                    </span>
                    <h4 className="font-semibold text-slate-900 group-hover:text-teal-600 transition">
                      {addr["Наименование объекта"]}
                    </h4>
                    {addr["Тип объекта"] && (
                      <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium flex items-center gap-1">
                        <Tag size={12} /> {addr["Тип объекта"]}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={14} /> {addr["Городской округ"]}
                    </span>
                    {addr["Год реализации"] && (
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} /> {addr["Год реализации"]}
                      </span>
                    )}
                    {addr["Руководитель проекта"] && (
                      <span className="flex items-center gap-1.5">
                        <User size={14} /> {addr["Руководитель проекта"]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tCount > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedAddress(addr); setSelectedFocusTaskId(null); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-600 transition"
                    >
                      <GitBranch size={13} />
                      {tCount} поруч.
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(addr); setDeleteError(''); }}
                      className="p-2 text-slate-300 hover:text-[#E93A58] hover:bg-[#FFF0F3] rounded-lg transition opacity-0 group-hover:opacity-100"
                      title="Удалить объект"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Task chips / status summary */}
              {(() => {
                if (tCount === 0) {
                  return (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
                        <ClipboardList size={11} className="opacity-60" />
                        Поручений нет
                      </span>
                    </div>
                  );
                }
                if (tCount > SHOW_MAX) {
                  // Compact status summary: count tasks by effective status
                  const statusCounts: Record<string, { count: number; firstTaskId: number }> = {};
                  for (const task of addrTasks) {
                    const s = getAutoStatus(task.status, task.deadline);
                    if (!statusCounts[s]) statusCounts[s] = { count: 0, firstTaskId: task.id };
                    statusCounts[s].count++;
                  }
                  const statusOrder = ['overdue', 'in_progress', 'new', 'completed'];
                  const sortedStatuses = Object.keys(statusCounts).sort(
                    (a, b) => statusOrder.indexOf(a) - statusOrder.indexOf(b)
                  );
                  return (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                      {sortedStatuses.map(s => {
                        const cfg = STATUS_CONFIG[s] || STATUS_CONFIG['new'];
                        const { count, firstTaskId } = statusCounts[s];
                        return (
                          <button
                            key={s}
                            onClick={(e) => { e.stopPropagation(); setSelectedAddress(addr); setSelectedFocusTaskId(firstTaskId); }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition text-xs font-medium ${cfg.bg} ${cfg.color} border-transparent hover:border-current hover:opacity-90`}
                            title={`Перейти к первому поручению со статусом «${cfg.label}»`}
                          >
                            <span className="font-bold">{count}</span>
                            <span className="opacity-80">{cfg.label.toLowerCase()}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                }
                return (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    {visibleTasks.map(task => {
                      const status = getAutoStatus(task.status, task.deadline);
                      const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['new'];
                      return (
                        <button
                          key={task.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedAddress(addr); setSelectedFocusTaskId(task.id); }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 transition text-xs text-left group/chip"
                          title={task.description}
                        >
                          <ClipboardList size={11} className="text-slate-400 group-hover/chip:text-teal-500 shrink-0" />
                          <span className={`px-1.5 py-0.5 rounded-md font-medium shrink-0 ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-slate-600 truncate max-w-[180px]">{task.description}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">
            Объекты не найдены
          </div>
        )}

        {filtered.length > 100 && (
          <div className="text-center py-4 text-slate-400 text-sm">
            Показано 100 из {filtered.length}. Уточните поиск.
          </div>
        )}
      </div>

      {selectedAddress && (
        <ObjectDetailModal
          address={selectedAddress}
          allTasks={tasks}
          allMeetings={meetings}
          focusTaskId={selectedFocusTaskId ?? undefined}
          onClose={() => { setSelectedAddress(null); setSelectedFocusTaskId(null); }}
        />
      )}

      {showUpload && (
        <AddressUploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            onReload?.();
          }}
        />
      )}

      {deleteTarget && (() => {
        const linkedTasks = tasks.filter(t => t.object_uin === deleteTarget['Код УИН']);
        const linkedTaskCount = linkedTasks.length;
        const SHOW_MAX = 5;
        const visibleTasks = linkedTasks.slice(0, SHOW_MAX);
        const overflowCount = linkedTaskCount - SHOW_MAX;
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FFD6DC] rounded-xl">
                  <Trash2 size={20} className="text-[#E93A58]" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Удалить объект?</h3>
              </div>
              <p className="text-slate-600 text-sm">
                Вы собираетесь удалить объект{' '}
                <span className="font-semibold text-slate-900">
                  {deleteTarget['Наименование объекта']}
                </span>{' '}
                (УИН: <span className="font-mono text-teal-700">{deleteTarget['Код УИН']}</span>).
                Это действие необратимо.
              </p>
              {linkedTaskCount > 0 && (
                <div className="bg-[#FFF0F3] border border-[#FFB3BF] rounded-xl px-3 py-2.5 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <GitBranch size={15} className="text-[#E93A58] mt-0.5 shrink-0" />
                    <p className="text-sm text-[#a32440]">
                      <span className="font-semibold">Удаление заблокировано:</span> с этим объектом связано{' '}
                      <span className="font-semibold">{linkedTaskCount}</span>{' '}
                      {linkedTaskCount === 1 ? 'поручение' : linkedTaskCount >= 2 && linkedTaskCount <= 4 ? 'поручения' : 'поручений'}.
                      {' '}Перед удалением объекта необходимо снять или переназначить все связанные поручения.
                    </p>
                  </div>
                  <ul className="space-y-1 pl-1">
                    {visibleTasks.map(task => {
                      const sc = STATUS_CONFIG[task.status];
                      return (
                        <li key={task.id}>
                          <button
                            type="button"
                            onClick={() => { setDeleteDialogDetailAddress(deleteTarget); setDeleteDialogFocusTaskId(task.id); }}
                            className="w-full flex items-center gap-2 text-xs text-[#861d35] hover:bg-[#FFD6DC] rounded-lg px-1.5 py-1 transition text-left group/task"
                            title="Открыть карточку объекта"
                          >
                            <span className={`px-1.5 py-0.5 rounded-md font-medium shrink-0 ${sc?.bg ?? 'bg-slate-100'} ${sc?.color ?? 'text-slate-700'}`}>
                              {sc?.label ?? task.status}
                            </span>
                            <span className="truncate flex-1">{task.description}</span>
                            <span className="text-[#f0697f] opacity-0 group-hover/task:opacity-100 transition shrink-0">↗</span>
                          </button>
                        </li>
                      );
                    })}
                    {overflowCount > 0 && (
                      <li className="text-xs text-[#c42d49] pl-1">и ещё {overflowCount}…</li>
                    )}
                  </ul>
                </div>
              )}
              {deleteError && (
                <p className="text-sm text-[#E93A58] bg-[#FFF0F3] border border-[#FFB3BF] rounded-xl px-3 py-2">
                  {deleteError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => { setDeleteTarget(null); setDeleteError(''); }}
                  disabled={deleting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition text-sm font-medium disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || linkedTaskCount > 0}
                  className="flex items-center gap-2 px-4 py-2 bg-[#E93A58] hover:bg-[#c42d49] text-white rounded-xl transition text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  title={linkedTaskCount > 0 ? 'Снимите все поручения перед удалением' : undefined}
                >
                  {deleting ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {deleteDialogDetailAddress && (
        <ObjectDetailModal
          address={deleteDialogDetailAddress}
          allTasks={tasks}
          allMeetings={meetings}
          focusTaskId={deleteDialogFocusTaskId ?? undefined}
          onClose={() => { setDeleteDialogDetailAddress(null); setDeleteDialogFocusTaskId(null); }}
        />
      )}
    </>
  );
}
