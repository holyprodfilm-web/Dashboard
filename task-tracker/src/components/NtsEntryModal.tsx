import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X, Save, Loader2, Plus, Trash2, Calendar, ClipboardList,
  Upload, Paperclip, ExternalLink, ChevronRight, CheckCircle2,
  AlertTriangle, Lock, Search, Clock, Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  NtsEntry, NtsDocRound, Profile, NtsStatus, NtsProtocolStatus,
} from '../types';
import { NTS_PROTOCOL_STATUS_CONFIG } from '../types';
import NtsChecklistModal from './NtsChecklistModal';

interface Props {
  entry: NtsEntry | null;
  profiles: Profile[];
  currentUserId?: string;
  isAdmin?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type TabKey = 'main' | 'checklist' | 'protocol';

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
  protocol_number: '',
  protocol_date: '',
  protocol_status: '' as NtsProtocolStatus | '',
  notes: '',
};

type AddrItem = { uin: string; name: string; district: string };

/** Compute NTS status automatically from round state */
function computeStatus(
  rounds: NtsDocRound[],
  contractCost: number,
  preNtsCost: number,
): NtsStatus {
  if (rounds.length === 0) return 'rp_review';
  const sorted = [...rounds].sort(
    (a, b) => new Date(a.received_date).getTime() - new Date(b.received_date).getTime(),
  );
  const latest = sorted[sorted.length - 1];

  if (latest.checklist_approved) {
    const excess = contractCost > 0 ? (preNtsCost - contractCost) / contractCost : 0;
    return excess <= 0.3 ? 'below_30' : 'positive_mogae';
  }
  if (latest.remarks_issued_at) return 'remarks_fix';
  if (latest.presentation_date) return 'vks_scheduled';
  return 'rp_review';
}

export default function NtsEntryModal({ entry, profiles, currentUserId, isAdmin, onClose, onSaved }: Props) {
  const [savedEntry, setSavedEntry] = useState<NtsEntry | null>(entry);
  const isEdit = !!savedEntry;

  const [tab, setTab] = useState<TabKey>('main');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [vksDates, setVksDates] = useState<string[]>([]);
  const [rounds, setRounds] = useState<NtsDocRound[]>([]);
  const [saving, setSaving] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistRoundId, setChecklistRoundId] = useState<number | null>(null);
  // Track which round IDs had remarks carried over from the previous round
  const [roundsWithCarryover, setRoundsWithCarryover] = useState<Set<number>>(new Set());

  // Doc round form
  const [newRoundDate, setNewRoundDate] = useState('');
  const [addingRound, setAddingRound] = useState(false);

  // Protocol file upload
  const [uploading, setUploading] = useState(false);

  // Addresses for object search combobox
  const [addresses, setAddresses] = useState<AddrItem[]>([]);
  const [objQuery, setObjQuery] = useState('');
  const [objDropdownOpen, setObjDropdownOpen] = useState(false);
  const objRef = useRef<HTMLDivElement>(null);

  const managerProfiles = profiles.filter(p =>
    ['manager', 'admin'].includes(p.role) || (p.responsible_modules?.includes('nts') ?? false)
  );

  // Derived: sorted rounds oldest → newest
  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => new Date(a.received_date).getTime() - new Date(b.received_date).getTime()),
    [rounds],
  );

  // Protocol tab unlocks only when the last round's checklist is approved
  const lastRoundApproved = sortedRounds.length > 0 && sortedRounds[sortedRounds.length - 1].checklist_approved;

  const tabConfig: Array<{ id: TabKey; label: () => string; locked: boolean; lockReason?: string }> = [
    { id: 'main',      label: () => 'Основное',                                     locked: false },
    { id: 'checklist', label: () => `Документация${rounds.length ? ` (${rounds.length})` : ''}`,
                       locked: !isEdit, lockReason: 'Сначала сохраните основные данные' },
    { id: 'protocol',  label: () => 'Протокол',
                       locked: !isEdit || !lastRoundApproved,
                       lockReason: 'Доступно после полного одобрения чек-листа последнего раунда' },
  ];

  // Load addresses
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('addresses')
        .select('"Код УИН","Наименование объекта","Городской округ"')
        .order('"Наименование объекта"');
      if (data) {
        setAddresses(data.map((a: Record<string, string>) => ({
          uin:      a['Код УИН'],
          name:     a['Наименование объекта'],
          district: a['Городской округ'] ?? '',
        })));
      }
    })();
  }, []);

  // Populate form when editing existing entry
  useEffect(() => {
    if (entry) {
      setSavedEntry(entry);
      setForm({
        object_uin:      entry.object_uin,
        object_name:     entry.object_name,
        contractor:      entry.contractor,
        contract_cost:   String(entry.contract_cost),
        pre_nts_cost:    String(entry.pre_nts_cost),
        post_nts_cost:   entry.post_nts_cost ? String(entry.post_nts_cost) : '',
        mogae_cost:      entry.mogae_cost ? String(entry.mogae_cost) : '',
        rp_main_id:      entry.rp_main_id ?? '',
        rp2_id:          entry.rp2_id ?? '',
        protocol_number: entry.protocol_number ?? '',
        protocol_date:   entry.protocol_date ?? '',
        protocol_status: entry.protocol_status ?? '',
        notes:           entry.notes ?? '',
      });
      setObjQuery(entry.object_name);
      setVksDates(entry.vks_dates ?? []);
      void loadRounds(entry.id);
    }
  }, [entry]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (objRef.current && !objRef.current.contains(e.target as Node)) {
        setObjDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadRounds = async (entryId: number) => {
    const { data } = await supabase
      .from('nts_doc_rounds')
      .select('*')
      .eq('nts_entry_id', entryId)
      .order('received_date');
    setRounds((data as NtsDocRound[]) ?? []);
  };

  // Save computed status to DB
  const saveAutoStatus = useCallback(async (updatedRounds: NtsDocRound[], entryId: number) => {
    const contract = parseFloat(form.contract_cost) || 0;
    const preNts   = parseFloat(form.pre_nts_cost) || 0;
    const status = computeStatus(updatedRounds, contract, preNts);
    await supabase.from('nts_entries').update({ status }).eq('id', entryId);
  }, [form.contract_cost, form.pre_nts_cost]);

  // Object combobox: filtered list
  const filteredAddrs = useMemo(() => {
    if (!objQuery.trim()) return addresses.slice(0, 60);
    const q = objQuery.toLowerCase();
    return addresses.filter(a =>
      a.name.toLowerCase().includes(q) || a.district.toLowerCase().includes(q) || a.uin.includes(q)
    ).slice(0, 60);
  }, [addresses, objQuery]);

  const handleObjectSelect = async (addr: AddrItem) => {
    const autoRp = managerProfiles.find(p =>
      Array.isArray(p.districts) && p.districts.includes(addr.district)
    );

    // Auto-fetch contractor from closure_objects
    const { data: closureData } = await supabase
      .from('closure_objects')
      .select('contractor')
      .eq('uin', addr.uin)
      .maybeSingle();

    setForm(f => ({
      ...f,
      object_uin:  addr.uin,
      object_name: addr.name,
      rp_main_id:  autoRp ? autoRp.id : f.rp_main_id,
      contractor:  closureData?.contractor ? closureData.contractor : f.contractor,
    }));
    setObjQuery(addr.name);
    setObjDropdownOpen(false);
  };

  const excess = () => {
    const contract = parseFloat(form.contract_cost) || 0;
    const preNts   = parseFloat(form.pre_nts_cost) || 0;
    if (!contract) return null;
    return { diff: preNts - contract, pct: ((preNts - contract) / contract) * 100 };
  };

  const buildPayload = (overrideStatus?: NtsStatus) => ({
    object_uin:      form.object_uin,
    object_name:     form.object_name,
    contractor:      form.contractor,
    contract_cost:   parseFloat(form.contract_cost),
    pre_nts_cost:    parseFloat(form.pre_nts_cost),
    post_nts_cost:   form.post_nts_cost ? parseFloat(form.post_nts_cost) : null,
    mogae_cost:      form.mogae_cost ? parseFloat(form.mogae_cost) : null,
    rp_main_id:      form.rp_main_id || null,
    rp2_id:          form.rp2_id || null,
    status:          overrideStatus ?? computeStatus(rounds, parseFloat(form.contract_cost) || 0, parseFloat(form.pre_nts_cost) || 0),
    protocol_number: form.protocol_number || null,
    protocol_date:   form.protocol_date || null,
    protocol_status: form.protocol_status || null,
    notes:           form.notes || null,
    vks_dates:       vksDates,
    updated_at:      new Date().toISOString(),
  });

  const validateMain = () => {
    if (!form.object_uin) { alert('Выберите объект ГП.'); return false; }
    if (!form.contractor)  { alert('Укажите подрядчика.'); return false; }
    if (!form.contract_cost || !form.pre_nts_cost) { alert('Укажите контрактную стоимость и стоимость до НТС.'); return false; }
    return true;
  };

  const handleSaveMain = async (goToChecklist = false) => {
    if (!validateMain()) return;
    setSaving(true);
    if (isEdit) {
      const { error } = await supabase.from('nts_entries').update(buildPayload()).eq('id', savedEntry!.id);
      if (error) { alert('Ошибка сохранения: ' + error.message); setSaving(false); return; }
      if (goToChecklist) setTab('checklist');
    } else {
      const { data, error } = await supabase.from('nts_entries')
        .insert([{ ...buildPayload('rp_review'), created_by: currentUserId }])
        .select().single();
      if (error || !data) { alert('Ошибка создания: ' + (error?.message ?? '')); setSaving(false); return; }
      setSavedEntry(data as NtsEntry);
      if (goToChecklist) setTab('checklist');
      else onSaved();
    }
    setSaving(false);
  };

  const handleSave = async () => {
    if (!validateMain()) return;
    setSaving(true);
    const { error } = await supabase.from('nts_entries').update(buildPayload()).eq('id', savedEntry!.id);
    if (error) { alert('Ошибка сохранения: ' + error.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!savedEntry || !window.confirm('Удалить эту запись НТС? Все раунды и чек-листы будут удалены.')) return;
    await supabase.from('nts_entries').delete().eq('id', savedEntry.id);
    onSaved();
  };

  const addRound = async () => {
    if (!savedEntry || !newRoundDate) return;
    setAddingRound(true);

    const { data: newRound } = await supabase
      .from('nts_doc_rounds')
      .insert([{ nts_entry_id: savedEntry.id, received_date: newRoundDate, created_by: currentUserId }])
      .select()
      .single();

    setNewRoundDate('');

    // Copy fail/clarify responses from previous round to the new one
    if (newRound && sortedRounds.length > 0) {
      const prevRound = sortedRounds[sortedRounds.length - 1];
      const { data: prevResponses } = await supabase
        .from('nts_checklist_responses')
        .select('item_id, respondent_role, status, comment')
        .eq('round_id', prevRound.id)
        .in('status', ['fail', 'clarify']);

      if (prevResponses && prevResponses.length > 0) {
        const roundNum = sortedRounds.length;
        await supabase.from('nts_checklist_responses').insert(
          prevResponses.map(r => ({
            round_id:        newRound.id,
            item_id:         r.item_id,
            respondent_role: r.respondent_role,
            status:          r.status,
            comment:         r.comment
              ? `[Раунд ${roundNum}] ${r.comment}`
              : `[Перенесено из Раунда ${roundNum}]`,
            updated_at:      new Date().toISOString(),
            updated_by:      currentUserId ?? null,
          }))
        );
        // Mark this new round as having carried-over remarks
        setRoundsWithCarryover(prev => new Set(prev).add(newRound.id));
      }
    }

    const { data: freshRounds } = await supabase
      .from('nts_doc_rounds')
      .select('*')
      .eq('nts_entry_id', savedEntry.id);
    const updatedRounds = (freshRounds as NtsDocRound[]) ?? [];
    setRounds(updatedRounds);
    await saveAutoStatus(updatedRounds, savedEntry.id);
    setAddingRound(false);

    if (newRound) {
      setChecklistRoundId(newRound.id);
      setChecklistOpen(true);
    }
  };

  const deleteRound = async (id: number) => {
    if (!window.confirm('Удалить раунд документации (с чек-листом)?')) return;
    await supabase.from('nts_doc_rounds').delete().eq('id', id);
    if (savedEntry) {
      await loadRounds(savedEntry.id);
      const updatedRounds = rounds.filter(r => r.id !== id);
      await saveAutoStatus(updatedRounds, savedEntry.id);
    }
  };

  const updateRoundField = async (roundId: number, field: string, value: string | null) => {
    await supabase.from('nts_doc_rounds').update({ [field]: value || null }).eq('id', roundId);
    if (savedEntry) {
      await loadRounds(savedEntry.id);
      // Re-read fresh rounds for status computation
      const { data } = await supabase.from('nts_doc_rounds').select('*').eq('nts_entry_id', savedEntry.id);
      if (data) await saveAutoStatus(data as NtsDocRound[], savedEntry.id);
    }
  };

  const uploadProtocolFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !savedEntry) return;
    setUploading(true);
    const fileName = `nts/${savedEntry.id}/protocol_${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('protocols').upload(fileName, file, { upsert: true });
    if (error) alert('Ошибка загрузки файла: ' + error.message);
    else await supabase.from('nts_entries').update({ protocol_file_path: fileName }).eq('id', savedEntry.id);
    setUploading(false);
  };

  const getFileUrl = (path: string) => supabase.storage.from('protocols').getPublicUrl(path).data.publicUrl;

  const exValue = excess();

  const daysDiff = (from: string, to: string | null) => {
    if (!to) return null;
    return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
  };

  const reviewDeadlineBadge = (receivedDate: string, issuedAt: string | null) => {
    const deadline = new Date(receivedDate);
    deadline.setDate(deadline.getDate() + 3);
    const now = issuedAt ? new Date(issuedAt) : new Date();
    const diff = Math.round((now.getTime() - deadline.getTime()) / 86400000);
    if (issuedAt) {
      return diff <= 0
        ? <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">✓ В срок</span>
        : <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Просрочено на {diff} дн.</span>;
    }
    const daysLeft = Math.round((deadline.getTime() - new Date().getTime()) / 86400000);
    if (daysLeft < 0)
      return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-1"><AlertTriangle size={11}/>Просрочено {Math.abs(daysLeft)} дн.</span>;
    return <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium flex items-center gap-1"><Clock size={11}/>Осталось {daysLeft} дн.</span>;
  };

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
                {isEdit && <p className="text-sm text-slate-500 mt-0.5">{savedEntry!.object_name}</p>}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={22} /></button>
            </div>

            {/* Wizard tabs */}
            <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl mt-4 w-fit">
              {tabConfig.map((t, idx) => (
                <button
                  key={t.id}
                  title={t.locked ? t.lockReason : undefined}
                  onClick={() => !t.locked && setTab(t.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : t.locked ? 'text-slate-400 cursor-not-allowed' : 'text-slate-600 hover:text-slate-900'}
                  `}
                >
                  {idx > 0 && <ChevronRight size={12} className="text-slate-300" />}
                  {t.locked && <Lock size={11} className="opacity-60" />}
                  {t.label()}
                  {t.id === 'checklist' && lastRoundApproved && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Body */}
          <div className="p-6">

            {/* ── MAIN TAB ─────────────────────────────────────────────── */}
            {tab === 'main' && (
              <div className="space-y-5">
                {/* Object combobox */}
                <div ref={objRef} className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Объект ГП <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={objQuery}
                      onChange={e => { setObjQuery(e.target.value); setObjDropdownOpen(true); setForm(f => ({ ...f, object_uin: '', object_name: '' })); }}
                      onFocus={() => setObjDropdownOpen(true)}
                      placeholder="Поиск по названию или округу…"
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  {form.object_uin && (
                    <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={12}/> {form.object_uin}
                    </p>
                  )}
                  {objDropdownOpen && filteredAddrs.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {filteredAddrs.map(a => (
                        <button
                          key={a.uin}
                          onMouseDown={() => void handleObjectSelect(a)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 border-b border-slate-50 last:border-0"
                        >
                          <span className="font-medium text-slate-800">{a.name}</span>
                          <span className="ml-2 text-xs text-slate-400">{a.district}</span>
                        </button>
                      ))}
                    </div>
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
                  {form.object_uin && form.contractor && (
                    <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1">
                      <Info size={11}/> Подставлен автоматически из базы объектов
                    </p>
                  )}
                </Field>

                {/* Costs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Контрактная стоимость, тыс. руб." required>
                    <input type="number" value={form.contract_cost}
                      onChange={e => setForm(f => ({ ...f, contract_cost: e.target.value }))}
                      placeholder="1000000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                  </Field>
                  <Field label="Стоимость до НТС, тыс. руб." required>
                    <input type="number" value={form.pre_nts_cost}
                      onChange={e => setForm(f => ({ ...f, pre_nts_cost: e.target.value }))}
                      placeholder="1300000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
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

                {/* Optional costs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Утверждённая стоимость МОГЭ, тыс. руб.">
                    <input type="number" value={form.mogae_cost}
                      onChange={e => setForm(f => ({ ...f, mogae_cost: e.target.value }))}
                      placeholder="не указана"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                  </Field>
                  <Field label="Стоимость после НТС, тыс. руб.">
                    <input type="number" value={form.post_nts_cost}
                      onChange={e => setForm(f => ({ ...f, post_nts_cost: e.target.value }))}
                      placeholder="не указана"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                  </Field>
                </div>

                {/* RPs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Главный РП">
                    <select value={form.rp_main_id}
                      onChange={e => setForm(f => ({ ...f, rp_main_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                      <option value="">— Не назначен —</option>
                      {managerProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                    {form.rp_main_id && form.object_uin && (
                      <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1"><CheckCircle2 size={11}/>Подобран автоматически по округу</p>
                    )}
                  </Field>
                  <Field label="РП2">
                    <select value={form.rp2_id}
                      onChange={e => setForm(f => ({ ...f, rp2_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                      <option value="">— Не назначен —</option>
                      {managerProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </Field>
                </div>

                {/* Notes */}
                <Field label="Примечания">
                  <textarea value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3} placeholder="Свободный текст…"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none" />
                </Field>
              </div>
            )}

            {/* ── CHECKLIST / DOKUMENTATSIYA TAB ───────────────────────── */}
            {tab === 'checklist' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  У РП есть <strong>3 рабочих дня</strong> с момента получения документации: провести заседание и внести замечания в чек-лист.
                  При получении следующего раунда неустранённые замечания переносятся автоматически.
                </p>

                {rounds.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <ClipboardList size={28} className="mx-auto mb-2 opacity-30" />
                    <p>Документация ещё не поступала</p>
                  </div>
                )}

                <div className="space-y-4">
                  {sortedRounds.map((r, idx) => {
                    const contractorDays = daysDiff(r.received_date, r.remarks_resolved_contractor_at);

                    return (
                      <div key={r.id} className={`border rounded-xl overflow-hidden ${r.checklist_approved ? 'border-emerald-200' : 'border-slate-200'}`}>
                        {/* Round header */}
                        <div className={`px-4 py-3 flex items-center justify-between flex-wrap gap-2 ${r.checklist_approved ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                          <div className="flex items-center gap-2">
                            {r.checklist_approved
                              ? <CheckCircle2 size={16} className="text-emerald-500" />
                              : <ClipboardList size={16} className="text-slate-400" />}
                            <span className="font-medium text-slate-800">Раунд {idx + 1}</span>
                            <span className="text-sm text-slate-500">— получен {new Date(r.received_date).toLocaleDateString('ru-RU')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {r.checklist_approved
                              ? <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">✓ Чек-лист пройден</span>
                              : reviewDeadlineBadge(r.received_date, r.remarks_issued_at)
                            }
                            <button
                              onClick={() => { setChecklistRoundId(r.id); setChecklistOpen(true); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition"
                            >
                              <ClipboardList size={13} /> Чек-лист
                            </button>
                            <button onClick={() => void deleteRound(r.id)} className="text-slate-400 hover:text-red-500 transition">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Round fields */}
                        <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Meeting date — prominent */}
                          <div className="md:col-span-2">
                            <RoundDateField
                              label="📅 Дата заседания НТС (ВКС)"
                              value={r.presentation_date ?? ''}
                              onChange={v => void updateRoundField(r.id, 'presentation_date', v)}
                            />
                          </div>
                          <RoundDateField
                            label="Дата выдачи замечаний РП"
                            value={r.remarks_issued_at ?? ''}
                            onChange={v => void updateRoundField(r.id, 'remarks_issued_at', v)}
                          />
                          <RoundDateField
                            label="Замечания устранены (подрядчик)"
                            value={r.remarks_resolved_contractor_at ?? ''}
                            onChange={v => void updateRoundField(r.id, 'remarks_resolved_contractor_at', v)}
                            hint={contractorDays !== null ? `${contractorDays} дн. с выдачи замечаний` : undefined}
                          />
                        </div>

                        {/* Show carried-over remark indicator only when remarks were actually copied */}
                        {roundsWithCarryover.has(r.id) && !r.checklist_approved && (
                          <div className="px-4 pb-3">
                            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              <AlertTriangle size={12} className="shrink-0" />
                              Неустранённые замечания из Раунда {idx} перенесены в этот чек-лист автоматически
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add round */}
                <div className="border border-dashed border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">Зафиксировать получение документов</p>
                  <div className="flex items-end gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Дата получения</label>
                      <input type="date" value={newRoundDate}
                        onChange={e => setNewRoundDate(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400" />
                    </div>
                    <button onClick={() => void addRound()} disabled={!newRoundDate || addingRound}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                      {addingRound ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Принять документы
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── PROTOCOL TAB ─────────────────────────────────────────── */}
            {tab === 'protocol' && (
              <div className="space-y-5">
                <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>Чек-лист последнего раунда полностью одобрен — можно оформлять протокол.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Номер протокола">
                    <input type="text" value={form.protocol_number}
                      onChange={e => setForm(f => ({ ...f, protocol_number: e.target.value }))}
                      placeholder="№ 123/2025"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                  </Field>
                  <Field label="Дата подписания">
                    <input type="date" value={form.protocol_date}
                      onChange={e => setForm(f => ({ ...f, protocol_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                  </Field>
                </div>

                <Field label="Статус протокола">
                  <select value={form.protocol_status}
                    onChange={e => setForm(f => ({ ...f, protocol_status: e.target.value as NtsProtocolStatus | '' }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                    <option value="">— Не указан —</option>
                    {Object.entries(NTS_PROTOCOL_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </Field>

                {/* File upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Файл протокола (PDF / Word)</label>
                  {savedEntry?.protocol_file_path ? (
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 mb-2">
                      <Paperclip size={16} className="text-emerald-600" />
                      <span className="text-sm text-emerald-700 truncate flex-1">{savedEntry.protocol_file_path.split('/').pop()}</span>
                      <button
                        onClick={() => window.open(getFileUrl(savedEntry.protocol_file_path!), '_blank')}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                        <ExternalLink size={12} /> Открыть
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 mb-2">Файл не прикреплён</p>
                  )}
                  <label className={`flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-pointer hover:bg-slate-100 transition w-fit ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
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
                        <input type="date" value={d}
                          onChange={e => { const a = [...vksDates]; a[i] = e.target.value; setVksDates(a); }}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400" />
                        <button onClick={() => setVksDates(a => a.filter((_, j) => j !== i))}
                          className="text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => setVksDates(a => [...a, ''])}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                      <Plus size={13} /> <Calendar size={12}/> Добавить дату ВКС
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 flex items-center justify-between">
            <div>
              {isEdit && isAdmin && (
                <button onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition">
                  <Trash2 size={15} /> Удалить
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition">
                {isEdit ? 'Закрыть' : 'Отмена'}
              </button>

              {tab === 'main' && !isEdit && (
                <button onClick={() => void handleSaveMain(true)} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm shadow-indigo-600/20">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                  Далее
                </button>
              )}

              {tab === 'main' && isEdit && (
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm shadow-indigo-600/20">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Сохранить
                </button>
              )}

              {tab === 'protocol' && isEdit && (
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm shadow-indigo-600/20">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Сохранить протокол
                </button>
              )}
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
          onApprovalChange={async (approved) => {
            await supabase.from('nts_doc_rounds').update({ checklist_approved: approved }).eq('id', checklistRoundId);
            if (savedEntry) {
              await loadRounds(savedEntry.id);
              const { data } = await supabase.from('nts_doc_rounds').select('*').eq('nts_entry_id', savedEntry.id);
              if (data) await saveAutoStatus(data as NtsDocRound[], savedEntry.id);
            }
          }}
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

function RoundDateField({
  label, value, onChange, hint,
}: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const [localVal, setLocalVal] = useState(value);
  useEffect(() => setLocalVal(value), [value]);
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type="date"
        value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={() => { if (localVal !== value) onChange(localVal); }}
        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400"
      />
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}
