import { useState } from 'react';
import { Search, Building2, User, Calendar, Tag, GitBranch, Upload, Trash2, ClipboardList } from 'lucide-react';
import type { Address, Task, Meeting } from '../types';
import { STATUS_CONFIG } from '../types';
import { getAutoStatus } from '../utils';
import ObjectDetailModal from './ObjectDetailModal';
import AddressUploadModal from './AddressUploadModal';
import { supabase } from '../lib/supabase';

interface ObjectsViewProps {
  addresses: Address[];
  tasks: Task[];
  meetings: Meeting[];
  isAdmin?: boolean;
  onReload?: () => void;
}

export default function ObjectsView({ addresses, tasks, meetings, isAdmin, onReload }: ObjectsViewProps) {
  const [search, setSearch] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [selectedFocusTaskId, setSelectedFocusTaskId] = useState<number | null>(null);
  const [deleteDialogDetailAddress, setDeleteDialogDetailAddress] = useState<Address | null>(null);
  const [deleteDialogFocusTaskId, setDeleteDialogFocusTaskId] = useState<number | null>(null);

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

  const filtered = addresses.filter((a) =>
    a["Код УИН"].toLowerCase().includes(search.toLowerCase()) ||
    a["Наименование объекта"].toLowerCase().includes(search.toLowerCase()) ||
    a["Городской округ"].toLowerCase().includes(search.toLowerCase()) ||
    (a["Руководитель проекта"] || '').toLowerCase().includes(search.toLowerCase())
  );

  const tasksByUin = (uin: string) => tasks.filter(t => t.object_uin === uin);

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1">Справочник объектов</h2>
          <p className="text-slate-500">Всего объектов: {addresses.length}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-sm font-medium shadow-sm shrink-0"
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
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по УИН, названию, округу или руководителю..."
          className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition shadow-sm"
        />
      </div>

      <div className="grid gap-3">
        {filtered.slice(0, 100).map((addr) => {
          const addrTasks = tasksByUin(addr["Код УИН"]);
          const tCount = addrTasks.length;
          const SHOW_MAX = 3;
          const visibleTasks = addrTasks.slice(0, SHOW_MAX);
          const overflowCount = tCount - SHOW_MAX;
          return (
            <div
              key={addr["Код УИН"]}
              className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => { setSelectedAddress(addr); setSelectedFocusTaskId(null); }}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-mono font-semibold">
                      УИН: {addr["Код УИН"]}
                    </span>
                    <h4 className="font-semibold text-slate-900 group-hover:text-blue-600 transition">
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
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition"
                    >
                      <GitBranch size={13} />
                      {tCount} поруч.
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(addr); setDeleteError(''); }}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                      title="Удалить объект"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Clickable task chips */}
              {tCount > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                  {visibleTasks.map(task => {
                    const status = getAutoStatus(task.status, task.deadline);
                    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['new'];
                    return (
                      <button
                        key={task.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedAddress(addr); setSelectedFocusTaskId(task.id); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition text-xs text-left group/chip"
                        title={task.description}
                      >
                        <ClipboardList size={11} className="text-slate-400 group-hover/chip:text-blue-500 shrink-0" />
                        <span className={`px-1.5 py-0.5 rounded-md font-medium shrink-0 ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-slate-600 truncate max-w-[180px]">{task.description}</span>
                      </button>
                    );
                  })}
                  {overflowCount > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedAddress(addr); setSelectedFocusTaskId(null); }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition text-xs text-slate-500"
                    >
                      +{overflowCount} ещё…
                    </button>
                  )}
                </div>
              )}
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
                <div className="p-2 bg-red-100 rounded-xl">
                  <Trash2 size={20} className="text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Удалить объект?</h3>
              </div>
              <p className="text-slate-600 text-sm">
                Вы собираетесь удалить объект{' '}
                <span className="font-semibold text-slate-900">
                  {deleteTarget['Наименование объекта']}
                </span>{' '}
                (УИН: <span className="font-mono text-blue-700">{deleteTarget['Код УИН']}</span>).
                Это действие необратимо.
              </p>
              {linkedTaskCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <GitBranch size={15} className="text-red-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-800">
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
                            className="w-full flex items-center gap-2 text-xs text-red-900 hover:bg-red-100 rounded-lg px-1.5 py-1 transition text-left group/task"
                            title="Открыть карточку объекта"
                          >
                            <span className={`px-1.5 py-0.5 rounded-md font-medium shrink-0 ${sc?.bg ?? 'bg-slate-100'} ${sc?.color ?? 'text-slate-700'}`}>
                              {sc?.label ?? task.status}
                            </span>
                            <span className="truncate flex-1">{task.description}</span>
                            <span className="text-red-400 opacity-0 group-hover/task:opacity-100 transition shrink-0">↗</span>
                          </button>
                        </li>
                      );
                    })}
                    {overflowCount > 0 && (
                      <li className="text-xs text-red-700 pl-1">и ещё {overflowCount}…</li>
                    )}
                  </ul>
                </div>
              )}
              {deleteError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
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
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
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
