import * as XLSX from 'xlsx';
import { unzipSync, zipSync } from 'fflate';
import { supabase } from './supabase';
import type { NtsEntry, NtsDocRound, NtsChecklistItem, NtsChecklistResponse, Profile } from '../types';
import { NTS_STATUS_CONFIG, NTS_PROTOCOL_STATUS_CONFIG, NTS_CHECKLIST_STATUS } from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): number | string {
  if (n == null) return '';
  return n;
}

/** Returns a JS Date for Excel date-serial storage, or '' when absent. */
function fmtDateExcel(d: string | null | undefined): Date | string {
  if (!d) return '';
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? '' : parsed;
}

/** Legacy string formatter kept for the checklist round label. */
function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('ru-RU');
}

/** Returns numeric ratio (e.g. 0.052) for proper Excel % formatting, or '' */
function excessPctNum(entry: NtsEntry): number | string {
  if (!entry.contract_cost) return '';
  return (entry.pre_nts_cost - entry.contract_cost) / entry.contract_cost;
}

// Apply a number format string to every data cell in a column (rows 1..lastRow)
function applyColFormat(ws: XLSX.WorkSheet, col: number, fmt: string) {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = 1; r <= range.e.r; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: col });
    if (!ws[ref]) continue;
    ws[ref].z = fmt;
  }
}

// Apply a simple header style (bold, light-blue fill) to the first row
function styleHeader(ws: XLSX.WorkSheet, cols: number) {
  for (let c = 0; c < cols; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'C7D9F0' }, patternType: 'solid' },
      alignment: { wrapText: true, vertical: 'center' },
      border: {
        bottom: { style: 'thin', color: { rgb: '888888' } },
      },
    };
  }
}

// ── Registry sheet ────────────────────────────────────────────────────────────

function buildRegistrySheet(
  entries: NtsEntry[],
  profileMap: Map<string, Profile>,
): XLSX.WorkSheet {
  const rpName = (id: string | null) =>
    id ? (profileMap.get(id)?.full_name ?? '—') : '—';

  const headers = [
    'Объект',
    'УИН',
    'Подрядчик',
    'Статус НТС',
    'Статус протокола',
    'Контрактная стоимость, тыс. руб.',
    'Стоимость до НТС, тыс. руб.',
    'Стоимость после НТС, тыс. руб.',
    'Стоимость МОГЭ, тыс. руб.',
    'Превышение, %',
    'Главный РП',
    'РП2',
    'Номер протокола',
    'Дата протокола',
    'Примечания',
  ];

  const rows = entries.map(e => [
    e.object_name,
    e.object_uin,
    e.contractor,
    NTS_STATUS_CONFIG[e.status]?.label ?? e.status,
    e.protocol_status ? (NTS_PROTOCOL_STATUS_CONFIG[e.protocol_status]?.label ?? '') : '',
    fmt(e.contract_cost),      // col 5
    fmt(e.pre_nts_cost),       // col 6
    fmt(e.post_nts_cost),      // col 7
    fmt(e.mogae_cost),         // col 8
    excessPctNum(e),           // col 9
    rpName(e.rp_main_id),
    rpName(e.rp2_id),
    e.protocol_number ?? '',
    fmtDateExcel(e.protocol_date), // col 13
    e.notes ?? '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Column widths
  ws['!cols'] = [
    { wch: 50 }, // Объект
    { wch: 14 }, // УИН
    { wch: 30 }, // Подрядчик
    { wch: 26 }, // Статус НТС
    { wch: 26 }, // Статус протокола
    { wch: 18 }, // Контракт
    { wch: 18 }, // До НТС
    { wch: 18 }, // После НТС
    { wch: 18 }, // МОГЭ
    { wch: 12 }, // Превышение
    { wch: 22 }, // РП
    { wch: 22 }, // РП2
    { wch: 18 }, // № протокола
    { wch: 14 }, // Дата протокола
    { wch: 40 }, // Примечания
  ];

  // Number formats: cost cols (#,##0), excess % (0.0%), date (DD.MM.YYYY)
  applyColFormat(ws, 5,  '#,##0');
  applyColFormat(ws, 6,  '#,##0');
  applyColFormat(ws, 7,  '#,##0');
  applyColFormat(ws, 8,  '#,##0');
  applyColFormat(ws, 9,  '0.0%');
  applyColFormat(ws, 13, 'DD.MM.YYYY');

  styleHeader(ws, headers.length);
  return ws;
}

// ── Checklist sheet ───────────────────────────────────────────────────────────

function buildChecklistSheet(
  entries: NtsEntry[],
  rounds: NtsDocRound[],
  items: NtsChecklistItem[],
  responses: NtsChecklistResponse[],
  profileMap: Map<string, Profile>,
): XLSX.WorkSheet {
  void profileMap; // profileMap reserved for future RP name columns

  const statusLabel = (s: string | null) =>
    s ? (NTS_CHECKLIST_STATUS[s as keyof typeof NTS_CHECKLIST_STATUS]?.label ?? s) : '—';

  const headers = [
    'Объект',
    'УИН',
    'Подрядчик',
    'Раунд № (дата получения)',
    '№ п/п',
    'Раздел',
    'Пункт чек-листа',
    // rp columns
    'РП — ответ',
    'РП — комментарий',
    // rp2 columns
    'РП2 — ответ',
    'РП2 — комментарий',
    // responsible columns
    'Ответственный — ответ',
    'Ответственный — комментарий',
  ];

  const rows: (string | number)[][] = [];

  for (const entry of entries) {
    const entryRounds = rounds.filter(r => r.nts_entry_id === entry.id);
    if (entryRounds.length === 0) continue;

    for (const [roundIdx, round] of entryRounds.entries()) {
      const roundLabel = `Раунд ${roundIdx + 1} (${fmtDate(round.received_date)})`;
      const roundResponses = responses.filter(r => r.round_id === round.id);

      for (const item of items) {
        const getResp = (role: string) =>
          roundResponses.find(r => r.item_id === item.id && r.respondent_role === role);

        const rpR = getResp('rp');
        const rp2R = getResp('rp2');
        const respR = getResp('responsible');

        rows.push([
          entry.object_name,
          entry.object_uin,
          entry.contractor,
          roundLabel,
          item.item_num,
          item.section_title ?? '',
          item.description,
          statusLabel(rpR?.status ?? null),
          rpR?.comment ?? '',
          statusLabel(rp2R?.status ?? null),
          rp2R?.comment ?? '',
          statusLabel(respR?.status ?? null),
          respR?.comment ?? '',
        ]);
      }
    }
  }

  if (rows.length === 0) {
    rows.push(['Нет данных чек-листов', '', '', '', '', '', '', '', '', '', '', '', '']);
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws['!cols'] = [
    { wch: 50 }, // Объект
    { wch: 14 }, // УИН
    { wch: 30 }, // Подрядчик
    { wch: 30 }, // Раунд
    { wch: 6  }, // №
    { wch: 30 }, // Раздел
    { wch: 60 }, // Пункт
    { wch: 18 }, // РП ответ
    { wch: 30 }, // РП комм.
    { wch: 18 }, // РП2 ответ
    { wch: 30 }, // РП2 комм.
    { wch: 18 }, // Ответств. ответ
    { wch: 30 }, // Ответств. комм.
  ];

  styleHeader(ws, headers.length);
  return ws;
}

// ── Freeze-pane injection (post-processing) ───────────────────────────────────

const FREEZE_PANE_XML =
  '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
  '<selection pane="bottomLeft"/>';

/**
 * xlsx 0.18.x does not write freeze panes natively.
 * We post-process the raw XLSX ZIP bytes: for every worksheet XML we find the
 * self-closing <sheetView .../> element written by xlsx and replace it with
 * an open/close pair that includes the <pane state="frozen"> child.
 */
function injectFreezePanes(xlsxBytes: Uint8Array): Uint8Array {
  const files = unzipSync(xlsxBytes);

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const out: Record<string, [Uint8Array, { level: 0 }]> = {};

  for (const [path, bytes] of Object.entries(files)) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) {
      let xml = decoder.decode(bytes);

      // Replace self-closing <sheetView .../> with open/close version + pane
      xml = xml.replace(
        /(<(?:\w+:)?sheetView\b[^>]*?)\/>/g,
        `$1>${FREEZE_PANE_XML}</sheetView>`,
      );

      out[path] = [encoder.encode(xml), { level: 0 }];
    } else {
      out[path] = [bytes, { level: 0 }];
    }
  }

  return zipSync(out);
}

// ── Main export function ──────────────────────────────────────────────────────

export async function exportNtsToExcel(
  entries: NtsEntry[],
  rounds: NtsDocRound[],
  profiles: Profile[],
): Promise<void> {
  // Fetch checklist items (template) and all responses for these rounds
  const roundIds = rounds.map(r => r.id);

  const [itemsRes, respRes] = await Promise.all([
    supabase.from('nts_checklist_items').select('*').order('sort_order'),
    roundIds.length > 0
      ? supabase.from('nts_checklist_responses').select('*').in('round_id', roundIds)
      : Promise.resolve({ data: [] as NtsChecklistResponse[], error: null }),
  ]);

  const items = (itemsRes.data ?? []) as NtsChecklistItem[];
  const responses = (respRes.data ?? []) as NtsChecklistResponse[];
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  const wb = XLSX.utils.book_new();

  const registrySheet = buildRegistrySheet(entries, profileMap);
  XLSX.utils.book_append_sheet(wb, registrySheet, 'Реестр НТС');

  const checklistSheet = buildChecklistSheet(entries, rounds, items, responses, profileMap);
  XLSX.utils.book_append_sheet(wb, checklistSheet, 'Чек-листы');

  // Write to raw bytes, inject freeze panes, then trigger download
  // XLSX.write returns an ArrayBuffer (browser) or Buffer (Node); convert to
  // Uint8Array so fflate's unzipSync always receives the expected type.
  const rawBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true }) as ArrayBuffer | Uint8Array;
  const rawBytes = rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer);
  const patchedBytes = injectFreezePanes(rawBytes);

  const date = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');
  const blob = new Blob([(patchedBytes.buffer as ArrayBuffer).slice(patchedBytes.byteOffset, patchedBytes.byteOffset + patchedBytes.byteLength)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `НТС_реестр_${date}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
