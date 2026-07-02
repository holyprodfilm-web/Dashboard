import { useState } from 'react';
import { Search, Building2, User, Calendar, Tag } from 'lucide-react';
import type { Address } from '../types';

interface ObjectsViewProps {
  addresses: Address[];
}

export default function ObjectsView({ addresses }: ObjectsViewProps) {
  const [search, setSearch] = useState('');

  const filtered = addresses.filter((a) =>
    a["Код УИН"].toLowerCase().includes(search.toLowerCase()) ||
    a["Наименование объекта"].toLowerCase().includes(search.toLowerCase()) ||
    a["Городской округ"].toLowerCase().includes(search.toLowerCase()) ||
    (a["Руководитель проекта"] || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-1">Справочник объектов</h2>
        <p className="text-slate-500">Всего объектов: {addresses.length}</p>
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
        {filtered.slice(0, 100).map((addr) => (
          <div key={addr["Код УИН"]} className="bg-white p-5 rounded-xl border border-slate-200 hover:shadow-md transition">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-mono font-semibold">
                УИН: {addr["Код УИН"]}
              </span>
              <h4 className="font-semibold text-slate-900">{addr["Наименование объекта"]}</h4>
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
        ))}
        
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
    </>
  );
}