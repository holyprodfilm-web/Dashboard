import { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { type Address, type Task, ORGANIZATIONS } from '../types';

interface CreateTaskModalProps {
  meetingId: number;
  availableObjects: Address[];
  onClose: () => void;
  onCreated: (task: Task) => void;
}

export default function CreateTaskModal({ meetingId, availableObjects, onClose, onCreated }: CreateTaskModalProps) {
  const [objectUin, setObjectUin] = useState('');
  const [responsible, setResponsible] = useState('');
  const [responsibleOrg, setResponsibleOrg] = useState('');
  const [customOrg, setCustomOrg] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    // Определяем финальную организацию
    const finalOrg = responsibleOrg === 'custom' ? customOrg : responsibleOrg;
    
    if (!objectUin || !responsible || !description || !deadline || !finalOrg) {
      alert('Пожалуйста, заполните все обязательные поля.');
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.from('tasks').insert([{
      meeting_id: meetingId,
      object_uin: objectUin,
      responsible,
      responsible_org: finalOrg,
      description,
      deadline,
      status: 'new'
    }]).select().single<Task>();

    if (error) {
      setSaving(false);
      alert('Ошибка создания поручения: ' + error.message);
      return;
    }

    // Insert succeeded. If RETURNING was blocked by RLS, data will be null —
    // in that case, fetch the newly created row directly (cheap single-row query).
    let task: Task | null = data;
    if (!task) {
      const { data: fetched } = await supabase
        .from('tasks')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('id', { ascending: false })
        .limit(1)
        .single<Task>();
      task = fetched ?? null;
    }

    setSaving(false);
    onClose();
    if (task) {
      onCreated(task);
    }
    // If task is still null, realtime subscription will deliver the INSERT event
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-slate-900">Новое поручение</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Объект *</label>
            <select 
              value={objectUin} 
              onChange={e => setObjectUin(e.target.value)} 
              className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            >
              <option value="">Выберите объект из протокола...</option>
              {availableObjects.map((a) => (
                <option key={a["Код УИН"]} value={a["Код УИН"]}>
                  {a["Наименование объекта"]} ({a["Городской округ"]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ФИО ответственного *</label>
            <input 
              value={responsible} 
              onChange={e => setResponsible(e.target.value)} 
              placeholder="Иванов И.И." 
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Организация ответственного *</label>
            <select 
              value={responsibleOrg} 
              onChange={e => setResponsibleOrg(e.target.value)} 
              className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            >
              <option value="">Выберите организацию...</option>
              {ORGANIZATIONS.map(org => (
                <option key={org} value={org}>{org}</option>
              ))}
              <option value="custom">Другое (ввести вручную)</option>
            </select>
          </div>

          {responsibleOrg === 'custom' && (
            <input 
              value={customOrg} 
              onChange={e => setCustomOrg(e.target.value)} 
              placeholder="Введите название сторонней организации *" 
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              autoFocus
            />
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Текст поручения *</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Описание поручения..." 
              rows={3}
              className="w-full p-3 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Срок исполнения *</label>
            <input 
              type="date" 
              value={deadline} 
              onChange={e => setDeadline(e.target.value)} 
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" 
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition">
              Отмена
            </button>
            <button 
              onClick={handleCreate} 
              disabled={!objectUin || !responsible || !description || !deadline || (!responsibleOrg && !customOrg) || saving} 
              className="px-5 py-2.5 bg-gradient-to-r from-[#E97386] to-[#EFA566] text-white rounded-xl hover:from-[#d4607a] hover:to-[#e0925a] disabled:opacity-50 transition flex items-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Создать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}