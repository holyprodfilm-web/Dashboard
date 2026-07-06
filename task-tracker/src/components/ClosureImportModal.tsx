import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import type { PaymentStatus, MogaeStatus } from '../types';

// ── Column auto-detection ─────────────────────────────────────────────────────

type ImportField = 'uin' | 'omsu' | 'object_name' | 'contractor' | 'object_type'
  | 'mogae_approved' | 'mogae_status' | 'typical_block' | 'smr_completed'
  | 'payment_status' | 'contract_sum' | 'paid_sum' | 'remaining_sum'
  | 'typical_cause' | 'payment_reason' | 'payment_date' | 'actions' | 'comment' | 'snapshot_date';

const REQUIRED_FIELDS: ImportField[] = ['omsu', 'object_name'];

const COL_DETECT: Array<{ field: ImportField; patterns: string[] }> = [
  { field: 'uin',            patterns: ['уин', 'uin'] },
  { field: 'omsu',           patterns: ['омсу', 'omsu', 'муниципал', 'район', 'округ'] },
  { field: 'object_name',    patterns: ['мероприятие', 'объект', 'наименование', 'object'] },
  { field: 'contractor',     patterns: ['подрядчик', 'contractor', 'исполнитель'] },
  { field: 'object_type',    patterns: ['тип объекта', 'тип', 'object_type'] },
  { field: 'mogae_approved', patterns: ['одобрено могэ', 'могэ одобрено', 'approved'] },
  { field: 'mogae_status',   patterns: ['статус в могэ', 'статус могэ', 'mogae'] },
  { field: 'payment_date',   patterns: ['дата оплаты', 'плановая дата оплаты', 'крайняя дата оплаты', 'payment_date', 'срок оплаты'] },
  { field: 'typical_block',  patterns: ['типовой блок', 'блок', 'block'] },
  { field: 'smr_completed',  patterns: ['смр', 'smr', 'строительно'] },
  { field: 'payment_status', patterns: ['статус оплаты', 'payment_status', 'оплата статус'] },
  { field: 'contract_sum',   patterns: ['сумма договора', 'договор', 'контракт', 'contract'] },
  { field: 'paid_sum',       patterns: ['оплачено, млн', 'оплачено', 'paid'] },
  { field: 'remaining_sum',  patterns: ['остаток', 'remain', 'задолженность'] },
  { field: 'typical_cause',  patterns: ['типовая причина', 'причина', 'cause'] },
  { field: 'payment_reason', patterns: ['причина оплаты', 'payment_reason'] },
  { field: 'actions',        patterns: ['действия', 'action'] },
  { field: 'comment',        patterns: ['комментарий', 'примечание', 'comment'] },
  { field: 'snapshot_date',  patterns: ['дата среза', 'дата', 'date', 'snapshot'] },
];

function detectColumns(headers: string[]): Partial<Record<ImportField, string>> {
  const mapping: Partial<Record<ImportField, string>> = {};
  for (const { field, patterns } of COL_DETECT) {
    const found = headers.find(h => patterns.some(p => h.toLowerCase().includes(p)));
    if (found) mapping[field] = found;
  }
  return mapping;
}

// ── Value normalization ───────────────────────────────────────────────────────

const PAYMENT_MAP: Record<string, PaymentStatus> = {
  'оплачено полностью': 'paid',   'оплачено': 'paid', 'paid': 'paid',
  'оплачено частично': 'partial', 'частично': 'partial', 'partial': 'partial',
  'не оплачено': 'not_paid',      'не опл': 'not_paid', 'not_paid': 'not_paid',
  'расторгнуто': 'terminated',    'terminated': 'terminated',
};

const MOGAE_MAP: Record<string, MogaeStatus> = {
  'заходили':            'Заходили',
  'в могэ':             'В МОГЭ',
  'не заходили ни разу': 'Не заходили ни разу',
  'не заходили':        'Не заходили ни разу',
};

function normalizePayment(v: unknown): PaymentStatus {
  const s = String(v ?? '').trim().toLowerCase();
  return PAYMENT_MAP[s] ?? 'not_paid';
}

function normalizeMogae(v: unknown): MogaeStatus | null {
  const s = String(v ?? '').trim().toLowerCase();
  return MOGAE_MAP[s] ?? null;
}

// Unit: 'mln' = value in Excel is millions (multiply ×1 000 000), 'rub' = already rubles
function normalizeSum(v: unknown, unit: 'mln' | 'rub'): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
  if (isNaN(n)) return 0;
  return unit === 'mln' ? Math.round(n * 1_000_000) : Math.round(n);
}

function normalizeDate(v: unknown): string {
  if (!v) return new Date().toISOString().slice(0, 10);
  if (typeof v === 'number') {
    // Excel serial date
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // Try DD.MM.YYYY
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onImported: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done' | 'error';

interface ParsedRow {
  omsu: string;
  object_name: string;
  uin: string | null;
  contractor: string;
  object_type: string | null;
  mogae_approved: string | null;
  mogae_status: MogaeStatus | null;
  typical_block: string | null;
  smr_completed: string | null;
  payment_status: PaymentStatus;
  contract_sum: number;
  paid_sum: number;
  remaining_sum: number;
  typical_cause: string | null;
  payment_reason: string | null;
  payment_date: string | null;
  actions: string;
  comment: string;
  snapshot_date: string;
}

export default function ClosureImportModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep]             = useState<Step>('upload');
  const [fileName, setFileName]     = useState('');
  const [rows, setRows]             = useState<ParsedRow[]>([]);
  const [progress, setProgress]     = useState(0);
  const [imported, setImported]     = useState(0);
  const [errMsg, setErrMsg]         = useState('');
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10));
  const [sumUnit, setSumUnit]           = useState<'mln' | 'rub'>('mln');

  const parseFile = useCallback((file: File, unit: 'mln' | 'rub') => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!raw.length) { setErrMsg('Файл пуст или нераспознан.'); setStep('error'); return; }

        const headers = Object.keys(raw[0]);
        const colMap = detectColumns(headers);

        const missing = REQUIRED_FIELDS.filter(f => !colMap[f]);
        if (missing.length > 0) {
          setErrMsg(`Не удалось найти обязательные колонки: ${missing.join(', ')}. ` +
            `Найденные заголовки: ${headers.slice(0, 8).join(', ')}…`);
          setStep('error'); return;
        }

        const getStr = (row: Record<string, unknown>, field: ImportField): string =>
          String(row[colMap[field] ?? ''] ?? '').trim();

        const parsed: ParsedRow[] = raw.map(row => {
          const contractSum = normalizeSum(colMap.contract_sum ? row[colMap.contract_sum!] : 0, unit);
          const paidSum     = normalizeSum(colMap.paid_sum     ? row[colMap.paid_sum!]     : 0, unit);
          const remainSum   = colMap.remaining_sum
            ? normalizeSum(row[colMap.remaining_sum], unit)
            : Math.max(0, contractSum - paidSum);

          return {
            omsu:           getStr(row, 'omsu'),
            object_name:    getStr(row, 'object_name'),
            uin:            getStr(row, 'uin') || null,
            contractor:     getStr(row, 'contractor'),
            object_type:    getStr(row, 'object_type') || null,
            mogae_approved: getStr(row, 'mogae_approved') || null,
            mogae_status:   normalizeMogae(colMap.mogae_status ? row[colMap.mogae_status!] : ''),
            typical_block:  getStr(row, 'typical_block') || null,
            smr_completed:  getStr(row, 'smr_completed') || null,
            payment_status: normalizePayment(colMap.payment_status ? row[colMap.payment_status!] : ''),
            contract_sum:   contractSum,
            paid_sum:       paidSum,
            remaining_sum:  remainSum,
            typical_cause:  getStr(row, 'typical_cause') || null,
            payment_reason: getStr(row, 'payment_reason') || null,
            payment_date:   colMap.payment_date
              ? (normalizeDate(row[colMap.payment_date!]) || null)
              : null,
            actions:        getStr(row, 'actions'),
            comment:        getStr(row, 'comment'),
            snapshot_date:  colMap.snapshot_date
              ? normalizeDate(row[colMap.snapshot_date!])
              : snapshotDate,
          };
        }).filter(r => r.omsu && r.object_name);

        setRows(parsed);
        setStep('preview');
      } catch (ex: unknown) {
        setErrMsg('Ошибка парсинга: ' + (ex instanceof Error ? ex.message : String(ex)));
        setStep('error');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [snapshotDate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file, sumUnit);
  };

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);
    let done = 0;
    const BATCH = 20;

    // Use snapshot date from picker if rows have default date
    const rowsToInsert = rows.map(r => ({
      ...r,
      snapshot_date: r.snapshot_date || snapshotDate,
    }));

    for (let i = 0; i < rowsToInsert.length; i += BATCH) {
      const batch = rowsToInsert.slice(i, i + BATCH);
      const { error } = await supabase.from('closure_objects').insert(batch);
      if (error) { setErrMsg(error.message); setStep('error'); return; }
      done += batch.length;
      setProgress(Math.round((done / rowsToInsert.length) * 100));
    }

    setImported(done);
    setStep('done');
  };

  const fmtMln = (v: number) => (v / 1e6).toFixed(1) + ' млн';

  const PAYMENT_COLORS: Record<PaymentStatus, string> = {
    paid: 'text-emerald-600', partial: 'text-amber-600',
    not_paid: 'text-[#E93A58]', terminated: 'text-slate-400',
  };
  const PAYMENT_LABELS: Record<PaymentStatus, string> = {
    paid: 'Оплачено', partial: 'Частично', not_paid: 'Не оплачено', terminated: 'Расторгнуто',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={22} className="text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">Импорт из Excel</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step: upload */}
          {(step === 'upload' || step === 'error') && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Загрузите файл Excel (.xlsx, .xls). Система автоматически распознает колонки.
                Обязательные колонки: <strong>ОМСУ</strong> и <strong>Мероприятие (объект)</strong>.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">Дата среза</label>
                <input type="date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                <span className="text-xs text-slate-400">Если в файле нет даты</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">Суммы в файле</label>
                <div className="flex gap-1">
                  {(['mln', 'rub'] as const).map(u => (
                    <button key={u} onClick={() => setSumUnit(u)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                        sumUnit === u ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-500 border-slate-200 hover:border-teal-300'
                      }`}>
                      {u === 'mln' ? 'Миллионы (млн ₽)' : 'Рубли (₽)'}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-400">Выберите, в каких единицах записаны суммы в Excel</span>
              </div>

              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-teal-400 rounded-2xl p-12 text-center cursor-pointer transition group"
              >
                <Upload size={36} className="mx-auto text-slate-300 group-hover:text-teal-400 transition mb-3" />
                <p className="text-sm font-semibold text-slate-600 group-hover:text-teal-600">
                  Нажмите для выбора файла
                </p>
                <p className="text-xs text-slate-400 mt-1">.xlsx / .xls</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
              </div>

              {step === 'error' && (
                <div className="flex items-start gap-3 p-4 bg-[#FFF0F3] border border-[#FFB3BF] rounded-xl">
                  <AlertCircle size={18} className="text-[#E93A58] shrink-0 mt-0.5" />
                  <p className="text-sm text-[#c42d49]">{errMsg}</p>
                </div>
              )}
            </div>
          )}

          {/* Step: preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
                <FileSpreadsheet size={18} className="text-teal-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-teal-800">{fileName}</p>
                  <p className="text-xs text-teal-600">Распознано {rows.length} строк для импорта</p>
                </div>
                <button onClick={() => { setStep('upload'); setRows([]); }}
                  className="text-xs text-teal-600 hover:underline">Изменить файл</button>
              </div>

              <p className="text-xs text-slate-500">Предпросмотр первых 5 строк:</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs min-w-[800px]">
                  <thead className="bg-slate-50 text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">ОМСУ</th>
                      <th className="px-3 py-2 text-left">Объект</th>
                      <th className="px-3 py-2 text-left">Подрядчик</th>
                      <th className="px-3 py-2 text-center">Статус</th>
                      <th className="px-3 py-2 text-right">Договор</th>
                      <th className="px-3 py-2 text-right">Оплачено</th>
                      <th className="px-3 py-2 text-left">Дата среза</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 text-[#8A4C08] font-semibold whitespace-nowrap">{r.omsu}</td>
                        <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{r.object_name}</td>
                        <td className="px-3 py-2 text-slate-500 max-w-[120px] truncate">{r.contractor || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs font-semibold ${PAYMENT_COLORS[r.payment_status]}`}>
                            {PAYMENT_LABELS[r.payment_status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMln(r.contract_sum)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{fmtMln(r.paid_sum)}</td>
                        <td className="px-3 py-2 text-slate-400">{r.snapshot_date}</td>
                      </tr>
                    ))}
                    {rows.length > 5 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-2 text-center text-slate-400">
                          … и ещё {rows.length - 5} строк
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step: importing */}
          {step === 'importing' && (
            <div className="py-16 text-center space-y-4">
              <Loader2 size={40} className="mx-auto animate-spin text-teal-500" />
              <p className="text-sm font-semibold text-slate-700">Импортируется… {progress}%</p>
              <div className="max-w-xs mx-auto h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="py-16 text-center space-y-4">
              <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
              <p className="text-xl font-bold text-slate-800">Готово!</p>
              <p className="text-sm text-slate-500">Успешно добавлено <strong>{imported}</strong> записей.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          {step === 'done' ? (
            <button onClick={onImported}
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition">
              <CheckCircle2 size={15} /> Готово
            </button>
          ) : step === 'preview' ? (
            <>
              <button onClick={() => { setStep('upload'); setRows([]); }} disabled={false}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl transition">
                Назад
              </button>
              <button onClick={handleImport}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition">
                Импортировать {rows.length} строк <ChevronRight size={15} />
              </button>
            </>
          ) : step !== 'importing' ? (
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl transition">
              Закрыть
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
