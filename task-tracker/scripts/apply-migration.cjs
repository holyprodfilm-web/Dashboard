#!/usr/bin/env node
/**
 * Applies a SQL migration file via Supabase Management API.
 * Usage: node scripts/apply-migration.cjs <path-to-sql-file>
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const ACCESS_TOKEN  = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !ACCESS_TOKEN) { console.error('Missing env vars'); process.exit(1); }

const PROJECT_REF = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

function runSQL(sql) {
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
      let buf = ''; res.on('data', d => buf += d);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

async function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile) { console.error('Usage: node apply-migration.cjs <file.sql>'); process.exit(1); }

  const sql = fs.readFileSync(path.resolve(sqlFile), 'utf8');
  console.log(`📄 Applying ${path.basename(sqlFile)} (${sql.length} chars)…`);

  // Split on statement boundaries and run each; or just run whole file
  // The management API handles multi-statement SQL fine for small files
  const ping = await runSQL('SELECT 1');
  if (ping.status >= 400) { console.error('❌ API unreachable:', ping.body.slice(0,200)); process.exit(1); }

  // Run the whole migration
  const res = await runSQL(sql);
  if (res.status >= 400) {
    console.error('❌ Migration failed:', res.status, res.body.slice(0,500));
    process.exit(1);
  }
  console.log('✅ Migration applied successfully');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
