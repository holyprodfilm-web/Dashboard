/**
 * Импорт closure_objects из Excel через Supabase Management API
 * Очищает таблицу и вставляет новые данные из файла
 * Батчи по 5 строк (защита от OOM)
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');
const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────
const EXCEL_PATH = path.resolve(__dirname, '../../attached_assets/Оплаты_по_объектам_2025_года_(6)_1783410089422.xlsx');
const PROJECT_REF = 'tegnewquutxbjmepyfgt';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const BATCH_SIZE = 5;
const SNAPSHOT_DATE = '2026-07-07';

if (!ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN не задан');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizePayment(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'да' || s === 'оплачено') return 'paid';
  if (s === 'частично') return 'partial';
  if (s === 'контракт расторгнут' || s === 'расторгнуто') return 'terminated';
  return 'not_paid';
}

function normalizeMogae(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'заходили') return 'Заходили';
  if (s === 'в могэ') return 'В МОГЭ';
  if (s === 'не заходили ни разу' || s === 'не заходили') return 'Не заходили ни разу';
  return null;
}

function isValidDate(d) {
  return d instanceof Date && !isNaN(d.getTime());
}

function normalizeDate(v) {
  if (!v && v !== 0) return null;
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000);
    return isValidDate(d) ? d.toISOString().slice(0, 10) : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    // Validate: clamp impossible days (e.g. Nov 31 → null)
    const yr = parseInt(m[3]), mo = parseInt(m[2]), dy = parseInt(m[1]);
    const d = new Date(yr, mo - 1, dy);
    if (d.getFullYear() !== yr || d.getMonth() !== mo - 1 || d.getDate() !== dy) return null;
    return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  // ISO string like "2026-11-31" — also validate
  const parts = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (parts) {
    const yr = parseInt(parts[1]), mo = parseInt(parts[2]), dy = parseInt(parts[3]);
    const d = new Date(yr, mo - 1, dy);
    if (d.getFullYear() !== yr || d.getMonth() !== mo - 1 || d.getDate() !== dy) return null;
    return s;
  }
  const d = new Date(s);
  return isValidDate(d) ? d.toISOString().slice(0, 10) : null;
}

function normalizeSum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Math.round(v);
  const n = parseFloat(String(v).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : Math.round(n);
}

function normalizePct(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Excel decimal (0.9 → "90%") или уже целое (90 → "90%")
    const pct = v <= 1 ? Math.round(v * 100) : Math.round(v);
    return String(pct) + '%';
  }
  return String(v).trim() || null;
}

function esc(s) {
  if (s == null) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// ── Parse Excel ───────────────────────────────────────────────────────────────
console.log('📖 Читаю Excel...');
const buf  = fs.readFileSync(EXCEL_PATH);
const wb   = XLSX.read(buf, { type: 'buffer' });
const ws   = wb.Sheets[wb.SheetNames[0]]; // "Оплата объектов"
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// Строка 0 — заголовки, строка 1 — итоги, данные с строки 2
const data = [];
for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  const omsu       = String(r[1] ?? '').trim();
  const objectName = String(r[2] ?? '').trim();
  if (!omsu || !objectName) continue; // пропускаем пустые

  const mogaeStatus = normalizeMogae(r[6]);

  data.push({
    uin:               String(r[0] ?? '').trim() || null,
    omsu,
    object_name:       objectName,
    contractor:        String(r[3] ?? '').trim() || null,
    object_type:       String(r[4] ?? '').trim() || null,
    mogae_approved:    String(r[5] ?? '').trim() || null,
    mogae_status:      mogaeStatus,
    typical_cause:     String(r[7] ?? '').trim() || null,
    smr_completed:     String(r[8] ?? '').trim() || null,
    typical_cause_smr: String(r[10] ?? '').trim() || null,
    smr_pct:           normalizePct(r[11]),
    payment_status:    normalizePayment(r[12]),
    contract_sum:      normalizeSum(r[13]),
    paid_sum:          normalizeSum(r[14]),
    remaining_sum:     normalizeSum(r[15]),
    typical_cause_payment: String(r[17] ?? '').trim() || null,
    typical_cause_idks: String(r[22] ?? '').trim() || null,
    id_ks_submitted:   String(r[18] ?? '').trim() || null,
    payment_reason:    String(r[24] ?? '').trim() || null,
    actions:           String(r[25] ?? '').trim() || null,
    payment_date:      normalizeDate(r[26]),
    comment:           String(r[28] ?? '').trim() || null,
    snapshot_date:     SNAPSHOT_DATE,
  });
}

console.log(`✅ Распознано строк: ${data.length}`);

// ── Management API ────────────────────────────────────────────────────────────
function mgmtQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req  = https.request({
      hostname: 'api.supabase.com',
      path:     `/v1/projects/${PROJECT_REF}/database/query`,
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
        resolve(JSON.parse(raw));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function rowToValues(row) {
  return `(${[
    esc(row.uin),
    esc(row.omsu),
    esc(row.object_name),
    esc(row.contractor),
    esc(row.object_type),
    esc(row.mogae_approved),
    esc(row.mogae_status),
    esc(row.typical_cause),
    esc(row.smr_completed),
    esc(row.typical_cause_smr),
    esc(row.smr_pct),
    esc(row.payment_status),
    row.contract_sum,
    row.paid_sum,
    row.remaining_sum,
    esc(row.typical_cause_payment),
    esc(row.typical_cause_idks),
    esc(row.id_ks_submitted),
    esc(row.payment_reason),
    esc(row.actions),
    row.payment_date ? esc(row.payment_date) : 'NULL',
    esc(row.comment),
    esc(row.snapshot_date),
  ].join(',')})`;
}

const COLS = `uin,omsu,object_name,contractor,object_type,mogae_approved,mogae_status,
typical_cause,smr_completed,typical_cause_smr,smr_pct,payment_status,
contract_sum,paid_sum,remaining_sum,typical_cause_payment,typical_cause_idks,id_ks_submitted,
payment_reason,actions,payment_date,comment,snapshot_date`.replace(/\n/g, '');

async function run() {
  // 1. Очищаем таблицу
  console.log('🗑️  Очищаю таблицу closure_objects...');
  await mgmtQuery('TRUNCATE TABLE closure_objects RESTART IDENTITY CASCADE;');
  console.log('✅ Таблица очищена');

  // 2. Вставляем батчами
  const total   = data.length;
  let   inserted = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch  = data.slice(i, i + BATCH_SIZE);
    const values = batch.map(rowToValues).join(',\n');
    const sql    = `INSERT INTO closure_objects (${COLS}) VALUES ${values};`;

    try {
      await mgmtQuery(sql);
      inserted += batch.length;
      process.stdout.write(`\r📥 Вставлено: ${inserted}/${total}`);
    } catch (err) {
      console.error(`\n❌ Ошибка на строках ${i}–${i + BATCH_SIZE}:`, err.message);
      // Продолжаем
    }

    // Пауза 150мс между батчами
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\n✅ Готово! Вставлено ${inserted} из ${total} строк.`);
}

run().catch(err => {
  console.error('❌ Критическая ошибка:', err);
  process.exit(1);
});
