import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, History, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import type { ClosureObject, ClosureChange, PaymentStatus, MogaeStatus } from '../types';

// ── Field labels for history display ──────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  payment_status:     'Статус оплаты',
  mogae_approved:     'МОГЭ одобрено',
  mogae_status:       'Статус МОГЭ',
  contract_sum:       'Сумма договора',
  paid_sum:           'Оплачено',
  remaining_sum:      'Остаток',
  comment:            'Комментарий',
  smr_completed:      'СМР завершено',
  smr_pct:            'СГ%',
  id_ks_submitted:    'ИД и КС сданы',
  typical_block:         'Блок причин',
  typical_cause:         'Причина МОГЭ',
  typical_cause_smr:     'Причина СМР',
  typical_cause_idks:    'Причина ИД/КС',
  typical_cause_payment: 'Причина оплаты',
  payment_reason:     'Обоснование оплаты',
  payment_date:       'Дата оплаты',
  actions:            'Действия',
};

const PAYMENT_LABELS: Record<string, string> = {
  paid:       'Оплачено полностью',
  partial:    'Оплачено частично',
  not_paid:   'Не оплачено',
  terminated: 'Расторгнуто',
};

const MOGAE_OPTIONS: Array<{ value: MogaeStatus; label: string }> = [
  { value: 'Заходили',            label: '🔄 Заходили в МОГЭ' },
  { value: 'В МОГЭ',              label: '⏳ Находятся в МОГЭ' },
  { value: 'Не заходили ни разу', label: '🚫 Не заходили ни разу' },
];

// ── Типовые причины по блокам ─────────────────────────────────────────────────
// Значения взяты из столбцов Excel: H=МОГЭ, K=СМР, W=ИД/КС, R=Оплата

const CAUSE_MOGAE_OPTIONS = [
  'Долгая передача исходных данных от ОМСУ подрядчику',
  'Длительное прохождение НТС',
  'Длительное согласование ПИР с Заказчиком',
  'Корректировка ТЗ',
  'Необходимость проведения НТС',
  'Низкий темп разработки ПИР подрядчиком',
  'Отсутствие ГПЗУ на земельный участок',
  'Отсутствие тех.приса',
  'Оформление ТС в муниципальную собственность',
  'Повторное МОГЭ, корректировка объемов',
  'Проведение дополнительных инж. изысканий в соответствии с ЗНП',
  'Смена проектировщика',
  'Финансовые трудности у ПО',
];

const CAUSE_SMR_OPTIONS = [
  'Выявление доп. объема работ',
  'Длительное получение РНР, допусков на работы',
  'Длительное согласование с ведомствами (Ростехнадзор, МОГ и тд)',
  'Низкий темп производства работ подрядной',
  'Отсутствие тех.прис',
  'Попадание в зоны ЗОУИТ',
  'Расторжение контракта (новый подрядчик)',
  'Финансовые трудности подрядчиков',
];

const CAUSE_IDKS_OPTIONS = [
  'Заказчик выставляет замечания подрядчику',
  'Замечания не устранимы, требуется повторный заход в МОГЭ',
  'ИД и КС-2 не переданы в УТНКР',
  'Исполнительная документация не подписана с Заказчиком',
  'Исполнительная документация не подписана с Заказчиком, ИД и КС-2 не переданы в УТНКР',
  'Низкий темп устранения замечания УТНКР',
  'Низкий темп устранения замечания УТНКР, Исполнительная документация не подписана с Заказчиком',
  'Низкий темп устранения замечания УТНКР, Отсутствуют акты скрытых работ',
  'Спор из-за объемов выполненных работ',
];

const CAUSE_PAYMENT_OPTIONS = [
  '65.1, Формирование пакета документов для оплаты',
  'Формирование пакета документов для оплаты',
  'ИД, КС принята УТНКР, заказчик выставляет доп.требования к перевыполнению Благоустройства',
  'Не доведены лимиты от ГРБС',
  'Не завершены СМР',
  'Низкий темп подгрузки документов в ПИК',
  'Отсутствие доп.ника',
  'Передача объекта в собственность МО',
  'контракт расторгнут',
];

/** Выпадающий список типовых причин с возможностью выбрать «Другое» */
function CauseSelect({
  label, value, onChange, options, emoji,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  emoji: string;
}) {
  const isCustom = value !== '' && !options.includes(value);
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{emoji} {label}</label>
      <select
        value={isCustom ? '__other__' : value}
        onChange={e => {
          if (e.target.value === '__other__') return; // держим текущее custom-значение
          onChange(e.target.value);
        }}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
      >
        <option value="">— Не указано</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
        {isCustom && (
          <option value="__other__">{value}</option>
        )}
      </select>
    </div>
  );
}

const fmtMlnInput = (v: number) => (v / 1e6).toFixed(2);
const parseMln = (s: string) => parseFloat(s.replace(',', '.')) * 1e6 || 0;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ── Helpers ───────────────────────────────────────────────────────────────────

function labelForValue(field: string, val: string | null | undefined): string {
  if (val == null) return '—';
  if (field === 'payment_status') return PAYMENT_LABELS[val] ?? val;
  if (field.endsWith('_sum')) return `${parseFloat(val).toFixed(2)} млн ₽`;
  return val || '—';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  record: ClosureObject;
  onClose: () => void;
  onSaved: (updated: ClosureObject) => void;
}

export default function ClosureEditModal({ record, onClose, onSaved }: Props) {
  const { profile } = useAuth();

  // Editable field state (sums stored as mln strings for the input)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(record.payment_status);
  const [mogaeApproved, setMogaeApproved] = useState(record.mogae_approved ?? '');
  const [mogaeStatus, setMogaeStatus]     = useState<MogaeStatus | ''>(record.mogae_status ?? '');
  const [contractMln, setContractMln]     = useState(fmtMlnInput(record.contract_sum));
  const [paidMln, setPaidMln]             = useState(fmtMlnInput(record.paid_sum));
  const [remainMln, setRemainMln]         = useState(fmtMlnInput(record.remaining_sum));
  const [autoRemain, setAutoRemain]       = useState(false);
  const [comment, setComment]             = useState(record.comment ?? '');
  const [smr, setSmr]                     = useState(record.smr_completed ?? '');
  const [smrPct, setSmrPct]               = useState(record.smr_pct ?? '');
  const [idKs, setIdKs]                   = useState(record.id_ks_submitted ?? '');
  const [typicalBlock]                    = useState(record.typical_block ?? '');
  const [cause, setCause]                 = useState(record.typical_cause ?? '');
  const [causeSmr, setCauseSmr]           = useState(record.typical_cause_smr ?? '');
  const [causeIdks, setCauseIdks]           = useState(record.typical_cause_idks ?? '');
  const [causePayment, setCausePayment]     = useState(record.typical_cause_payment ?? '');
  const [paymentReason, setPaymentReason] = useState(record.payment_reason ?? '');
  const [paymentDate, setPaymentDate]     = useState(record.payment_date ?? '');
  const [actions, setActions]             = useState(record.actions ?? '');
  // Реквизиты контракта
  const [contractNumber, setContractNumber]       = useState(record.contract_number ?? '');
  const [federalLaw, setFederalLaw]               = useState(record.federal_law ?? '');
  const [contractLink, setContractLink]           = useState(record.contract_link ?? '');
  const [pikContractLink, setPikContractLink]     = useState(record.pik_contract_link ?? '');

  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState('');
  const [history, setHistory]   = useState<ClosureChange[]>([]);
  const [histLoad, setHistLoad] = useState(true);
  const [showHist, setShowHist] = useState(false);

  // Auto-remaining
  useEffect(() => {
    if (autoRemain) {
      const r = parseMln(contractMln) - parseMln(paidMln);
      setRemainMln(fmtMlnInput(Math.max(0, r)));
    }
  }, [autoRemain, contractMln, paidMln]);

  const loadHistory = useCallback(async () => {
    setHistLoad(true);
    const { data } = await supabase
      .from('closure_changes')
      .select('*')
      .eq('object_id', record.id)
      .order('changed_at', { ascending: false })
      .limit(30);
    setHistory(data ?? []);
    setHistLoad(false);
  }, [record.id]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const handleSave = async () => {
    setSaving(true);
    setSaveErr('');

    const updates: Partial<ClosureObject> = {
      payment_status:  paymentStatus,
      mogae_approved:  mogaeApproved || null,
      mogae_status:    mogaeStatus || null,
      contract_sum:   parseMln(contractMln),
      paid_sum:       parseMln(paidMln),
      remaining_sum:  parseMln(remainMln),
      comment,
      smr_completed:     smr || null,
      smr_pct:           smrPct || null,
      id_ks_submitted:   idKs || null,
      typical_block:     typicalBlock || null,
      typical_cause:         cause || null,
      typical_cause_smr:     causeSmr || null,
      typical_cause_idks:    causeIdks || null,
      typical_cause_payment: causePayment || null,
      payment_reason: paymentReason || null,
      payment_date:   paymentDate || null,
      actions,
      contract_number:   contractNumber || null,
      federal_law:       federalLaw || null,
      contract_link:     contractLink || null,
      pik_contract_link: pikContractLink || null,
    };

    // Compute diff for audit log
    const changedFields: Array<{ field_name: string; old_value: string | null; new_value: string | null }> = [];

    const checkField = (field: string, oldVal: unknown, newVal: unknown) => {
      const oldStr = oldVal == null ? null : String(oldVal);
      const newStr = newVal == null ? null : String(newVal);
      if (oldStr !== newStr) changedFields.push({ field_name: field, old_value: oldStr, new_value: newStr });
    };

    checkField('payment_status', record.payment_status, updates.payment_status);
    checkField('mogae_approved', record.mogae_approved, updates.mogae_approved);
    checkField('mogae_status',   record.mogae_status,   updates.mogae_status);
    checkField('contract_sum',   record.contract_sum,   updates.contract_sum);
    checkField('paid_sum',       record.paid_sum,       updates.paid_sum);
    checkField('remaining_sum',  record.remaining_sum,  updates.remaining_sum);
    checkField('comment',        record.comment,        updates.comment);
    checkField('smr_completed',     record.smr_completed,     updates.smr_completed);
    checkField('smr_pct',           record.smr_pct,           updates.smr_pct);
    checkField('id_ks_submitted',   record.id_ks_submitted,   updates.id_ks_submitted);
    checkField('typical_block',     record.typical_block,     updates.typical_block);
    checkField('typical_cause',         record.typical_cause,         updates.typical_cause);
    checkField('typical_cause_smr',     record.typical_cause_smr,     updates.typical_cause_smr);
    checkField('typical_cause_idks',    record.typical_cause_idks,    updates.typical_cause_idks);
    checkField('typical_cause_payment', record.typical_cause_payment, updates.typical_cause_payment);
    checkField('payment_reason',        record.payment_reason,        updates.payment_reason);
    checkField('payment_date',      record.payment_date,      updates.payment_date);
    checkField('actions',           record.actions,           updates.actions);
    checkField('contract_number',   record.contract_number,   updates.contract_number);
    checkField('federal_law',       record.federal_law,       updates.federal_law);
    checkField('contract_link',     record.contract_link,     updates.contract_link);
    checkField('pik_contract_link', record.pik_contract_link, updates.pik_contract_link);

    if (changedFields.length === 0) { setSaving(false); onClose(); return; }

    const { error: updErr } = await supabase
      .from('closure_objects')
      .update(updates)
      .eq('id', record.id);

    if (updErr) { setSaveErr(updErr.message); setSaving(false); return; }

    // Log each changed field to audit trail
    if (changedFields.length > 0 && profile) {
      const { error: auditErr } = await supabase.from('closure_changes').insert(
        changedFields.map(cf => ({
          object_id:  record.id,
          user_id:    profile.id,
          user_name:  profile.full_name || profile.email,
          ...cf,
        }))
      );
      if (auditErr) {
        // Audit failure is non-blocking but surfaced
        console.error('Audit log failed:', auditErr.message);
      }
    }

    setSaving(false);
    onSaved({ ...record, ...updates });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">
              {record.omsu}{record.uin ? <span className="ml-2 font-mono text-teal-600">УИН: {record.uin}</span> : null}
            </p>
            <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">
              {record.object_name}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Payment status */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Статус оплаты
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['paid','partial','not_paid','terminated'] as PaymentStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setPaymentStatus(s)}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-semibold transition text-center ${
                    paymentStatus === s
                      ? s === 'paid'       ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : s === 'partial'    ? 'border-amber-500  bg-amber-50  text-amber-700'
                      : s === 'not_paid'   ? 'border-[#E93A58]  bg-[#FFF0F3] text-[#E93A58]'
                      :                     'border-slate-400   bg-slate-100 text-slate-600'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {PAYMENT_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* МОГЭ approved + status */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              📋 МОГЭ — Контрольная точка 1
            </label>
            <div className="space-y-2 p-3 bg-red-50 rounded-xl border border-red-100">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Положительное заключение получено</label>
                <div className="flex gap-2">
                  {['Да', 'Нет', ''].map(v => (
                    <button key={v}
                      onClick={() => setMogaeApproved(v)}
                      className={`py-1.5 px-4 rounded-xl border-2 text-xs font-semibold transition ${
                        mogaeApproved === v
                          ? v === 'Да' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : v === 'Нет' ? 'border-red-400 bg-red-50 text-red-700'
                          : 'border-slate-400 bg-slate-100 text-slate-500'
                          : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {v === '' ? '— Не указано' : v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Статус захода в МОГЭ</label>
                <div className="grid grid-cols-3 gap-2">
                  {MOGAE_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setMogaeStatus(mogaeStatus === o.value ? '' : o.value)}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-medium transition text-left ${
                        mogaeStatus === o.value
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sums */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Суммы (млн ₽)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox" checked={autoRemain}
                  onChange={e => setAutoRemain(e.target.checked)}
                  className="rounded"
                />
                Остаток = Договор − Оплачено
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { label: 'Сумма договора', val: contractMln, set: setContractMln, locked: false },
                  { label: 'Оплачено',       val: paidMln,     set: setPaidMln,     locked: false },
                  { label: 'Остаток',        val: remainMln,   set: setRemainMln,   locked: autoRemain },
                ] as Array<{ label: string; val: string; set: (v: string) => void; locked: boolean }>
              ).map(f => (
                <div key={f.label}>
                  <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
                  <input
                    type="number" step="0.01"
                    value={f.val}
                    readOnly={f.locked}
                    onChange={e => f.set(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-400 transition ${
                      f.locked ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' : 'border-slate-200 bg-white'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Комментарий
            </label>
            <textarea
              value={comment} onChange={e => setComment(e.target.value)} rows={3}
              placeholder="Введите комментарий…"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            />
          </div>

          {/* Payment date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Дата оплаты</label>
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Обоснование оплаты</label>
            <textarea
              value={paymentReason} onChange={e => setPaymentReason(e.target.value)} rows={2}
              placeholder="Статус согласования ИД, ссылки на документы…"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            />
          </div>
          {/* Checkpoints section */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Контрольные точки
            </label>
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              {/* СМР */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">🏗️ СМР завершено</label>
                <select value={smr} onChange={e => setSmr(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                  <option value="">— Не указано</option>
                  <option value="Да">Да</option>
                  <option value="Нет">Нет</option>
                </select>
              </div>
              {/* СГ% */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">📊 Строительная готовность, %</label>
                <input value={smrPct} onChange={e => setSmrPct(e.target.value)}
                  placeholder="Напр.: 85%"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              {/* ИД/КС */}
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">📁 ИД и КС сданы в УТНКР</label>
                <select value={idKs} onChange={e => setIdKs(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white">
                  <option value="">— Не указано</option>
                  <option value="Да">Да</option>
                  <option value="Нет">Нет</option>
                  <option value="Частично">Частично</option>
                </select>
              </div>
            </div>
          </div>

          {/* Causes by block */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Типовые причины по блокам
            </label>
            <div className="space-y-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
              <CauseSelect
                label="Блок 1 — Причина по МОГЭ"
                emoji="📋"
                value={cause}
                onChange={setCause}
                options={CAUSE_MOGAE_OPTIONS}
              />
              <CauseSelect
                label="Блок 2 — Причина по СМР"
                emoji="🏗️"
                value={causeSmr}
                onChange={setCauseSmr}
                options={CAUSE_SMR_OPTIONS}
              />
              <CauseSelect
                label="Блок 3 — Причина по ИД и КС"
                emoji="📁"
                value={causeIdks}
                onChange={setCauseIdks}
                options={CAUSE_IDKS_OPTIONS}
              />
              <CauseSelect
                label="Блок 4 — Причина по оплате"
                emoji="💳"
                value={causePayment}
                onChange={setCausePayment}
                options={CAUSE_PAYMENT_OPTIONS}
              />
            </div>
          </div>

          {/* Contract details */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              📄 Реквизиты контракта
            </label>
            <div className="space-y-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Номер контракта</label>
                  <input value={contractNumber} onChange={e => setContractNumber(e.target.value)}
                    placeholder="№ контракта"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Какое ФЗ</label>
                  <input value={federalLaw} onChange={e => setFederalLaw(e.target.value)}
                    placeholder="44-ФЗ / 223-ФЗ / …"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ссылка на контракт (zakupki.gov)</label>
                <input type="url" value={contractLink} onChange={e => setContractLink(e.target.value)}
                  placeholder="https://zakupki.gov.ru/…"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ссылка на контракт в ПИК</label>
                <input type="url" value={pikContractLink} onChange={e => setPikContractLink(e.target.value)}
                  placeholder="https://pik.ru/…"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Действия</label>
            <input value={actions} onChange={e => setActions(e.target.value)} placeholder="Принятые меры"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>

          {saveErr && (
            <p className="text-sm text-[#E93A58] bg-[#FFF0F3] border border-[#FFB3BF] rounded-xl px-3 py-2">{saveErr}</p>
          )}

          {/* History accordion */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowHist(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2"><History size={15} /> История изменений ({history.length})</span>
              <ChevronDown size={15} className={`transition-transform ${showHist ? 'rotate-180' : ''}`} />
            </button>
            {showHist && (
              <div className="border-t border-slate-100 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {histLoad ? (
                  <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-slate-300" size={20} /></div>
                ) : history.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">Изменений не зафиксировано</div>
                ) : history.map(h => (
                  <div key={h.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-slate-700">{FIELD_LABELS[h.field_name] ?? h.field_name}</span>
                      <span className="text-[10px] text-slate-400">{fmtDate(h.changed_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 line-through">{labelForValue(h.field_name, h.old_value)}</span>
                      <span className="text-slate-300">→</span>
                      <span className="text-teal-700 font-medium">{labelForValue(h.field_name, h.new_value)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{h.user_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl transition disabled:opacity-50">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-60">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
