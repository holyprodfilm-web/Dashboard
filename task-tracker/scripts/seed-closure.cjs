#!/usr/bin/env node
/**
 * Seeds closure_objects table via Supabase Management API.
 *
 * Uses SUPABASE_ACCESS_TOKEN (personal access token) which runs SQL as
 * a superuser — bypasses RLS without touching policies.
 *
 * Inserts in small batches (5 rows) to stay within management API memory limits.
 *
 * Usage:
 *   node scripts/seed-closure.cjs
 *
 * Required env vars (Replit secrets):
 *   VITE_SUPABASE_URL, SUPABASE_ACCESS_TOKEN
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const ACCESS_TOKEN  = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !ACCESS_TOKEN) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const PROJECT_REF = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

/** Execute a SQL statement via the Supabase Management API. */
function mgmtSQL(sql) {
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
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Abort if the management API call failed. */
function assertOk(label, { status, body }) {
  if (status >= 400) {
    throw new Error(`${label} failed (HTTP ${status}): ${body.slice(0, 300)}`);
  }
}

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v).trim();
  if (!s) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
}

function num(v) {
  if (v === null || v === undefined) return 'NULL';
  const n = parseFloat(String(v));
  return isNaN(n) ? 'NULL' : String(n);
}

async function main() {
  // ── Load source data ─────────────────────────────────────────────────────
  const jsonPath = path.resolve(__dirname, '../../attached_assets/closure_objects.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌  JSON not found:', jsonPath);
    console.error('    Run the Excel → JSON extraction script first.');
    process.exit(1);
  }
  const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📋  ${rows.length} rows loaded from JSON`);

  // ── Verify connectivity ───────────────────────────────────────────────────
  const ping = await mgmtSQL('SELECT 1 AS ok');
  assertOk('Connectivity check', ping);
  console.log('✅  Management API connected');

  // ── Clear existing data ───────────────────────────────────────────────────
  console.log('🗑️   Clearing closure_objects...');
  const clr = await mgmtSQL('TRUNCATE TABLE closure_objects RESTART IDENTITY CASCADE');
  assertOk('TRUNCATE', clr);
  console.log('    Cleared');

  // ── Insert in small batches to stay under management API memory limit ─────
  const CHUNK = 5;       // 5 rows ≈ safe SQL size for management API
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);

    const values = chunk.map(r =>
      `(${esc(r.uin)},${esc(r.omsu)},${esc(r.object_name)},${esc(r.contractor)},` +
      `${esc(r.object_type)},${esc(r.mogae_approved)},${esc(r.mogae_status)},` +
      `${esc(r.typical_block)},${esc(r.smr_completed)},${esc(r.payment_status)},` +
      `${num(r.contract_sum)},${num(r.paid_sum)},${num(r.remaining_sum)},` +
      `${esc(r.typical_cause)},${esc(r.payment_reason)},${esc(r.actions)},` +
      `${esc(r.comment)},'2025-12-31')`
    ).join(',\n');

    const sql =
      `INSERT INTO closure_objects ` +
      `(uin,omsu,object_name,contractor,object_type,mogae_approved,mogae_status,` +
      `typical_block,smr_completed,payment_status,contract_sum,paid_sum,remaining_sum,` +
      `typical_cause,payment_reason,actions,comment,snapshot_date) ` +
      `VALUES ${values}`;

    const res = await mgmtSQL(sql);
    assertOk(`INSERT batch ${i}–${i + chunk.length}`, res);

    inserted += chunk.length;
    process.stdout.write(`\r  ✔  ${inserted}/${rows.length}`);
  }

  console.log(`\n\n🎉  Done — ${inserted} объектов загружено в closure_objects.`);
}

main().catch(err => {
  console.error('\n❌ ', err.message);
  process.exit(1);
});
