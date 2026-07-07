import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, AlertTriangle, Clock, CheckCircle2, ClipboardList, FileText, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Task, Address, View } from '../types';

interface Props {
  tasks: Task[];
  moduleAccess: Record<string, boolean>;
  /** Districts assigned to this user (null/empty → no district filter) */
  districts?: string[] | null;
  /** Full addresses list for district lookups by UIN */
  addresses: Address[];
  /** True when user is admin or module-responsible (bypass district filter) */
  isSuperUser?: boolean;
  /** Called when the user clicks a notification to navigate to a view */
  onNavigate?: (view: View) => void;
}

interface AppNotif {
  id: string;
  module: string;
  moduleLabel: string;
  severity: 'overdue' | 'warning';
  icon: React.ReactNode;
  title: string;
  detail: string;
  /** Target view to navigate to on click */
  targetView: View;
}

export default function NotificationBell({ tasks, moduleAccess, districts, addresses, isSuperUser, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotif[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const buildNotifications = useCallback(async () => {
    setLoading(true);
    const list: AppNotif[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const canSeeModule = (mod: string) => moduleAccess[mod] ?? false;

    const hasDistrictFilter = !isSuperUser && (districts?.length ?? 0) > 0;

    const districtByUin = new Map<string, string>(
      (addresses ?? []).map(a => [a['Код УИН'], a['Городской округ'] ?? ''])
    );

    const inScope = (uin: string | null | undefined): boolean => {
      if (!hasDistrictFilter) return true;
      if (!uin) return false;
      const d = districtByUin.get(uin) ?? '';
      return (districts ?? []).includes(d);
    };

    // ── Поручения: просроченные задачи ───────────────────────────────────────
    if (canSeeModule('dashboard')) {
      const scopedTasks = tasks.filter(t => inScope(t.object_uin));

      const overdue = scopedTasks.filter(t => {
        if (!t.deadline || t.status === 'completed') return false;
        const d = new Date(t.deadline);
        d.setHours(0, 0, 0, 0);
        return d < today;
      });
      const soon = scopedTasks.filter(t => {
        if (!t.deadline || t.status === 'completed') return false;
        const d = new Date(t.deadline);
        d.setHours(0, 0, 0, 0);
        const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
        return diff >= 0 && diff <= 3;
      });

      if (overdue.length > 0) {
        list.push({
          id: 'tasks-overdue',
          module: 'tasks',
          moduleLabel: 'Поручения',
          severity: 'overdue',
          icon: <AlertTriangle size={15} />,
          title: `${overdue.length} поручени${overdue.length === 1 ? 'е просрочено' : 'й просрочено'}`,
          detail: 'Нажмите, чтобы перейти к протокольным поручениям',
          targetView: 'dashboard',
        });
      }
      if (soon.length > 0) {
        list.push({
          id: 'tasks-soon',
          module: 'tasks',
          moduleLabel: 'Поручения',
          severity: 'warning',
          icon: <Clock size={15} />,
          title: `${soon.length} поручени${soon.length === 1 ? 'е' : 'й'} — срок через ≤3 дня`,
          detail: 'Нажмите, чтобы перейти к протокольным поручениям',
          targetView: 'dashboard',
        });
      }
    }

    // ── НТС: просроченное рассмотрение документов ────────────────────────────
    if (canSeeModule('nts')) {
      const ntsDeadline = new Date(today);
      ntsDeadline.setDate(ntsDeadline.getDate() - 3);
      const isoDeadline = ntsDeadline.toISOString().split('T')[0];

      const { data: overdueRounds } = await supabase
        .from('nts_doc_rounds')
        .select('id, received_date, nts_entry_id, nts_entries!inner(object_name, object_uin, status)')
        .is('remarks_issued_at', null)
        .eq('checklist_approved', false)
        .lt('received_date', isoDeadline);

      const filteredOverdue = (overdueRounds ?? []).filter(r => {
        const entry = r.nts_entries as { object_uin?: string } | null;
        return inScope(entry?.object_uin);
      });

      if (filteredOverdue.length > 0) {
        list.push({
          id: 'nts-overdue-reviews',
          module: 'nts',
          moduleLabel: 'НТС',
          severity: 'overdue',
          icon: <ClipboardList size={15} />,
          title: `${filteredOverdue.length} раунд${filteredOverdue.length === 1 ? '' : 'а'} НТС — просрочено рассмотрение`,
          detail: 'Нажмите, чтобы перейти в модуль НТС',
          targetView: 'nts',
        });
      }

      const [allRoundsRes, rpEntriesRes] = await Promise.all([
        supabase.from('nts_doc_rounds').select('nts_entry_id'),
        supabase.from('nts_entries').select('id, object_name, object_uin, created_at').eq('status', 'rp_review'),
      ]);

      const allRounds = allRoundsRes.data;
      const rpEntries = rpEntriesRes.data;

      if (rpEntries && allRounds !== null) {
        const roundEntryIds = new Set((allRounds ?? []).map((r: { nts_entry_id: number }) => r.nts_entry_id));
        const stale = rpEntries.filter((e: { id: number; object_uin: string; created_at: string }) => {
          if (roundEntryIds.has(e.id)) return false;
          if (!inScope(e.object_uin)) return false;
          const created = new Date(e.created_at);
          const diffDays = Math.round((today.getTime() - created.getTime()) / 86400000);
          return diffDays > 5;
        });
        if (stale.length > 0) {
          list.push({
            id: 'nts-no-docs',
            module: 'nts',
            moduleLabel: 'НТС',
            severity: 'warning',
            icon: <FileText size={15} />,
            title: `${stale.length} объект${stale.length === 1 ? '' : 'а'} НТС — документация не получена`,
            detail: 'Нажмите, чтобы перейти в модуль НТС',
            targetView: 'nts',
          });
        }
      }
    }

    setNotifs(list);
    setLoading(false);
  }, [tasks, moduleAccess, districts, addresses, isSuperUser]);

  useEffect(() => {
    void buildNotifications();
    const interval = setInterval(() => void buildNotifications(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [buildNotifications]);

  const totalCount = notifs.length;
  const overdueCount = notifs.filter(n => n.severity === 'overdue').length;

  const grouped = notifs.reduce<Record<string, AppNotif[]>>((acc, n) => {
    if (!acc[n.module]) acc[n.module] = [];
    acc[n.module].push(n);
    return acc;
  }, {});

  const handleNotifClick = (n: AppNotif) => {
    setOpen(false);
    onNavigate?.(n.targetView);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`relative p-2 rounded-lg transition ${
          open ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
        }`}
        title="Уведомления"
      >
        <Bell size={20} />
        {totalCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center leading-none ${
            overdueCount > 0 ? 'bg-red-500' : 'bg-amber-500'
          }`}>
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-semibold text-slate-800 flex items-center gap-2">
              <Bell size={15} className="text-indigo-500" />
              Уведомления
              {totalCount > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  overdueCount > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {totalCount}
                </span>
              )}
            </span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-400">Загрузка…</div>
            ) : totalCount === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-400" />
                <p className="text-sm text-slate-500">Нет активных уведомлений</p>
                <p className="text-xs text-slate-400 mt-1">Все сроки соблюдены</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {Object.entries(grouped).map(([mod, items]) => (
                  <div key={mod} className="px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      {items[0].moduleLabel}
                    </p>
                    {items.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border text-sm transition hover:opacity-80 cursor-pointer ${
                          n.severity === 'overdue'
                            ? 'bg-red-50 border-red-200 hover:bg-red-100'
                            : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <span className={`mt-0.5 shrink-0 ${
                          n.severity === 'overdue' ? 'text-red-500' : 'text-amber-500'
                        }`}>
                          {n.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${
                            n.severity === 'overdue' ? 'text-red-800' : 'text-amber-800'
                          }`}>
                            {n.title}
                          </p>
                          <p className={`text-xs mt-0.5 ${
                            n.severity === 'overdue' ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            {n.detail}
                          </p>
                        </div>
                        <ArrowRight size={14} className={`shrink-0 mt-0.5 ${
                          n.severity === 'overdue' ? 'text-red-400' : 'text-amber-400'
                        }`} />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400 text-center">
            Обновляется каждые 5 минут
          </div>
        </div>
      )}
    </div>
  );
}
