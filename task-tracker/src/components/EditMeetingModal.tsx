import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Address, Profile, Meeting } from '../types';

interface EditMeetingModalProps {
  meeting: Meeting;
  addresses: Address[];
  profiles: Profile[];
  onClose: () => void;
  onSave: () => void;
}

function resolveManagerId(profiles: Profile[], managerName: string): string {
  return profiles.find(p => p.full_name === managerName)?.id ?? '';
}

export default function EditMeetingModal({ meeting, addresses, profiles, onClose, onSave }: EditMeetingModalProps) {
  const [title, setTitle] = useState(meeting.title);
  const [date, setDate] = useState(meeting.meeting_date);
  const [protocol, setProtocol] = useState(meeting.protocol_number || '');
  const [managerId, setManagerId] = useState(() => resolveManagerId(profiles, meeting.manager));
  const [selectedUins, setSelectedUins] = useState<string[]>(meeting.selected_objects || []);
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

  const handleSave = async () => {
    if (!title || !managerId || !date) {
      alert('Пожалуйста, заполните все обязательные поля');
      return;
    }
    
    const selectedProfile = profiles.find(p => p.id === managerId);
    if (!selectedProfile) {
      alert('Пожалуйста, выберите руководителя проекта');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('meetings')
      .update({
        title,
        protocol_number: protocol,
        meeting_date: date,
        manager: selectedProfile.full_name,
        selected_objects: selectedUins
      })
      .eq('id', meeting.id);
    
    setSaving(false);
    
    if (!error) {
      onSave();
    } else {
      alert('Ошибка сохранения: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Редактировать протокол</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Тема совещания *
              </label>
              <input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                placeholder="Введите тему"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Руководитель проекта *
              </label>
              <select 
                value={managerId} 
                onChange={e => setManagerId(e.target.value)} 
                className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition text-slate-700"
              >
                <option value="">Выберите руководителя</option>
                {profiles.filter(p => p.role === 'admin' || p.role === 'manager').map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Дата совещания *
              </label>
              <input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Номер протокола
              </label>
              <input 
                value={protocol} 
                onChange={e => setProtocol(e.target.value)} 
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                placeholder="Например: 1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
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
                      className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs cursor-pointer hover:bg-blue-200 transition"
                    >
                      {obj?.["Городской округ"]}: {obj?.["Наименование объекта"].substring(0, 20)}... 
                      <X size={12} />
                    </span>
                  );
                })}
              </div>
            )}

            <div className="relative mb-2">
              <input 
                value={searchObj} 
                onChange={e => setSearchObj(e.target.value)} 
                placeholder="Поиск объекта по названию, УИН или округу..." 
                className="w-full pl-4 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
              />
            </div>

            <div className="border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
              {filteredObjs.slice(0, 50).map((obj) => (
                <label 
                  key={obj["Код УИН"]} 
                  className={`flex items-center gap-3 p-3 border-b border-slate-50 last:border-0 cursor-pointer transition ${
                    selectedUins.includes(obj["Код УИН"]) ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedUins.includes(obj["Код УИН"])} 
                    onChange={() => toggleUin(obj["Код УИН"])} 
                    className="w-4 h-4 text-blue-600 rounded" 
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
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition font-medium"
          >
            Отмена
          </button>
          <button 
            onClick={handleSave} 
            disabled={!title || !managerId || saving} 
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 font-medium"
          >
            {saving ? (
              <>Сохранение...</>
            ) : (
              <><Save size={16} /> Сохранить изменения</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}