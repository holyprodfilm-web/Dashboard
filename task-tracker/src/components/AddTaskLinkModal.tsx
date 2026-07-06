import { useState } from 'react';
import { Link2, X, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Task, TaskLink, Meeting } from '../types';
import { STATUS_CONFIG } from '../types';
import { getAutoStatus } from '../utils';

interface Props {
  currentTask: Task;
  allTasks: Task[];           // все поручения по тому же object_uin
  existingLinks: TaskLink[];  // уже существующие связи для currentTask
  meetings: Meeting[];
  onClose: () => void;
  onCreated: () => void;
}

export default function AddTaskLinkModal({ currentTask, allTasks, existingLinks, meetings, onClose, onCreated }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Другие задачи по тому же объекту, исключая уже связанные
  const linkedIds = new Set(
    existingLinks.flatMap(l => [l.from_task_id, l.to_task_id])
  );
  linkedIds.add(currentTask.id);

  const candidates = allTasks.filter(
    t => t.object_uin === currentTask.object_uin && !linkedIds.has(t.id)
  );

  const meetingMap = new Map(meetings.map(m => [m.id, m]));

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('task_links').insert([{
      from_task_id: currentTask.id,
      to_task_id: selectedId,
      object_uin: currentTask.object_uin,
    }]);
    setSaving(false);
    if (err) {
      setError('Ошибка создания связи: ' + err.message);
    } else {
      onCreated();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-blue-500" />
            <h3 className="text-lg font-bold text-slate-900">Добавить связь</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          Выберите поручение по объекту <span className="font-mono text-slate-700">{currentTask.object_uin}</span>, с которым хотите установить связь.
        </p>

        {candidates.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            Нет доступных поручений для связи по этому объекту
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {candidates.map(task => {
              const status = getAutoStatus(task.status, task.deadline);
              const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['new'];
              const meeting = meetingMap.get(task.meeting_id);
              const isSelected = selectedId === task.id;
              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedId(isSelected ? null : task.id)}
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-400">#{task.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-sm text-slate-800 font-medium line-clamp-2">{task.description}</p>
                      {meeting && (
                        <p className="text-xs text-slate-400 mt-1 truncate">{meeting.title}</p>
                      )}
                    </div>
                    {isSelected && <Check size={16} className="text-blue-500 shrink-0 mt-1" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm transition">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedId || saving}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm disabled:opacity-50 transition flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            Создать связь
          </button>
        </div>
      </div>
    </div>
  );
}
