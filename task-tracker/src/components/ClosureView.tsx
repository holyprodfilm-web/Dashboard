import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  Loader2, AlertCircle, CheckCircle2, Clock3, XCircle, MinusCircle,
  Building2, ChevronDown, ChevronUp, Search, RefreshCw, TrendingUp,
  BarChart2, AlertTriangle, Layers,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ClosureObject, PaymentStatus } from '../types';

// ─── constants ───────────────────────────────────────────────────────────────

const PAYMENT_CFG: Record<PaymentStatus, { label: string; color: string; bg: string; border: string; accent: string }> = {
  paid:       { label: 'Оплачено полностью', color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', accent: '#059669' },
  partial:    { label: 'Оплачено частично',  color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   accent: '#d97706' },
  not_paid:   { label: 'Не оплачено',        color: 'text-[#E93A58]',   bg: 'bg-[#FFF0F3]',  border: 'border-[#FFB3BF]',  accent: '#E93A58' },
  terminated: { label: 'Расторгнуто',        color: 'text-slate-500',   bg: 'bg-slate-100',   border: 'border-slate-200',   accent: '#94a3b8' },
};

const fmtBln = (v: number) => (v / 1e9).toFixed(2).replace('.', ',') + ' млрд ₽';
const fmtMln = (v: number) => (v / 1e6).toFixed(1).replace('.', ',') + ' млн ₽';
const fmtMoney = (v: number) => (v >= 1e9 ? fmtBln(v) : fmtMln(v));
const fmtMlnN = (v: number | null | undefined) =>
  !v || isNaN(v) ? '—' : (v / 1e6).toFixed(2).replace('.', ',');

// ─── Donut chart (pure SVG) ───────────────────────────────────────────────────

interface DonutSegment { label: string; n: number; color: string }
function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const cx = 74, cy = 74, R = 62, ri = 42;
  const active = segments.filter(s => s.n > 0);

  // Special case: single segment fills 100% — arc start === end, SVG degenerate
  if (active.length === 1) {
    return (
      <svg viewBox="0 0 148 148" className="w-36 h-36">
        <circle cx={cx} cy={cy} r={R} fill={active[0].color} />
        <circle cx={cx} cy={cy} r={ri} fill="#fff" />
        <text x="74" y="70" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1e293b">{total}</text>
        <text x="74" y="86" textAnchor="middle" fontSize="10" fill="#94a3b8">объектов</text>
      </svg>
    );
  }

  let ang = -Math.PI / 2;
  const paths: { d: string; color: string }[] = [];
  active.forEach(s => {
    const sw = (s.n / (total || 1)) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(ang), y1 = cy + R * Math.sin(ang);
    ang += sw;
    const x2 = cx + R * Math.cos(ang), y2 = cy + R * Math.sin(ang);
    const xi1 = cx + ri * Math.cos(ang), yi1 = cy + ri * Math.sin(ang);
    const xi2 = cx + ri * Math.cos(ang - sw), yi2 = cy + ri * Math.sin(ang - sw);
    const lg = sw > Math.PI ? 1 : 0;
    paths.push({
      color: s.color,
      d: `M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${lg},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xi1.toFixed(1)},${yi1.toFixed(1)} A${ri},${ri} 0 ${lg},0 ${xi2.toFixed(1)},${yi2.toFixed(1)} Z`,
    });
  });
  return (
    <svg viewBox="0 0 148 148" className="w-36 h-36">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth="2.5" />
      ))}
      <text x="74" y="70" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1e293b">{total}</text>
      <text x="74" y="86" textAnchor="middle" fontSize="10" fill="#94a3b8">объектов</text>
    </svg>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, accent, onClick, active }: {
  label: string; value: number; sub?: string; icon: React.ReactNode;
  accent: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl p-5 border-t-4 shadow-sm transition
        ${active ? 'ring-2 ring-offset-1' : 'hover:shadow-md'}`}
      style={{ borderTopColor: accent, ['--tw-ring-color' as string]: accent }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-700 uppercase tracking-wide text-slate-500 mb-1">{label}</div>
          <div className="text-4xl font-black leading-none" style={{ color: accent }}>{value}</div>
          {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
        </div>
        <span style={{ color: accent }} className="opacity-60 mt-1">{icon}</span>
      </div>
    </button>
  );
}

// ─── Money card ───────────────────────────────────────────────────────────────

function MoneyCard({ label: lbl, value, sub, pct, accent }: {
  label: string; value: string; sub: string; pct: number; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4" style={{ borderLeftColor: accent }}>
      <div className="text-xs font-700 uppercase tracking-wide text-slate-500 mb-1">{lbl}</div>
      <div className="text-2xl font-black leading-tight" style={{ color: accent }}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
      <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
      </div>
    </div>
  );
}

// ─── Objects table ────────────────────────────────────────────────────────────

function ObjectsTable({ rows }: { rows: ClosureObject[] }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    return lq ? rows.filter(r =>
      r.object_name.toLowerCase().includes(lq) ||
      r.omsu.toLowerCase().includes(lq) ||
      (r.contractor ?? '').toLowerCase().includes(lq)
    ) : rows;
  }, [rows, q]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Поиск по объекту, ОМСУ, подрядчику…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        <span className="text-xs text-slate-400">{filtered.length} из {rows.length}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs min-w-[1020px]">
          <thead className="bg-slate-50 text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2 text-left font-semibold w-6">#</th>
              <th className="px-3 py-2 text-left font-semibold">ОМСУ</th>
              <th className="px-3 py-2 text-left font-semibold">Тип</th>
              <th className="px-3 py-2 text-left font-semibold">Мероприятие</th>
              <th className="px-3 py-2 text-left font-semibold">Подрядчик</th>
              <th className="px-3 py-2 text-center font-semibold">Статус</th>
              <th className="px-3 py-2 text-right font-semibold">Контракт, млн</th>
              <th className="px-3 py-2 text-right font-semibold">Оплачено, млн</th>
              <th className="px-3 py-2 text-right font-semibold">Остаток, млн</th>
              <th className="px-3 py-2 text-left font-semibold">МОГЭ</th>
              <th className="px-3 py-2 text-left font-semibold">СМР</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-10 text-slate-400">Нет данных</td></tr>
            ) : filtered.map((r, i) => {
              const cfg = PAYMENT_CFG[r.payment_status];
              return (
                <tr key={r.id} className="hover:bg-slate-50 transition">
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-[#8A4C08] whitespace-nowrap">{r.omsu}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.object_type ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-700 max-w-xs leading-snug">{r.object_name}</td>
                  <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">{r.contractor || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMlnN(r.contract_sum)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{fmtMlnN(r.paid_sum)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#E93A58]">{fmtMlnN(r.remaining_sum)}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.mogae_status ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.smr_completed ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Contractors tab ──────────────────────────────────────────────────────────

interface ContrRow {
  name: string; total: number; paid: number; partial: number;
  not_paid: number; terminated: number; contract: number; remain: number;
  objects: ClosureObject[];
}

function ContractorsTab({ data }: { data: ClosureObject[] }) {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: keyof ContrRow; dir: 1 | -1 }>({ key: 'not_paid', dir: -1 });

  const rows: ContrRow[] = useMemo(() => {
    const map: Record<string, ContrRow> = {};
    data.forEach(r => {
      const name = r.contractor || 'Не указан';
      if (!map[name]) map[name] = { name, total: 0, paid: 0, partial: 0, not_paid: 0, terminated: 0, contract: 0, remain: 0, objects: [] };
      const m = map[name];
      m.total++;
      m[r.payment_status]++;
      m.contract += r.contract_sum ?? 0;
      m.remain += r.remaining_sum ?? 0;
      m.objects.push(r);
    });
    return Object.values(map).sort((a, b) => ((b[sort.key] as number) - (a[sort.key] as number)) * sort.dir);
  }, [data, sort]);

  const toggleSort = (key: keyof ContrRow) =>
    setSort(s => s.key === key ? { key, dir: s.dir === -1 ? 1 : -1 } : { key, dir: -1 });
  const sortInd = (key: keyof ContrRow) => sort.key === key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ' ⇅';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-[#8A4C08] text-white text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Подрядчик</th>
              {([['total','Всего'],['paid','Оплачено'],['partial','Частично'],['not_paid','Не оплачено'],['terminated','Расторгнуто'],['contract','Контракт, млн'],['remain','Остаток, млн']] as [keyof ContrRow, string][]).map(([k, lbl]) => (
                <th key={k} className="px-4 py-3 text-right cursor-pointer hover:bg-[#a06020] select-none"
                  onClick={() => toggleSort(k)}>
                  {lbl}{sortInd(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(r => (
              <Fragment key={r.name}>
                <tr
                  className="hover:bg-teal-50 cursor-pointer transition"
                  onClick={() => setOpenRow(openRow === r.name ? null : r.name)}
                >
                  <td className="px-4 py-3 font-semibold text-teal-700 flex items-center gap-2">
                    {openRow === r.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {r.name}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">{r.total}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{r.paid}</td>
                  <td className="px-4 py-3 text-right text-amber-600 font-semibold">{r.partial}</td>
                  <td className="px-4 py-3 text-right text-[#E93A58] font-semibold">{r.not_paid}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{r.terminated}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtMlnN(r.contract)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#E93A58] font-semibold">{fmtMlnN(r.remain)}</td>
                </tr>
                {openRow === r.name && (
                  <tr>
                    <td colSpan={8} className="bg-slate-50 px-6 py-4">
                      <ObjectsTable rows={r.objects} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Causes tab ───────────────────────────────────────────────────────────────

function CausesTab({ data }: { data: ClosureObject[] }) {
  const [openCause, setOpenCause] = useState<string | null>(null);

  // Group by block → cause
  const blocks = useMemo(() => {
    const bmap: Record<string, Record<string, ClosureObject[]>> = {};
    data.forEach(r => {
      if (r.payment_status === 'paid' || r.payment_status === 'terminated') return;
      const blk = r.typical_block || 'Прочее';
      const cause = r.typical_cause || 'Не указана';
      if (!bmap[blk]) bmap[blk] = {};
      if (!bmap[blk][cause]) bmap[blk][cause] = [];
      bmap[blk][cause].push(r);
    });
    return Object.entries(bmap).map(([blk, causes]) => ({
      blk,
      total: Object.values(causes).reduce((s, arr) => s + arr.length, 0),
      causes: Object.entries(causes).sort((a, b) => b[1].length - a[1].length),
    })).sort((a, b) => b.total - a.total);
  }, [data]);

  const maxCause = useMemo(() =>
    Math.max(1, ...blocks.flatMap(b => b.causes.map(([, arr]) => arr.length))), [blocks]);

  const blockColors = ['#E97386','#EFA566','#059669','#6366f1','#d97706','#0891b2'];

  if (blocks.length === 0) {
    return <div className="text-center text-slate-400 py-16">Данных о причинах нет</div>;
  }

  return (
    <div className="space-y-4">
      {blocks.map(({ blk, total, causes }, bi) => {
        const color = blockColors[bi % blockColors.length];
        return (
          <div key={blk} className="rounded-2xl overflow-hidden shadow-sm border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 text-white"
              style={{ background: color }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center font-black text-sm">
                  {bi + 1}
                </div>
                <span className="font-bold text-base">{blk}</span>
              </div>
              <span className="bg-white/20 rounded-full px-4 py-1 font-bold">{total} объектов</span>
            </div>
            <div className="bg-white px-6 py-4 space-y-1">
              {causes.map(([cause, rows]) => {
                const pct = Math.round((rows.length / maxCause) * 100);
                const key = blk + '|' + cause;
                const open = openCause === key;
                return (
                  <div key={cause}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition
                        ${open ? 'bg-slate-50 border-slate-200' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                      onClick={() => setOpenCause(open ? null : key)}
                    >
                      <span className="flex-1 text-sm text-slate-700">{cause}</span>
                      <div className="w-36 h-2.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-sm font-bold w-7 text-right" style={{ color }}>{rows.length}</span>
                      {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                    {open && (
                      <div className="mt-1 mb-2 border border-slate-200 rounded-xl overflow-hidden">
                        <ObjectsTable rows={rows} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Dynamics tab ─────────────────────────────────────────────────────────────

function DynamicsTab({ data }: { data: ClosureObject[] }) {
  const snapshots = useMemo(() => {
    const map: Record<string, { total: number; paid: number; partial: number; not_paid: number }> = {};
    data.forEach(r => {
      const d = r.snapshot_date;
      if (!map[d]) map[d] = { total: 0, paid: 0, partial: 0, not_paid: 0 };
      map[d].total++;
      if (r.payment_status === 'paid') map[d].paid++;
      else if (r.payment_status === 'partial') map[d].partial++;
      else if (r.payment_status === 'not_paid') map[d].not_paid++;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
      date,
      label: new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      ...v,
      paidPct: Math.round((v.paid / (v.total || 1)) * 100),
    }));
  }, [data]);

  if (snapshots.length === 0) {
    return <div className="text-center text-slate-400 py-16">Нет данных о срезах. Добавьте объекты с разными датами snapshot_date.</div>;
  }

  const maxTotal = Math.max(1, ...snapshots.map(s => s.total));
  const last = snapshots[snapshots.length - 1];
  const first = snapshots[0];

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-emerald-400">
          <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Оплачено на {last.label}</div>
          <div className="text-4xl font-black text-emerald-600">{last.paid}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-teal-400">
          <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Прирост за период</div>
          <div className="text-4xl font-black text-teal-600">+{last.paid - first.paid}</div>
          <div className="text-xs text-slate-400">с {first.label}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-amber-400">
          <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Срезов данных</div>
          <div className="text-4xl font-black text-amber-600">{snapshots.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-[#E93A58]">
          <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Не оплачено сейчас</div>
          <div className="text-4xl font-black text-[#E93A58]">{last.not_paid}</div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-[#8A4C08] uppercase tracking-wide mb-5">
          Динамика оплаты по срезам
        </h3>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-4 min-w-max pb-2" style={{ height: 200 }}>
            {snapshots.map(s => {
              const barH = Math.max(8, Math.round((s.paid / maxTotal) * 160));
              return (
                <div key={s.date} className="flex flex-col items-center gap-1 group cursor-default">
                  <div className="text-xs font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition">
                    {s.paid}
                  </div>
                  <div
                    className="w-14 rounded-t-lg transition-all"
                    style={{ height: barH, background: '#059669' }}
                    title={`${s.label}: ${s.paid} оплачено из ${s.total}`}
                  />
                  <div className="text-xs text-slate-500 text-center whitespace-nowrap">{s.label}</div>
                  <div className="text-xs font-semibold text-emerald-600">{s.paidPct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Snapshot table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-5 py-3 text-left font-semibold">Дата среза</th>
              <th className="px-5 py-3 text-right font-semibold">Всего</th>
              <th className="px-5 py-3 text-right font-semibold text-emerald-600">Оплачено</th>
              <th className="px-5 py-3 text-right font-semibold text-amber-600">Частично</th>
              <th className="px-5 py-3 text-right font-semibold text-[#E93A58]">Не оплачено</th>
              <th className="px-5 py-3 text-left font-semibold">Прогресс</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {snapshots.map(s => (
              <tr key={s.date} className="hover:bg-slate-50 transition">
                <td className="px-5 py-3 font-medium text-slate-700">{new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                <td className="px-5 py-3 text-right font-bold">{s.total}</td>
                <td className="px-5 py-3 text-right text-emerald-600 font-semibold">{s.paid}</td>
                <td className="px-5 py-3 text-right text-amber-600 font-semibold">{s.partial}</td>
                <td className="px-5 py-3 text-right text-[#E93A58] font-semibold">{s.not_paid}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-2 max-w-[120px]">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${s.paidPct}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-8">{s.paidPct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type TabId = 'payments' | 'contractors' | 'causes' | 'dynamics';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'payments',    label: 'Оплаты',            icon: <CheckCircle2 size={16} /> },
  { id: 'contractors', label: 'Подрядчики',         icon: <Building2 size={16} /> },
  { id: 'causes',      label: 'Типичные причины',   icon: <Layers size={16} /> },
  { id: 'dynamics',    label: 'Динамика',           icon: <BarChart2 size={16} /> },
];

export default function ClosureView() {
  const [data, setData] = useState<ClosureObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('payments');
  const [mogaeFilter, setMogaeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    const { data: rows, error: err } = await supabase
      .from('closure_objects')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .order('omsu');
    if (err) { setError(err.message); setLoading(false); return; }
    setData(rows ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  // Latest-snapshot rows only (for summary tab)
  const latestDate = useMemo(() =>
    data.length ? data.reduce((mx, r) => r.snapshot_date > mx ? r.snapshot_date : mx, data[0].snapshot_date) : '',
  [data]);

  const latest = useMemo(() => data.filter(r => r.snapshot_date === latestDate), [data, latestDate]);

  // Aggregations over latest snapshot
  const agg = useMemo(() => {
    const counts: Record<PaymentStatus, number> = { paid: 0, partial: 0, not_paid: 0, terminated: 0 };
    let contract = 0, paid = 0, remain = 0;
    latest.forEach(r => {
      counts[r.payment_status]++;
      contract += r.contract_sum ?? 0;
      paid += r.paid_sum ?? 0;
      remain += r.remaining_sum ?? 0;
    });
    // МОГЭ counts among not_paid
    const mogaeRows = latest.filter(r => r.payment_status === 'not_paid');
    const mogaeCounts: Record<string, number> = {};
    mogaeRows.forEach(r => { const k = r.mogae_status ?? 'Не заходили ни разу'; mogaeCounts[k] = (mogaeCounts[k] ?? 0) + 1; });
    return { total: latest.length, counts, contract, paid, remain, mogaeRows: mogaeRows.length, mogaeCounts };
  }, [latest]);

  // Filtered table for payments tab
  const tableRows = useMemo(() => {
    let rows = latest;
    if (statusFilter) rows = rows.filter(r => r.payment_status === statusFilter);
    if (mogaeFilter) rows = rows.filter(r => (r.mogae_status ?? 'Не заходили ни разу') === mogaeFilter);
    return rows;
  }, [latest, statusFilter, mogaeFilter]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-teal-500" size={36} />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 p-4 bg-[#FFF0F3] border border-[#FFB3BF] rounded-xl text-[#c42d49]">
      <AlertCircle size={18} /> <span>{error}</span>
      <button onClick={load} className="ml-auto px-3 py-1 bg-[#FFD6DC] rounded-lg text-xs font-semibold">Повторить</button>
    </div>
  );

  const contractPct = agg.contract > 0 ? (agg.paid / agg.contract) * 100 : 0;
  const remainPct = agg.contract > 0 ? (agg.remain / agg.contract) * 100 : 0;

  const MOGAE_ITEMS = [
    { key: 'Заходили',            label: '🔄 Заходили в МОГЭ',       sub: 'Были ранее, не прошли',    color: '#d97706', bg: 'bg-amber-50',   border: 'border-amber-200' },
    { key: 'В МОГЭ',              label: '⏳ Находятся в МОГЭ',      sub: 'Сейчас на рассмотрении',   color: '#1a6fba', bg: 'bg-blue-50',    border: 'border-blue-200'  },
    { key: 'Не заходили ни разу', label: '🚫 Не заходили ни разу',   sub: 'Ни разу не подавали',      color: '#E93A58', bg: 'bg-[#FFF0F3]',  border: 'border-[#FFB3BF]' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#8A4C08]">Закрытие объектов</h2>
          <p className="text-slate-500">Оплаты по объектам теплоэнергетики
            {latestDate && <span className="ml-2 text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
              Актуально на {new Date(latestDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition font-medium border border-slate-200">
          <RefreshCw size={15} /> Обновить
        </button>
      </div>

      {data.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <TrendingUp size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium mb-2">Данных пока нет</p>
          <p className="text-slate-400 text-sm">Вставьте записи в таблицу <code className="bg-slate-100 px-1 rounded">closure_objects</code> в Supabase.</p>
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 mb-6 w-fit shadow-sm">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition
                  ${tab === t.id
                    ? 'bg-gradient-to-r from-[#E97386] to-[#EFA566] text-white shadow'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ── TAB 1: Payments ── */}
          {tab === 'payments' && (
            <div className="space-y-6">
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <KpiCard label="Всего объектов" value={agg.total} accent="#0f766e" icon={<Layers size={22} />} />
                {(['paid','partial','not_paid','terminated'] as PaymentStatus[]).map(s => {
                  const cfg = PAYMENT_CFG[s];
                  const icon = s === 'paid' ? <CheckCircle2 size={22} /> : s === 'partial' ? <Clock3 size={22} /> : s === 'not_paid' ? <XCircle size={22} /> : <MinusCircle size={22} />;
                  return (
                    <KpiCard
                      key={s} label={cfg.label} value={agg.counts[s]}
                      sub={`${((agg.counts[s] / (agg.total || 1)) * 100).toFixed(1)}% от общего`}
                      accent={cfg.accent} icon={icon}
                      active={statusFilter === s}
                      onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                    />
                  );
                })}
              </div>

              {/* Money row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MoneyCard label="Сумма контрактов" value={fmtMoney(agg.contract)} sub="Общий объём обязательств" pct={100} accent="#0f766e" />
                <MoneyCard label="Оплачено" value={fmtMoney(agg.paid)} sub={`${contractPct.toFixed(1)}% от суммы контрактов`} pct={contractPct} accent="#059669" />
                <MoneyCard label="Остаток к оплате" value={fmtMoney(agg.remain)} sub={`${remainPct.toFixed(1)}% от суммы контрактов`} pct={remainPct} accent="#E93A58" />
              </div>

              {/* Donut + МОГЭ split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Donut */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center gap-8">
                  <DonutChart
                    total={agg.total}
                    segments={[
                      { label: 'Оплачено полностью', n: agg.counts.paid,       color: '#059669' },
                      { label: 'Оплачено частично',  n: agg.counts.partial,    color: '#d97706' },
                      { label: 'Не оплачено',        n: agg.counts.not_paid,   color: '#E93A58' },
                      { label: 'Расторгнуто',        n: agg.counts.terminated, color: '#94a3b8' },
                    ]}
                  />
                  <div className="space-y-2">
                    {(['paid','partial','not_paid','terminated'] as PaymentStatus[]).map(s => (
                      <div key={s} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PAYMENT_CFG[s].accent }} />
                        <span className="text-slate-600">{PAYMENT_CFG[s].label}</span>
                        <span className="font-bold ml-auto pl-4">{agg.counts[s]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* МОГЭ split */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="text-xs font-bold text-[#E93A58] uppercase tracking-wide mb-3 flex items-center gap-2">
                    <AlertTriangle size={13} /> МОГЭ — {agg.mogaeRows} объектов не оплачено
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {MOGAE_ITEMS.map(it => {
                      const cnt = agg.mogaeCounts[it.key] ?? 0;
                      const pct = Math.round((cnt / (agg.mogaeRows || 1)) * 100);
                      const active = mogaeFilter === it.key;
                      return (
                        <button
                          key={it.key}
                          onClick={() => setMogaeFilter(active ? null : it.key)}
                          className={`rounded-xl p-3 border-2 text-left transition hover:-translate-y-0.5 hover:shadow-md ${it.bg} ${it.border} ${active ? 'ring-2' : ''}`}
                          style={{ ['--tw-ring-color' as string]: it.color }}
                        >
                          <div className="text-xs font-bold leading-tight" style={{ color: it.color }}>{it.label}</div>
                          <div className="text-3xl font-black mt-1" style={{ color: it.color }}>{cnt}</div>
                          <div className="text-xs opacity-60 mt-0.5">{it.sub} · {pct}%</div>
                          <div className="h-1 bg-white/60 rounded-full mt-2 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: it.color }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {(statusFilter || mogaeFilter) && (
                    <button
                      onClick={() => { setStatusFilter(null); setMogaeFilter(null); }}
                      className="mt-3 text-xs text-teal-600 hover:underline"
                    >
                      × Сбросить фильтры
                    </button>
                  )}
                </div>
              </div>

              {/* Objects table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-bold text-[#8A4C08] uppercase tracking-wide mb-4">
                  Все объекты {statusFilter ? `· ${PAYMENT_CFG[statusFilter].label}` : ''}{mogaeFilter ? ` · МОГЭ: ${mogaeFilter}` : ''}
                </h3>
                <ObjectsTable rows={tableRows} />
              </div>
            </div>
          )}

          {/* ── TAB 2: Contractors ── */}
          {tab === 'contractors' && <ContractorsTab data={latest} />}

          {/* ── TAB 3: Causes ── */}
          {tab === 'causes' && <CausesTab data={latest} />}

          {/* ── TAB 4: Dynamics ── */}
          {tab === 'dynamics' && <DynamicsTab data={data} />}
        </>
      )}
    </div>
  );
}
