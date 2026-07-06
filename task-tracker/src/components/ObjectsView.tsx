import { useState } from 'react';
import { Search, Building2, User, Calendar, Tag, GitBranch, Upload } from 'lucide-react';
import type { Address, Task, Meeting } from '../types';
import ObjectDetailModal from './ObjectDetailModal';
import AddressUploadModal from './AddressUploadModal';

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

  const filtered = addresses.filter((a) =>
    a["Код УИН"].toLowerCase().includes(search.toLowerCase()) ||
    a["Наименование объекта"].toLowerCase().includes(search.toLowerCase()) ||
    a["Городской округ"].toLowerCase().includes(search.toLowerCase()) ||
    (a["Руководитель проекта"] || '').toLowerCase().includes(search.toLowerCase())
  );

  const taskCountByUin = (uin: string) => tasks.filter(t => t.object_uin === uin).length;

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
          const tCount = taskCountByUin(addr["Код УИН"]);
          return (
            <div
              key={addr["Код УИН"]}
              onClick={() => setSelectedAddress(addr)}
              className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
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
                {tCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500 shrink-0">
                    <GitBranch size={13} />
                    {tCount} поруч.
                  </div>
                )}
              </div>
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
          onClose={() => setSelectedAddress(null)}
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
    </>
  );
}
