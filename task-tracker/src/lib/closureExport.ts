import * as XLSX from 'xlsx';
import type { ClosureObject } from '../types';

// ── Labels ────────────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  paid:       'Оплачено полностью',
  partial:    'Оплачено частично',
  not_paid:   'Не оплачено',
  terminated: 'Расторгнуто',
};

const MOGAE_STATUS_LABELS: Record<string, string> = {
  'Заходили':            'Заходили',
  'В МОГЭ':              'В МОГЭ',
  'Не заходили ни разу': 'Не заходили ни разу',
};

const fmtMln = (v: number | null | undefined) =>
  v != null ? parseFloat((v / 1_000_000).toFixed(2)) : null;

// ── Row builder ───────────────────────────────────────────────────────────────

function toRow(r: ClosureObject) {
  return {
    'УИН':                   r.uin ?? '',
    'ОМСУ':                  r.omsu,
    'Мероприятие':           r.object_name,
    'Подрядчик':             r.contractor,
    'Тип объекта':           r.object_type ?? '',
    'Статус оплаты':         PAYMENT_LABELS[r.payment_status] ?? r.payment_status,
    'Сумма договора, млн':   fmtMln(r.contract_sum),
    'Оплачено, млн':         fmtMln(r.paid_sum),
    'Остаток, млн':          fmtMln(r.remaining_sum),
    'Дата оплаты':           r.payment_date ?? '',
    'Статус МОГЭ':           MOGAE_STATUS_LABELS[r.mogae_status ?? ''] ?? '',
    'МОГЭ одобрено':         r.mogae_approved ?? '',
    'СМР завершено':         r.smr_completed ?? '',
    'Строительная готовность, %': r.smr_pct ?? '',
    'ИД и КС сданы':         r.id_ks_submitted ?? '',
    'Блок причин':           r.typical_block ?? '',
    'Типовая причина МОГЭ':  r.typical_cause ?? '',
    'Типовая причина СМР':   r.typical_cause_smr ?? '',
    'Типовая причина ИД/КС': r.typical_cause_idks ?? '',
    'Типовая причина оплаты':r.typical_cause_payment ?? '',
    'Обоснование оплаты':    r.payment_reason ?? '',
    'Действия':              r.actions ?? '',
    'Комментарий':           r.comment ?? '',
    'Номер контракта':       r.contract_number ?? '',
    'ФЗ':                    r.federal_law ?? '',
    'Ссылка zakupki.gov':    r.contract_link ?? '',
    'Ссылка ПИК':            r.pik_contract_link ?? '',
    'Дата среза':            r.snapshot_date ?? '',
  };
}

// ── Contractor summary row ────────────────────────────────────────────────────

function toContractorRow(contractor: string, rows: ClosureObject[]) {
  const total  = rows.length;
  const paid   = rows.filter(r => r.payment_status === 'paid').length;
  const partial= rows.filter(r => r.payment_status === 'partial').length;
  const notPaid= rows.filter(r => r.payment_status === 'not_paid').length;
  const term   = rows.filter(r => r.payment_status === 'terminated').length;
  const sumContract = rows.reduce((s, r) => s + (r.contract_sum ?? 0), 0);
  const sumPaid     = rows.reduce((s, r) => s + (r.paid_sum ?? 0), 0);
  const sumRemain   = rows.reduce((s, r) => s + (r.remaining_sum ?? 0), 0);
  return {
    'Подрядчик':           contractor,
    'Всего объектов':      total,
    'Оплачено полностью':  paid,
    'Оплачено частично':   partial,
    'Не оплачено':         notPaid,
    'Расторгнуто':         term,
    '% оплаты':            total > 0 ? parseFloat(((paid / total) * 100).toFixed(1)) : 0,
    'Сумма договоров, млн': fmtMln(sumContract),
    'Оплачено, млн':        fmtMln(sumPaid),
    'Остаток, млн':         fmtMln(sumRemain),
  };
}

// ── Schedule row ──────────────────────────────────────────────────────────────

function toScheduleRow(r: ClosureObject) {
  return {
    'Дата оплаты':         r.payment_date ?? '',
    'УИН':                 r.uin ?? '',
    'ОМСУ':                r.omsu,
    'Мероприятие':         r.object_name,
    'Подрядчик':           r.contractor,
    'Статус оплаты':       PAYMENT_LABELS[r.payment_status] ?? r.payment_status,
    'Сумма договора, млн': fmtMln(r.contract_sum),
    'Оплачено, млн':       fmtMln(r.paid_sum),
    'Остаток, млн':        fmtMln(r.remaining_sum),
    'Обоснование оплаты':  r.payment_reason ?? '',
    'Комментарий':         r.comment ?? '',
  };
}

// ── Sheet helpers ─────────────────────────────────────────────────────────────

function makeSheet<T extends object>(rows: T[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto-width: max(header length, max cell length) for each column, capped at 60
  const colWidths: number[] = [];
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    headers.forEach((h, i) => {
      const maxData = rows.reduce((mx, row) => {
        const v = String((row as Record<string, unknown>)[h] ?? '');
        return Math.max(mx, v.length);
      }, 0);
      colWidths[i] = Math.min(60, Math.max(h.length, maxData) + 2);
    });
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
  }
  return ws;
}

// ── Main export function ──────────────────────────────────────────────────────

export type ExportVariant =
  | 'all'
  | 'paid'
  | 'partial'
  | 'not_paid'
  | 'terminated'
  | 'contractors'
  | 'schedule'
  | 'full';   // all variants as separate sheets in one workbook

export const EXPORT_LABELS: Record<ExportVariant, string> = {
  all:         'Все объекты',
  paid:        'Оплачены полностью',
  partial:     'Оплачены частично',
  not_paid:    'Не оплачено',
  terminated:  'Расторгнуто',
  contractors: 'Подрядчики',
  schedule:    'График оплаты',
  full:        'Полный отчёт (все листы)',
};

export function exportClosureObjects(rows: ClosureObject[], variant: ExportVariant) {
  const wb = XLSX.utils.book_new();
  const date = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');

  if (variant === 'all' || variant === 'full') {
    XLSX.utils.book_append_sheet(wb, makeSheet(rows.map(toRow)), 'Все объекты');
  }
  if (variant === 'paid' || variant === 'full') {
    const paidRows = rows.filter(r => r.payment_status === 'paid');
    XLSX.utils.book_append_sheet(wb, makeSheet(paidRows.map(toRow)), 'Оплачены полностью');
  }
  if (variant === 'partial' || variant === 'full') {
    const partRows = rows.filter(r => r.payment_status === 'partial');
    XLSX.utils.book_append_sheet(wb, makeSheet(partRows.map(toRow)), 'Оплачены частично');
  }
  if (variant === 'not_paid' || variant === 'full') {
    const npRows = rows.filter(r => r.payment_status === 'not_paid');
    XLSX.utils.book_append_sheet(wb, makeSheet(npRows.map(toRow)), 'Не оплачено');
  }
  if (variant === 'terminated' || variant === 'full') {
    const termRows = rows.filter(r => r.payment_status === 'terminated');
    XLSX.utils.book_append_sheet(wb, makeSheet(termRows.map(toRow)), 'Расторгнуто');
  }
  if (variant === 'contractors' || variant === 'full') {
    const byContractor: Record<string, ClosureObject[]> = {};
    rows.forEach(r => {
      if (!byContractor[r.contractor]) byContractor[r.contractor] = [];
      byContractor[r.contractor].push(r);
    });
    const contractorRows = Object.entries(byContractor)
      .sort(([a], [b]) => a.localeCompare(b, 'ru'))
      .map(([c, objs]) => toContractorRow(c, objs));
    XLSX.utils.book_append_sheet(wb, makeSheet(contractorRows), 'Подрядчики');
  }
  if (variant === 'schedule' || variant === 'full') {
    const scheduleRows = rows
      .filter(r => r.payment_date)
      .sort((a, b) => (a.payment_date ?? '').localeCompare(b.payment_date ?? ''))
      .map(toScheduleRow);
    XLSX.utils.book_append_sheet(wb, makeSheet(scheduleRows), 'График оплаты');
  }

  const filename = variant === 'full'
    ? `Закрытие_объектов_полный_${date}.xlsx`
    : `Закрытие_${EXPORT_LABELS[variant].replace(/\s+/g, '_')}_${date}.xlsx`;

  XLSX.writeFile(wb, filename);
}
