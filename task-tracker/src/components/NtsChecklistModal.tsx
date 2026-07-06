import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, CheckCircle2, XCircle, AlertCircle, MinusCircle, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { NtsChecklistItem, NtsChecklistResponse, NtsChecklistItemStatus, NtsRespondentRole, Profile } from '../types';
import { NTS_CHECKLIST_STATUS } from '../types';

interface Props {
  roundId: number;
  entryRpMainId: string | null;
  entryRp2Id: string | null;
  profiles: Profile[];
  currentUserId?: string;
  onClose: () => void;
}

const ROLE_LABELS: Record<NtsRespondentRole, string> = {
  rp:          'РП',
  rp2:         'РП2',
  responsible: 'Ответственный',
};

const STATUS_ICONS: Record<NtsChecklistItemStatus, React.ReactElement> = {
  ok:      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />,
  fail:    <XCircle     size={14} className="text-red-500 shrink-0" />,
  clarify: <AlertCircle size={14} className="text-amber-500 shrink-0" />,
  na:      <MinusCircle size={14} className="text-slate-300 shrink-0" />,
};

export default function NtsChecklistModal({ roundId, entryRpMainId, entryRp2Id, profiles, currentUserId, onClose }: Props) {
  const [items, setItems] = useState<NtsChecklistItem[]>([]);
  const [responses, setResponses] = useState<NtsChecklistResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const RESPONDENT_ROLES: NtsRespondentRole[] = ['rp', 'rp2', 'responsible'];

  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const rpName = (id: string | null) => id ? (profileMap.get(id)?.full_name ?? 'РП') : 'РП';

  const respondentLabels: Record<NtsRespondentRole, string> = {
    rp:          rpName(entryRpMainId),
    rp2:         rpName(entryRp2Id),
    responsible: 'Ответственный за модуль',
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [itemsRes, respRes] = await Promise.all([
      supabase.from('nts_checklist_items').select('*').order('sort_order'),
      supabase.from('nts_checklist_responses').select('*').eq('round_id', roundId),
    ]);
    if (itemsRes.data) setItems(itemsRes.data as NtsChecklistItem[]);
    if (respRes.data) setResponses(respRes.data as NtsChecklistResponse[]);
    setLoading(false);
  }, [roundId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const getResponse = (itemId: number, role: NtsRespondentRole) =>
    responses.find(r => r.item_id === itemId && r.respondent_role === role);

  const updateResponse = async (itemId: number, role: NtsRespondentRole, field: 'status' | 'comment', value: string) => {
    const key = `${itemId}:${role}:${field}`;
    setSaving(key);

    // Optimistic update in local state
    setResponses(prev => {
      const existing = prev.find(r => r.item_id === itemId && r.respondent_role === role);
      if (existing) {
        return prev.map(r =>
          r.item_id === itemId && r.respondent_role === role ? { ...r, [field]: value } : r
        );
      }
      return [...prev, {
        id: 0, // placeholder; real ID loaded after upsert
        round_id: roundId,
        item_id: itemId,
        respondent_role: role,
        status: field === 'status' ? (value as NtsChecklistItemStatus) : null,
        comment: field === 'comment' ? value : null,
        updated_at: new Date().toISOString(),
        updated_by: currentUserId ?? null,
      }];
    });

    // Always upsert by natural key — avoids stale fake ID problem entirely
    const existing = getResponse(itemId, role);
    const payload = {
      round_id: roundId,
      item_id: itemId,
      respondent_role: role,
      status: field === 'status' ? value : (existing?.status ?? null),
      comment: field === 'comment' ? value : (existing?.comment ?? null),
      updated_at: new Date().toISOString(),
      updated_by: currentUserId ?? null,
    };

    const { data, error } = await supabase
      .from('nts_checklist_responses')
      .upsert([payload], { onConflict: 'round_id,item_id,respondent_role' })
      .select()
      .single();

    if (error) {
      console.error('Checklist save error:', error.message);
    } else if (data) {
      // Sync real DB id into local state so subsequent edits reference a real row
      setResponses(prev => prev.map(r =>
        r.item_id === itemId && r.respondent_role === role
          ? { ...r, id: (data as NtsChecklistResponse).id }
          : r
      ));
    }
    setSaving(null);
  };

  // Readiness check: all items must be ok or na for all 3 respondents
  const isReady = () => {
    if (items.length === 0) return false;
    return items.every(item => {
      return RESPONDENT_ROLES.every(role => {
        const resp = getResponse(item.id, role);
        return resp?.status === 'ok' || resp?.status === 'na';
      });
    });
  };

  const hasFailures = () => {
    return responses.some(r => r.status === 'fail' || r.status === 'clarify');
  };

  // Group by section
  const sections = items.reduce<Record<string, NtsChecklistItem[]>>((acc, item) => {
    const sec = item.section_title ?? 'Общее';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(item);
    return acc;
  }, {});

  const toggleSection = (sec: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sec)) next.delete(sec); else next.add(sec);
      return next;
    });
  };

  const completedCount = items.filter(item =>
    RESPONDENT_ROLES.every(role => {
      const r = getResponse(item.id, role);
      return r?.status === 'ok' || r?.status === 'na';
    })
  ).length;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
        <div className="bg-white rounded-2xl p-8 flex items-center gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={24} />
          <span className="text-slate-700">Загрузка чек-листа…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 z-[60] overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-slate-100 p-5 z-10">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Чек-лист документации</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {items.length} пунктов · Выполнено: {completedCount} из {items.length}
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={22} />
            </button>
          </div>

          {/* Readiness indicator */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border ${
            isReady()
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : hasFailures()
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {isReady() ? (
              <><CheckCircle2 size={18} className="text-emerald-600 shrink-0" /> Все пункты заполнены — можно назначать ВКС</>
            ) : hasFailures() ? (
              <><XCircle size={18} className="text-red-500 shrink-0" /> Есть несоответствия — заседание назначать нельзя</>
            ) : (
              <><AlertCircle size={18} className="text-amber-500 shrink-0" /> Чек-лист заполнен не полностью</>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all ${isReady() ? 'bg-emerald-500' : hasFailures() ? 'bg-red-400' : 'bg-amber-400'}`}
              style={{ width: `${items.length ? (completedCount / items.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Respondent header */}
        <div className="sticky top-[132px] bg-slate-50 border-b border-slate-200 grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-0 z-10">
          <div className="px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Пункт</div>
          {RESPONDENT_ROLES.map(role => (
            <div key={role} className="px-3 py-2.5 text-xs font-semibold text-slate-700 text-center">
              <div>{ROLE_LABELS[role]}</div>
              <div className="text-[10px] text-slate-400 font-normal truncate">{respondentLabels[role]}</div>
            </div>
          ))}
        </div>

        {/* Checklist items */}
        <div className="divide-y divide-slate-100">
          {Object.entries(sections).map(([sec, secItems]) => {
            const isCollapsed = collapsedSections.has(sec);
            const secCompleted = secItems.filter(item =>
              RESPONDENT_ROLES.every(role => {
                const r = getResponse(item.id, role);
                return r?.status === 'ok' || r?.status === 'na';
              })
            ).length;
            return (
              <div key={sec}>
                {/* Section header */}
                <button
                  className="w-full flex items-center gap-2 px-5 py-3 bg-slate-50/80 hover:bg-slate-100 transition text-left"
                  onClick={() => toggleSection(sec)}
                >
                  {isCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  <span className="text-sm font-semibold text-slate-800 flex-1">{sec}</span>
                  <span className="text-xs text-slate-400">{secCompleted}/{secItems.length}</span>
                </button>

                {/* Section items */}
                {!isCollapsed && secItems.map((item, idx) => {
                  const rowBg = idx % 2 === 0 ? '' : 'bg-slate-50/40';
                  return (
                    <div key={item.id} className={`grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-0 ${rowBg}`}>
                      {/* Item description */}
                      <div className="px-5 py-3 flex items-start gap-2">
                        <span className="text-xs text-slate-400 font-mono mt-0.5 shrink-0">{item.item_num}.</span>
                        <span className="text-sm text-slate-700 leading-snug">{item.description}</span>
                      </div>

                      {/* Respondent cells */}
                      {RESPONDENT_ROLES.map(role => {
                        const resp = getResponse(item.id, role);
                        const key = `${item.id}:${role}`;
                        const isSaving = saving?.startsWith(key);
                        return (
                          <div key={role} className="px-3 py-3 border-l border-slate-100 space-y-1.5">
                            <div className="flex items-center gap-1">
                              {resp?.status && STATUS_ICONS[resp.status]}
                              <select
                                value={resp?.status ?? ''}
                                onChange={e => updateResponse(item.id, role, 'status', e.target.value)}
                                disabled={!!isSaving}
                                className="flex-1 min-w-0 text-xs px-2 py-1 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 bg-white disabled:opacity-60"
                              >
                                <option value="">—</option>
                                {Object.entries(NTS_CHECKLIST_STATUS).map(([k, v]) => (
                                  <option key={k} value={k}>{v.label}</option>
                                ))}
                              </select>
                              {isSaving && <Loader2 size={12} className="animate-spin text-indigo-400 shrink-0" />}
                            </div>
                            {(resp?.status === 'fail' || resp?.status === 'clarify' || resp?.comment) && (
                              <textarea
                                value={resp?.comment ?? ''}
                                onChange={e => updateResponse(item.id, role, 'comment', e.target.value)}
                                placeholder="Замечание…"
                                rows={2}
                                className="w-full text-xs px-2 py-1 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 resize-none"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-5 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Изменения сохраняются автоматически
            </span>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
            >
              <Save size={14} /> Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
