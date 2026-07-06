import { useState } from 'react';
import { Plus, Search, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Address, Profile } from '../types';

interface CreateMeetingModalProps {
  addresses: Address[];
  profiles: Profile[];
  onClose: () => void;
  onCreated: (meetingId: number) => void;
}

export default function CreateMeetingModal({ addresses, profiles, onClose, onCreated }: CreateMeetingModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [protocol, setProtocol] = useState('');
  const [managerId, setManagerId] = useState('');
  const [selectedUins, setSelectedUins] = useState<string[]>([]);
  const [searchObj, setSearchObj] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredObjs = addresses.filter((a) => 
    a["Наименование объекта"].toLowerCase().includes(searchObj.toLowerCase()) ||
    a["Код УИН"].includes(searchObj) ||
    a["Городской округ"].toLowerCase().includes(searchObj.toLowerCase())
  );

  const toggleUin = (uin: string) => {
    setSelectedUins(prev => prev.includes(uin) ? prev.filter(u => u !== uin) : [...prev, uin]);
  };

  const handleCreate = async () => {
    if (!title || !managerId || !date) return;
    
    const selectedProfile = profiles.find(p => p.id === managerId);
    if (!selectedProfile) {
      alert('Пожалуйста, выберите руководителя проекта');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.from('meetings').insert([{
      title, 
      protocol_number: protocol, 
      meeting_date: date, 
      manager: selectedProfile.full_name,
      selected_objects: selectedUins
    }]).select();
    setSaving(false);
    
    if (!error && data && data.length > 0) {
      onCreated(data[0].id);
    } else {
      alert('Ошибка создания: ' + (error?.message || 'Неизвестная ошибка'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Новое совещание</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="Тема совещания *" 
              className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" 
              autoFocus
            />
            
            <select 
              value={managerId} 
              onChange={e => setManagerId(e.target.value)} 
              className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition text-slate-700"
            >
              <option value="">Выберите руководителя проекта *</option>
              {profiles.filter(p => p.role === 'admin' || p.role === 'manager').map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.role === 'admin' ? 'Администратор' : 'Руководитель'})
                </option>
              ))}
            </select>

            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" 
            />
            <input 
              value={protocol} 
              onChange={e => setProtocol(e.target.value)} 
              placeholder="Номер протокола" 
              className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" 
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Объекты совещания ({selectedUins.length} выбрано)
            </label>
            
            {selectedUins.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                {selectedUins.map(uin => {
                  const obj = addresses.find((a) => a["Код УИН"] === uin);
                  return (
                    <span 
                      key={uin} 
                      onClick={() => toggleUin(uin)} 
                      className="flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 rounded-lg text-xs cursor-pointer hover:bg-teal-200 transition"
                    >
                      {obj?.["Городской округ"]}: {obj?.["Наименование объекта"].substring(0, 30)}... <X size={12} />
                    </span>
                  );
                })}
              </div>
            )}

            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                value={searchObj} 
                onChange={e => setSearchObj(e.target.value)} 
                placeholder="Поиск объекта по названию, УИН или округу..." 
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" 
              />
            </div>

            <div className="border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
              {filteredObjs.slice(0, 50).map((obj) => (
                <label 
                  key={obj["Код УИН"]} 
                  className={`flex items-center gap-3 p-3 border-b border-slate-50 last:border-0 cursor-pointer transition ${
                    selectedUins.includes(obj["Код УИН"]) ? 'bg-teal-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedUins.includes(obj["Код УИН"])} 
                    onChange={() => toggleUin(obj["Код УИН"])} 
                    className="w-4 h-4 text-teal-600 rounded" 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {obj["Наименование объекта"]}
                    </div>
                    <div className="text-xs text-slate-500">
                      {obj["Городской округ"]} • УИН: {obj["Код УИН"]}
                    </div>
                  </div>
                </label>
              ))}
              {filteredObjs.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-sm">
                  Объекты не найдены
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition">
            Отмена
          </button>
          <button 
            onClick={handleCreate} 
            disabled={!title || !managerId || saving} 
            className="px-5 py-2.5 bg-gradient-to-r from-[#E97386] to-[#EFA566] text-white rounded-xl hover:from-[#d4607a] hover:to-[#e0925a] disabled:opacity-50 transition flex items-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>} Создать
          </button>
        </div>
      </div>
    </div>
  );
}