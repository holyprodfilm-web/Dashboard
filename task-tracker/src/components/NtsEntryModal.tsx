import { useState, useEffect } from 'react';
import {
  X, Save, Loader2, Plus, Trash2, Calendar, ClipboardList,
  Upload, Paperclip, ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  NtsEntry, NtsSession, NtsDocRound, Profile, NtsStatus, NtsProtocolStatus,
} from '../types';
import { NTS_STATUS_CONFIG, NTS_PROTOCOL_STATUS_CONFIG } from '../types';
import NtsChecklistModal from './NtsChecklistModal';

interface Props {
  entry: NtsEntry | null;
  profiles: Profile[];
  currentUserId?: string;
  isAdmin?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type TabKey = 'main' | 'sessions' | 'protocol' | 'checklist';

const EMPTY_FORM = {
  object_uin: '',
  object_name: '',
  contractor: '',
  contract_cost: '',
  pre_nts_cost: '',
  post_nts_cost: '',
  mogae_cost: '',
  rp_main_id: '',
  rp2_id: '',
  status: 'rp_review' as NtsStatus,
  protocol_number: '',
  protocol_date: '',
  protocol_status: '' as NtsProtocolStatus | '',
  notes: '',
};

export default function NtsEntryModal({ entry, profiles, currentUserId, isAdmin, onClose, onSaved }: Props) {
  const isEdit = !!entry;
  const [tab, setTab] = useState<TabKey>('main');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [presentationDates, setPresentationDates] = useState<string[]>([]);
  const [vksDates, setVksDates] = useState<string[]>([]);
  const [sessions, setSessions] = useState<NtsSession[]>([]);
  const [rounds, setRounds] = useState<NtsDocRound[]>([]);
  const [saving, setSaving] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistRoundId, setChecklistRoundId] = useState<number | null>(null);

  // Session form
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionRemarks, setNewSessionRemarks] = useState('');
  const [addingSession, setAddingSession] = useState(false);

  // Doc round form
  const [newRoundDate, setNewRoundDate] = useState('');
  const [addingRound, setAddingRound] = useState(false);

  // Protocol file upload
  const [uploading, setUploading] = useState(false);

  // Addresses for object selector
  const [addresses, setAddresses] = useState<Array<{ uin: string; name: string }>>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Build profile options
  const managerProfiles = profiles.filter(p => ['manager', 'admin', 'module_responsible'].includes(p.role));

  useEffect(() => {
    void (async () => {
      setLoadingData(true);
      const { data: addrData } = await supabase
        .from('addresses')
        .select('"Код УИН","Наименование объекта"')
        .order('"Наименование объекта"');
      if (addrData) {
        setAddresses(addrData.map((a: Record<string, string>) => ({
          uin: a['Код УИН'],
          name: a['Наименование объекта'],
        })));
      }
      setLoadingData(false);
    })();
  }, []);

  useEffect(() => {
    if (entry) {
      setForm({
        object_uin:     entry.object_uin,
        object_name:    entry.object_name,
        contractor:     entry.contractor,
        contract_cost:  String(entry.contract_cost),
        pre_nts_cost:   String(entry.pre_nts_cost),
        post_nts_cost:  entry.post_nts_cost ? String(entry.post_nts_cost) : '',
        mogae_cost:     entry.mogae_cost ? String(entry.mogae_cost) : '',
        rp_main_id:     entry.rp_main_id ?? '',
        rp2_id:         entry.rp2_id ?? '',
        status:         entry.status,
        protocol_number: entry.protocol_number ?? '',
        protocol_date:  entry.protocol_date ?? '',
        protocol_status: entry.protocol_status ?? '',
        notes:          entry.notes ?? '',
      });
      setPresentationDates(entry.presentation_dates ?? []);
      setVksDates(entry.vks_dates ?? []);
      void loadSessions(entry.id);
      void loadRounds(entry.id);
    }
  }, [entry]);

  const loadSessions = async (entryId: number) => {
    const { data } = await supabase.from('nts_sessions').select('*').eq('nts_entry_id', entryId).order('session_date');
    setSessions((data as NtsSession[]) ?? []);
  };

  const loadRounds = async (entryId: number) => {
    const { data } = await supabase.from('nts_doc_rounds').select('*').eq('nts_entry_id', entryId).order('received_date');
    setRounds((data as NtsDocRound[]) ?? []);
  };

  const handleObjectSelect = (uin: string) => {
    const addr = addresses.find(a => a.uin === uin);
    setForm(f => ({ ...f, object_uin: uin, object_name: addr?.name ?? '' }));
  };

  const excess = () => {
    const contract = parseFloat(form.contract_cost) || 0;
    const preNts   = parseFloat(form.pre_nts_cost) || 0;
    if (!contract) return null;
    const diff = preNts - contract;
    const pct  = (diff / contract) * 100;
    return { diff, pct };
  };

  const handleSave = async () => {
    if (!form.object_uin || !form.contractor || !form.contract_cost || !form.pre_nts_cost) {
      alert('Заполните обязательные поля: объект, подрядчик, контрактная стоимость, стоимость до НТС.');
      return;
    }
    setSaving(true);
    const payload = {
      object_uin:     form.object_uin,
      object_name:    form.object_name,
      contractor:     form.contractor,
      contract_cost:  parseFloat(form.contract_cost),
      pre_nts_cost:   parseFloat(form.pre_nts_cost),
      post_nts_cost:  form.post_nts_cost ? parseFloat(form.post_nts_cost) : null,
      mogae_cost:     form.mogae_cost ? parseFloat(form.mogae_cost) : null,
      rp_main_id:     form.rp_main_id || null,
      rp2_id:         form.rp2_id || null,
      status:         form.status,
      protocol_number: form.protocol_number || null,
      protocol_date:  form.protocol_date || null,
      protocol_status: form.protocol_status || null,
      notes:          form.notes || null,
      presentation_dates: presentationDates,
      vks_dates:      vksDates,
      updated_at:     new Date().toISOString(),
      ...(isEdit ? {} : { created_by: currentUserId }),
    };

    if (isEdit) {
      const { error } = await supabase.from('nts_entries').update(payload).eq('id', entry!.id);
      if (error) { alert('Ошибка сохранения: ' + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('nts_entries').insert([payload]);
      if (error) { alert('Ошибка создания: ' + error.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!entry || !window.confirm('Удалить эту запись НТС? Все заседания и чек-листы будут удалены.')) return;
    await supabase.from('nts_entries').delete().eq('id', entry.id);
    onSaved();
  };

  const addSession = async () => {
    if (!entry || !newSessionDate) return;
    setAddingSession(true);
    await supabase.from('nts_sessions').insert([{
      nts_entry_id: entry.id,
      session_date: newSessionDate,
      remarks: newSessionRemarks || null,
      created_by: currentUserId,
    }]);
    setNewSessionDate('');
    setNewSessionRemarks('');
    await loadSessions(entry.id);
    setAddingSession(false);
  };

  const deleteSession = async (id: number) => {
    if (!window.confirm('Удалить заседание?')) return;
    await supabase.from('nts_sessions').delete().eq('id', id);
    if (entry) await loadSessions(entry.id);
  };

  const addRound = async () => {
    if (!entry || !newRoundDate) return;
    setAddingRound(true);
    const { data } = await supabase.from('nts_doc_rounds').insert([{
      nts_entry_id: entry.id,
      received_date: newRoundDate,
      created_by: currentUserId,
    }]).select().single();
    setNewRoundDate('');
    await loadRounds(entry.id);
    setAddingRound(false);
    if (data) {
      setChecklistRoundId(data.id);
      setChecklistOpen(true);
    }
  };

  const deleteRound = async (id: number) => {
    if (!window.confirm('Удалить раунд документации (с чек-листом)?')) return;
    await supabase.from('nts_doc_rounds').delete().eq('id', id);
    if (entry) await loadRounds(entry.id);
  };

  const uploadProtocolFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !entry) return;
    setUploading(true);
    const fileName = `nts/${entry.id}/protocol_${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('protocols').upload(fileName, file, { upsert: true });
    if (error) {
      alert('Ошибка загрузки файла: ' + error.message);
    } else {
      await supabase.from('nts_entries').update({ protocol_file_path: fileName }).eq('id', entry.id);
      setForm(f => ({ ...f }));
    }
    setUploading(false);
  };

  const getFileUrl = async (path: string) => {
    const { data } = supabase.storage.from('protocols').getPublicUrl(path);
    return data.publicUrl;
  };

  const exValue = excess();

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
          {/* Header */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {isEdit ? 'Редактировать НТС' : 'Создать запись НТС'}
                </h2>
                {isEdit && (
                  <p className="text-sm text-slate-500 mt-0.5">{entry.object_name}</p>
                )}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={22} />
              </button>
            </div>

            {/* Tabs */}
            <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl mt-4 w-fit">
              {([
                { id: 'main',      label: 'Основное' },
                { id: 'sessions',  label: `Заседания${sessions.length ? ` (${sessions.length})` : ''}` },
                { id: 'protocol',  label: 'Протокол' },
                { id: 'checklist', label: `Документация${rounds.length ? ` (${rounds.length})` : ''}` },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  disabled={!isEdit && t.id !== 'main'}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* ── MAIN TAB ───────────────────────────────────────────── */}
            {tab === 'main' && (
              <div className="space-y-5">
                {/* Object selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Объект ГП <span className="text-red-500">*</span>
                  </label>
                  {loadingData ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 size={14} className="animate-spin" /> Загрузка…</div>
                  ) : (
                    <select
                      value={form.object_uin}
                      onChange={e => handleObjectSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    >
                      <option value="">— Выберите объект —</option>
                      {addresses.map(a => (
                        <option key={a.uin} value={a.uin}>{a.name} ({a.uin})</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Contractor */}
                <Field label="Подрядчик" required>
                  <input
                    type="text"
                    value={form.contractor}
                    onChange={e => setForm(f => ({ ...f, contractor: e.target.value }))}
                    placeholder="ООО «Название»"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </Field>

                {/* Costs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Контрактная стоимость, тыс. руб." required>
                    <input
                      type="number"
                      value={form.contract_cost}
                      onChange={e => setForm(f => ({ ...f, contract_cost: e.target.value }))}
                      placeholder="1000000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </Field>
                  <Field label="Стоимость до НТС, тыс. руб." required>
                    <input
                      type="number"
                      value={form.pre_nts_cost}
                      onChange={e => setForm(f => ({ ...f, pre_nts_cost: e.target.value }))}
                      placeholder="1300000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </Field>
                </div>

                {/* Excess indicator */}
                {exValue && (
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                    exValue.pct > 30 ? 'bg-red-50 text-red-700' : exValue.pct > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'
                  }`}>
                    <span>Превышение:</span>
                    <span className="font-bold">{exValue.pct > 0 ? '+' : ''}{exValue.pct.toFixed(1)}%</span>
                    <span>({exValue.diff > 0 ? '+' : ''}{new Intl.NumberFormat('ru-RU').format(Math.round(exValue.diff))} тыс. руб.)</span>
                    {exValue.pct > 30 && <span className="ml-auto text-xs bg-red-100 px-2 py-0.5 rounded-full">Требует НТС</span>}
                  </div>
                )}

                {/* Optional fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Утверждённая стоимость МОГЭ, тыс. руб.">
                    <input
                      type="number"
                      value={form.mogae_cost}
                      onChange={e => setForm(f => ({ ...f, mogae_cost: e.target.value }))}
                      placeholder="не указана"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </Field>
                  <Field label="Стоимость после НТС, тыс. руб.">
                    <input
                      type="number"
                      value={form.post_nts_cost}
                      onChange={e => setForm(f => ({ ...f, post_nts_cost: e.target.value }))}
                      placeholder="не указана"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </Field>
                </div>

                {/* RPs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Главный РП">
                    <select
                      value={form.rp_main_id}
                      onChange={e => setForm(f => ({ ...f, rp_main_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    >
                      <option value="">— Не назначен —</option>
                      {managerProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="РП2">
                    <select
                      value={form.rp2_id}
                      onChange={e => setForm(f => ({ ...f, rp2_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    >
                      <option value="">— Не назначен —</option>
                      {managerProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Status */}
                <Field label="Статус НТС">
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as NtsStatus }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  >
                    {Object.entries(NTS_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </Field>

                {/* Presentation dates */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Даты предоставления презентаций</label>
                  <div className="space-y-1.5">
                    {presentationDates.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="date"
                          value={d}
                          onChange={e => {
                            const arr = [...presentationDates];
                            arr[i] = e.target.value;
                            setPresentationDates(arr);
                          }}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400"
                        />
                        <button onClick={() => setPresentationDates(arr => arr.filter((_, j) => j !== i))}
                          className="text-slate-400 hover:text-red-500 transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setPresentationDates(arr => [...arr, ''])}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      <Plus size={13} /> Добавить дату
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <Field label="Примечания">
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    placeholder="Свободный текст…"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                  />
                </Field>
              </div>
            )}

            {/* ── SESSIONS TAB ───────────────────────────────────────── */}
            {tab === 'sessions' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">История заседаний ВКС и замечаний по объекту.</p>
                {sessions.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Calendar size={28} className="mx-auto mb-2 opacity-30" />
                    <p>Заседаний пока нет</p>
                  </div>
                )}
                <div className="space-y-3">
                  {sessions.map(s => (
                    <div key={s.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-800 flex items-center gap-2">
                          <Calendar size={14} className="text-violet-500" />
                          {new Date(s.session_date).toLocaleDateString('ru-RU')}
                        </span>
                        <button onClick={() => deleteSession(s.id)} className="text-slate-400 hover:text-red-500 transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {s.remarks && <p className="text-sm text-slate-600 mt-1">{s.remarks}</p>}
                    </div>
                  ))}
                </div>

                {/* Add session form */}
                <div className="border border-dashed border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">Добавить заседание</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Дата ВКС</label>
                      <input
                        type="date"
                        value={newSessionDate}
                        onChange={e => setNewSessionDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Замечания</label>
                    <textarea
                      value={newSessionRemarks}
                      onChange={e => setNewSessionRemarks(e.target.value)}
                      rows={2}
                      placeholder="Текст замечаний…"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 resize-none"
                    />
                  </div>
                  <button
                    onClick={addSession}
                    disabled={!newSessionDate || addingSession}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {addingSession ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Добавить заседание
                  </button>
                </div>
              </div>
            )}

            {/* ── PROTOCOL TAB ───────────────────────────────────────── */}
            {tab === 'protocol' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Номер протокола">
                    <input
                      type="text"
                      value={form.protocol_number}
                      onChange={e => setForm(f => ({ ...f, protocol_number: e.target.value }))}
                      placeholder="№ 123/2025"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </Field>
                  <Field label="Дата подписания">
                    <input
                      type="date"
                      value={form.protocol_date}
                      onChange={e => setForm(f => ({ ...f, protocol_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </Field>
                </div>

                <Field label="Статус протокола">
                  <select
                    value={form.protocol_status}
                    onChange={e => setForm(f => ({ ...f, protocol_status: e.target.value as NtsProtocolStatus | '' }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  >
                    <option value="">— Не указан —</option>
                    {Object.entries(NTS_PROTOCOL_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </Field>

                {/* File upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Файл протокола (PDF / Word)</label>
                  {entry?.protocol_file_path ? (
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <Paperclip size={16} className="text-emerald-600" />
                      <span className="text-sm text-emerald-700 truncate flex-1">{entry.protocol_file_path.split('/').pop()}</span>
                      <button
                        onClick={async () => {
                          const url = await getFileUrl(entry.protocol_file_path!);
                          window.open(url, '_blank');
                        }}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        <ExternalLink size={12} /> Открыть
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 mb-2">Файл не прикреплён</p>
                  )}
                  <label className={`flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-pointer hover:bg-slate-100 transition w-fit mt-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? 'Загрузка…' : 'Прикрепить файл'}
                    <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={uploadProtocolFile} />
                  </label>
                </div>

                {/* VKS dates */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Даты проведения ВКС</label>
                  <div className="space-y-1.5">
                    {vksDates.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="date"
                          value={d}
                          onChange={e => {
                            const arr = [...vksDates];
                            arr[i] = e.target.value;
                            setVksDates(arr);
                          }}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400"
                        />
                        <button onClick={() => setVksDates(arr => arr.filter((_, j) => j !== i))}
                          className="text-slate-400 hover:text-red-500 transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setVksDates(arr => [...arr, ''])}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      <Plus size={13} /> Добавить дату ВКС
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── CHECKLIST / DOC ROUNDS TAB ─────────────────────────── */}
            {tab === 'checklist' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">Каждый раунд — отдельный пакет документов с чек-листом из 61 пункта.</p>

                {rounds.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <ClipboardList size={28} className="mx-auto mb-2 opacity-30" />
                    <p>Документация ещё не поступала</p>
                  </div>
                )}

                <div className="space-y-3">
                  {rounds.map((r, idx) => (
                    <div key={r.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-800">
                          Раунд {idx + 1}: документы получены {new Date(r.received_date).toLocaleDateString('ru-RU')}
                        </div>
                        {r.notes && <div className="text-xs text-slate-500 mt-0.5">{r.notes}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setChecklistRoundId(r.id); setChecklistOpen(true); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition"
                        >
                          <ClipboardList size={13} /> Чек-лист
                        </button>
                        <button onClick={() => deleteRound(r.id)} className="text-slate-400 hover:text-red-500 transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add round */}
                <div className="border border-dashed border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">Зафиксировать получение документов</p>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Дата получения</label>
                    <input
                      type="date"
                      value={newRoundDate}
                      onChange={e => setNewRoundDate(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400"
                    />
                  </div>
                  <button
                    onClick={addRound}
                    disabled={!newRoundDate || addingRound}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {addingRound ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Принять документы и открыть чек-лист
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isEdit && isAdmin && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition"
                >
                  <Trash2 size={15} /> Удалить
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition">
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm shadow-indigo-600/20"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isEdit ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist modal */}
      {checklistOpen && checklistRoundId && (
        <NtsChecklistModal
          roundId={checklistRoundId}
          entryRpMainId={form.rp_main_id || null}
          entryRp2Id={form.rp2_id || null}
          profiles={profiles}
          currentUserId={currentUserId}
          onClose={() => setChecklistOpen(false)}
        />
      )}
    </>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
