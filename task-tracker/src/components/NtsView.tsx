import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FlaskConical, Plus, RefreshCw, Loader2, ChevronRight, FileText, CheckCircle2,
  Clock, AlertTriangle, TrendingUp, Users, Banknote, BarChart3, Search, Filter, Download,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { NtsEntry, NtsDocRound, Profile } from '../types';
import { NTS_STATUS_CONFIG, NTS_PROTOCOL_STATUS_CONFIG } from '../types';
import NtsEntryModal from './NtsEntryModal';
import Toast from './Toast';
import { exportNtsToExcel } from '../lib/ntsExport';

interface NtsViewProps {
  profiles: Profile[];
  currentUserId?: string;
  currentUserRole?: string;
  isModuleAdmin?: boolean;
}

type TabType = 'dashboard' | 'list';

type AddrItem = { uin: string; district: string };

export default function NtsView({ profiles, currentUserId, currentUserRole, isModuleAdmin }: NtsViewProps) {
  const [entries, setEntries] = useState<NtsEntry[]>([]);
  const [rounds, setRounds] = useState<NtsDocRound[]>([]);
  const [addresses, setAddresses] = useState<AddrItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<NtsEntry | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusChangeToast, setStatusChangeToast] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  // entry_id → names of OTHER users currently editing that entry
  const [editingPresence, setEditingPresence] = useState<Map<number, string[]>>(new Map());
  // Keep a ref to the current entries so the realtime closure can compare old vs new status
  const entriesRef = useRef<NtsEntry[]>([]);

  const isAdmin = currentUserRole === 'admin' || (isModuleAdmin ?? false);

  const handleExport = async (entriesToExport: NtsEntry[]) => {
    if (exportLoading) return;
    setExportLoading(true);
    try {
      const entryIds = new Set(entriesToExport.map(e => e.id));
      const filteredRounds = rounds.filter(r => entryIds.has(r.nts_entry_id));
      await exportNtsToExcel(entriesToExport, filteredRounds, profiles);
    } finally {
      setExportLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [entRes, rndRes, addrRes] = await Promise.all([
      supabase.from('nts_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('nts_doc_rounds').select('*').order('received_date', { ascending: false }),
      supabase.from('addresses').select('"Код УИН","Городской округ"'),
    ]);
    if (entRes.data) setEntries(entRes.data as NtsEntry[]);
    if (rndRes.data) setRounds(rndRes.data as NtsDocRound[]);
    if (addrRes.data) setAddresses(addrRes.data.map((a: Record<string, string>) => ({
      uin: a['Код УИН'],
      district: a['Городской округ'] ?? '—',
    })));
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Keep entriesRef in sync so the realtime closure can compare statuses without stale state
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  // Real-time subscription: keep NTS tables in sync when other users make changes
  useEffect(() => {
    const channel = supabase
      .channel('nts-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nts_entries' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as NtsEntry & { updated_by?: string | null };
            // Notify if another user changed the status or protocol_status
            const existing = entriesRef.current.find(e => e.id === updated.id);
            const changedByOther = !updated.updated_by || updated.updated_by !== currentUserId;
            if (existing && changedByOther) {
              const statusChanged = existing.status !== updated.status;
              const protoChanged  = existing.protocol_status !== updated.protocol_status;
              if (statusChanged || protoChanged) {
                const label = updated.object_name || `Объект #${updated.id}`;
                const newStatusLabel = NTS_STATUS_CONFIG[updated.status]?.label ?? updated.status;
                const parts = [`«${label}»`];
                if (statusChanged) parts.push(`статус: ${newStatusLabel}`);
                if (protoChanged && updated.protocol_status) {
                  parts.push(`протокол: ${NTS_PROTOCOL_STATUS_CONFIG[updated.protocol_status]?.label ?? updated.protocol_status}`);
                }
                setStatusChangeToast(parts.join(' — '));
              }
            }
          }
          setEntries((prev) => {
            if (payload.eventType === 'INSERT') {
              return [payload.new as NtsEntry, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((e) =>
                e.id === (payload.new as NtsEntry).id ? (payload.new as NtsEntry) : e
              );
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((e) => e.id !== (payload.old as NtsEntry).id);
            }
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nts_doc_rounds' },
        (payload) => {
          setRounds((prev) => {
            if (payload.eventType === 'INSERT') {
              return [payload.new as NtsDocRound, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((r) =>
                r.id === (payload.new as NtsDocRound).id ? (payload.new as NtsDocRound) : r
              );
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((r) => r.id !== (payload.old as NtsDocRound).id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // ── Presence channel: track who is editing which entry ─────────────────
  useEffect(() => {
    type PresenceState = { user_id: string; entry_id: number; user_name: string };

    const rebuild = (state: Record<string, PresenceState[]>) => {
      const map = new Map<number, string[]>();
      Object.values(state).forEach(presences => {
        presences.forEach(p => {
          if (p.user_id === currentUserId) return; // skip self
          const list = map.get(p.entry_id) ?? [];
          if (!list.includes(p.user_name)) list.push(p.user_name);
          map.set(p.entry_id, list);
        });
      });
      setEditingPresence(new Map(map));
    };

    const presenceChannel = supabase
      .channel('nts-presence')
      .on('presence', { event: 'sync' }, () => {
        rebuild(presenceChannel.presenceState() as Record<string, PresenceState[]>);
      })
      .on('presence', { event: 'join' }, () => {
        rebuild(presenceChannel.presenceState() as Record<string, PresenceState[]>);
      })
      .on('presence', { event: 'leave' }, () => {
        rebuild(presenceChannel.presenceState() as Record<string, PresenceState[]>);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(presenceChannel);
    };
  }, [currentUserId]);

  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const districtByUin = new Map(addresses.map(a => [a.uin, a.district]));

  const rpName = (id: string | null) => id ? (profileMap.get(id)?.full_name ?? '—') : '—';

  // ── Dashboard metrics ──────────────────────────────────────────────────────
  const total = entries.length;
  const above30 = entries.filter(e => e.contract_cost > 0 && (e.pre_nts_cost - e.contract_cost) / e.contract_cost > 0.3);
  const below30 = entries.filter(e => e.status === 'below_30');
  const positiveMogae = entries.filter(e => e.status === 'positive_mogae');
  const inWork = entries.filter(e => !['positive_mogae', 'below_30'].includes(e.status));

  const protoByStatus = {
    preparing:  entries.filter(e => e.protocol_status === 'preparing').length,
    msed:       entries.filter(e => e.protocol_status === 'msed').length,
    sent_omsu:  entries.filter(e => e.protocol_status === 'sent_omsu').length,
  };

  const totalContract = entries.reduce((s, e) => s + (e.contract_cost ?? 0), 0);
  const totalPreNts   = entries.reduce((s, e) => s + (e.pre_nts_cost ?? 0), 0);
  const totalPostNts  = entries.filter(e => e.post_nts_cost).reduce((s, e) => s + (e.post_nts_cost ?? 0), 0);

  const rpLoad: Record<string, number> = {};
  inWork.forEach(e => {
    if (e.rp_main_id) rpLoad[e.rp_main_id] = (rpLoad[e.rp_main_id] ?? 0) + 1;
    if (e.rp2_id)     rpLoad[e.rp2_id]     = (rpLoad[e.rp2_id]     ?? 0) + 1;
  });

  const statsByStatus = Object.entries(NTS_STATUS_CONFIG).map(([key, cfg]) => ({
    key, cfg, count: entries.filter(e => e.status === key).length,
  }));

  // ── Timeline analytics ─────────────────────────────────────────────────────
  const daysBetween = (a: string, b: string) =>
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

  // Rounds currently overdue (received > 3 days ago, no remarks issued yet, not approved)
  const overdueRounds = rounds.filter(r => {
    if (r.remarks_issued_at || r.checklist_approved) return false;
    const deadline = new Date(r.received_date);
    deadline.setDate(deadline.getDate() + 3);
    return new Date() > deadline;
  });

  // Overdue by RP: who is overdue and by how many days
  interface OverdueRow { rpId: string | null; rpLabel: string; objectName: string; daysOverdue: number }
  const overdueByRp: OverdueRow[] = overdueRounds
    .map(r => {
      const entry = entries.find(e => e.id === r.nts_entry_id);
      if (!entry) return null;
      const deadline = new Date(r.received_date);
      deadline.setDate(deadline.getDate() + 3);
      const daysOverdue = Math.round((new Date().getTime() - deadline.getTime()) / 86400000);
      return {
        rpId: entry.rp_main_id,
        rpLabel: rpName(entry.rp_main_id),
        objectName: entry.object_name,
        daysOverdue,
      };
    })
    .filter((x): x is OverdueRow => x !== null)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Remark resolution: rounds where contractor resolved remarks
  interface ResolutionRow { district: string; contractor: string; objectName: string; days: number }
  const resolutionRows: ResolutionRow[] = rounds
    .filter(r => r.remarks_issued_at && r.remarks_resolved_contractor_at)
    .map(r => {
      const entry = entries.find(e => e.id === r.nts_entry_id);
      if (!entry) return null;
      const days = daysBetween(r.remarks_issued_at!, r.remarks_resolved_contractor_at!);
      return {
        district: districtByUin.get(entry.object_uin) ?? '—',
        contractor: entry.contractor,
        objectName: entry.object_name,
        days,
      };
    })
    .filter((x): x is ResolutionRow => x !== null)
    .sort((a, b) => b.days - a.days);

  // ── List filters ───────────────────────────────────────────────────────────
  const filtered = entries.filter(e => {
    const matchSearch = !searchQuery ||
      e.object_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.contractor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const excessPct = (e: NtsEntry) => {
    if (!e.contract_cost) return 0;
    return ((e.pre_nts_cost - e.contract_cost) / e.contract_cost * 100);
  };

  const hasRound = (entryId: number) => rounds.some(r => r.nts_entry_id === entryId);
  const lastRoundApproved = (entryId: number) => {
    const entryRounds = rounds
      .filter(r => r.nts_entry_id === entryId)
      .sort((a, b) => new Date(a.received_date).getTime() - new Date(b.received_date).getTime());
    return entryRounds.length > 0 && entryRounds[entryRounds.length - 1].checklist_approved;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="animate-spin text-indigo-500" size={36} />
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1 flex items-center gap-3">
            <FlaskConical size={28} className="text-indigo-600" />
            Научно-технический совет
          </h2>
          <p className="text-slate-500">Сопровождение процедуры НТС по объектам ГП</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={loadData} title="Обновить" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium text-sm shadow-sm shadow-indigo-600/20"
          >
            <Plus size={16} /> Добавить НТС
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { id: 'dashboard', label: 'Дашборд', icon: <BarChart3 size={15} /> },
          { id: 'list',      label: `Список (${total})`, icon: <FileText size={15} /> },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              tab === t.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ──────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => void handleExport(entries)}
              disabled={exportLoading || entries.length === 0}
              title="Экспортировать все записи НТС в Excel"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Экспорт всего реестра
            </button>
          </div>
          {/* KPI row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={<FlaskConical size={20} className="text-indigo-500" />} label="Всего объектов НТС" value={total} bg="bg-indigo-50" />
            <KpiCard icon={<TrendingUp size={20} className="text-red-500" />} label="Превышение > 30%" value={above30.length} bg="bg-red-50" />
            <KpiCard icon={<CheckCircle2 size={20} className="text-teal-500" />} label="Превышение < 30%" value={below30.length} bg="bg-teal-50" />
            <KpiCard icon={<CheckCircle2 size={20} className="text-emerald-600" />} label="Положит. заключение МОГЭ" value={positiveMogae.length} bg="bg-emerald-50" />
          </div>

          {/* KPI row 2 — protocols */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard icon={<Clock size={20} className="text-amber-500" />} label="Протокол готовится" value={protoByStatus.preparing} bg="bg-amber-50" />
            <KpiCard icon={<AlertTriangle size={20} className="text-blue-500" />} label="На согласовании МСЭД" value={protoByStatus.msed} bg="bg-blue-50" />
            <KpiCard icon={<FileText size={20} className="text-emerald-500" />} label="Направлен в ОМСУ/РСО" value={protoByStatus.sent_omsu} bg="bg-emerald-50" />
          </div>

          {/* Status breakdown + RP Load */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-500" /> Распределение по статусам
              </h3>
              <div className="space-y-2">
                {statsByStatus.map(({ key, cfg, count }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color} w-52 text-center`}>
                      {cfg.label}
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-indigo-400 transition-all"
                        style={{ width: total ? `${(count / total) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Users size={16} className="text-indigo-500" /> Нагрузка по РП (активные объекты)
              </h3>
              {Object.keys(rpLoad).length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Нет активных объектов с назначенными РП</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(rpLoad)
                    .sort(([, a], [, b]) => b - a)
                    .map(([uid, cnt]) => (
                      <div key={uid} className="flex items-center gap-3">
                        <span className="text-sm text-slate-700 w-40 truncate">{rpName(uid)}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-blue-400"
                            style={{ width: inWork.length ? `${(cnt / inWork.length) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 w-6 text-right">{cnt}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Просрочено рассмотрение по РП ─────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Clock size={16} className="text-red-500" /> Просрочено рассмотрение документации — по РП
            </h3>
            {overdueByRp.length === 0 ? (
              <div className="flex items-center gap-3 py-4 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                Просроченных рассмотрений нет — все в срок
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                      <th className="px-4 py-2 text-left font-medium rounded-l-lg">РП</th>
                      <th className="px-4 py-2 text-left font-medium">Объект</th>
                      <th className="px-4 py-2 text-right font-medium rounded-r-lg">Просрочено, дн.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overdueByRp.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-700 font-medium">{row.rpLabel}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{row.objectName}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 font-bold text-red-600">
                            <AlertTriangle size={13} /> {row.daysOverdue}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Аналитика устранения замечаний ─────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" /> Устранение замечаний по объектам
            </h3>
            {resolutionRows.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Нет данных об устранении замечаний</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                      <th className="px-4 py-2 text-left font-medium rounded-l-lg">Округ</th>
                      <th className="px-4 py-2 text-left font-medium">Подрядчик</th>
                      <th className="px-4 py-2 text-left font-medium">Наименование объекта</th>
                      <th className="px-4 py-2 text-right font-medium rounded-r-lg">Дни устранения</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resolutionRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.district}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">{row.contractor}</td>
                        <td className="px-4 py-3 text-slate-700">{row.objectName}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${row.days > 14 ? 'text-red-600' : row.days > 7 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {row.days}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cost analytics */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Banknote size={16} className="text-indigo-500" /> Аналитика по стоимости (млн руб.)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <CostBlock label="Контрактная стоимость" value={totalContract} color="text-slate-700" />
              <CostBlock label="Стоимость до НТС" value={totalPreNts} color="text-red-600" />
              <CostBlock label="Стоимость после НТС" value={totalPostNts} color="text-emerald-600" note="(только закрытые)" />
            </div>
          </div>
        </div>
      )}

      {/* ── LIST TAB ───────────────────────────────────────────────────── */}
      {tab === 'list' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск по объекту или подрядчику…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-72"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              >
                <option value="all">Все статусы</option>
                {Object.entries(NTS_STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => void handleExport(filtered)}
                disabled={exportLoading || filtered.length === 0}
                title={
                  filtered.length === entries.length
                    ? 'Экспортировать все записи НТС'
                    : `Экспортировать ${filtered.length} из ${entries.length} записей (по фильтру)`
                }
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {filtered.length === entries.length
                  ? 'Экспорт'
                  : `Экспорт (${filtered.length})`}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Объект</th>
                    <th className="px-5 py-3 text-left font-medium">Подрядчик</th>
                    <th className="px-5 py-3 text-left font-medium">Статус НТС</th>
                    <th className="px-5 py-3 text-left font-medium">РП</th>
                    <th className="px-5 py-3 text-right font-medium">До НТС, тыс.</th>
                    <th className="px-5 py-3 text-right font-medium">Превышение</th>
                    <th className="px-5 py-3 text-center font-medium">Чек-лист</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                        <FlaskConical size={28} className="mx-auto mb-2 opacity-30" />
                        <p>{entries.length === 0 ? 'Нет записей НТС. Нажмите «Добавить НТС».' : 'Ничего не найдено.'}</p>
                      </td>
                    </tr>
                  )}
                  {filtered.map(e => {
                    const pct = excessPct(e);
                    const sCfg = NTS_STATUS_CONFIG[e.status];
                    const roundExists = hasRound(e.id);
                    const approved = lastRoundApproved(e.id);
                    const editors = editingPresence.get(e.id) ?? [];
                    return (
                      <tr key={e.id} className="hover:bg-indigo-50/30 cursor-pointer transition" onClick={() => setSelectedEntry(e)}>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900 leading-tight flex items-center gap-2">
                            {e.object_name}
                            {editors.length > 0 && (
                              <span
                                title={`Редактирует: ${editors.join(', ')}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 leading-none"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                {editors.length === 1 ? editors[0].split(' ')[0] : `${editors.length} чел.`}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{e.object_uin}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-600 max-w-[180px]">
                          <div className="truncate">{e.contractor}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sCfg.bg} ${sCfg.color}`}>
                            {sCfg.label}
                          </span>
                          {e.protocol_status && (
                            <div className="mt-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${NTS_PROTOCOL_STATUS_CONFIG[e.protocol_status].bg} ${NTS_PROTOCOL_STATUS_CONFIG[e.protocol_status].color}`}>
                                {NTS_PROTOCOL_STATUS_CONFIG[e.protocol_status].label}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600 text-xs">
                          <div>{rpName(e.rp_main_id)}</div>
                          {e.rp2_id && <div className="text-slate-400">{rpName(e.rp2_id)}</div>}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-slate-700">
                          {new Intl.NumberFormat('ru-RU').format(e.pre_nts_cost)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-semibold ${pct > 30 ? 'text-red-600' : pct > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                            {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                          <div className="text-xs text-slate-400 font-mono">
                            +{new Intl.NumberFormat('ru-RU').format(Math.round(e.pre_nts_cost - e.contract_cost))}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {!roundExists
                            ? <span className="text-slate-300 text-xs">—</span>
                            : approved
                              ? <CheckCircle2 size={16} className="text-emerald-500 inline" />
                              : <span className="text-xs text-amber-600 font-medium">В работе</span>}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <ChevronRight size={16} className="text-slate-300 inline" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {(selectedEntry || showCreateModal) && (
        <NtsEntryModal
          entry={selectedEntry ?? null}
          profiles={profiles}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => { setSelectedEntry(null); setShowCreateModal(false); }}
          onSaved={() => { setSelectedEntry(null); setShowCreateModal(false); void loadData(); }}
        />
      )}

      {/* ── Status-change notification ─────────────────────────────────── */}
      {statusChangeToast && (
        <Toast
          message={`Изменение НТС: ${statusChangeToast}`}
          duration={6000}
          onClose={() => setStatusChangeToast(null)}
        />
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl p-5 border border-white/80 shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-xs text-slate-600 font-medium">{label}</div>
    </div>
  );
}

function CostBlock({ label, value, color, note }: { label: string; value: number; color: string; note?: string }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>
        {new Intl.NumberFormat('ru-RU').format(Math.round(value / 1_000_000))} млн
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {note && <div className="text-xs text-slate-400">{note}</div>}
    </div>
  );
}
