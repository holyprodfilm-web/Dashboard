#!/usr/bin/env node
/**
 * Nightly backup: exports all key tables from Supabase
 * and stores the snapshot in the database_backups table.
 * Retains last 30 backups; older rows are deleted automatically.
 *
 * Run manually:  node scripts/backup.cjs
 * Scheduled:     Replit scheduled deployment at 23:00 MSK
 */
'use strict';
const https = require('https');

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const ACCESS_TOKEN  = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !ACCESS_TOKEN) {
  console.error('❌ Missing env vars: VITE_SUPABASE_URL, SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const PROJECT_REF = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

// Tables to back up
const TABLES = [
  'addresses',
  'closure_objects',
  'closure_changes',
  'tasks',
  'task_links',
  'meetings',
  'meeting_attachments',
  'profiles',
  'role_permissions',
  'nts_entries',
  'nts_sessions',
  'nts_doc_rounds',
  'nts_checklist_responses',
];

function mgmtQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { resolve(buf); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// Fetch ALL rows from a table, paginating in batches of 500
async function fetchAllRows(table) {
  const all = [];
  const BATCH = 500;
  let offset = 0;
  while (true) {
    const rows = await mgmtQuery(
      `SELECT * FROM public.${table} ORDER BY 1 LIMIT ${BATCH} OFFSET ${offset}`
    );
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < BATCH) break;
    offset += BATCH;
  }
  return all;
}

async function main() {
  const now = new Date();
  // Moscow time UTC+3
  const msk = new Date(now.getTime() + 3 * 3600 * 1000);
  const dateStr = msk.toISOString().slice(0, 10);
  const timeStr = msk.toISOString().slice(11, 16).replace(':', '-');
  const filename = `backup_${dateStr}_${timeStr}_MSK.json`;

  console.log(`\n🗄  Ночной бэкап АРМ — ${dateStr} ${timeStr} МСК`);
  console.log('─'.repeat(52));

  // 1. Export all tables via Management API (bypasses RLS)
  const backup = { created_at: now.toISOString(), tables: {} };
  const summary = {};

  for (const table of TABLES) {
    process.stdout.write(`  ⬇  ${table}…`);
    try {
      const rows = await fetchAllRows(table);
      backup.tables[table] = rows;
      summary[table] = rows.length;
      console.log(` ${summary[table]} строк`);
    } catch (e) {
      console.log(` ⚠ ошибка: ${e.message}`);
      backup.tables[table] = [];
      summary[table] = 0;
    }
  }

  const jsonStr = JSON.stringify(backup);
  const sizeBytes = Buffer.byteLength(jsonStr);
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
  console.log(`\n  📦 Размер бэкапа: ${sizeMB} МБ`);

  // 2. Save to database_backups table
  process.stdout.write(`  💾 Сохраняю в database_backups…`);
  const escaped = jsonStr.replace(/'/g, "''");
  const insertSQL = `
    INSERT INTO public.database_backups (filename, size_bytes, tables_summary, data)
    VALUES (
      '${filename}',
      ${sizeBytes},
      '${JSON.stringify(summary).replace(/'/g, "''")}'::jsonb,
      '${escaped}'::jsonb
    )
  `;
  const insertResult = await mgmtQuery(insertSQL);
  if (Array.isArray(insertResult)) {
    console.log(' ✅');
  } else {
    console.log(` ❌ ${JSON.stringify(insertResult)}`);
    process.exit(1);
  }

  // 3. Keep only last 30 backups
  console.log('  🧹 Удаляю старые бэкапы (старше 30)…');
  const cleanupSQL = `
    DELETE FROM public.database_backups
    WHERE id NOT IN (
      SELECT id FROM public.database_backups
      ORDER BY created_at DESC
      LIMIT 30
    )
    RETURNING id, filename
  `;
  const deleted = await mgmtQuery(cleanupSQL);
  if (Array.isArray(deleted) && deleted.length > 0) {
    console.log(`  🗑  Удалено ${deleted.length} старых бэкапов`);
  } else {
    const countRes = await mgmtQuery(`SELECT COUNT(*) as cnt FROM public.database_backups`);
    const cnt = Array.isArray(countRes) ? countRes[0]?.cnt : '?';
    console.log(`  ✓  Всего бэкапов в базе: ${cnt}`);
  }

  console.log(`\n✅ Бэкап завершён: ${filename}\n`);
}

main().catch(e => {
  console.error('❌ Критическая ошибка:', e.message);
  process.exit(1);
});
