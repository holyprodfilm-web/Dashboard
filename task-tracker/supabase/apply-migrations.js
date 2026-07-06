#!/usr/bin/env node
/**
 * Supabase migration runner — uses the Management API over HTTPS.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<token> VITE_SUPABASE_URL=<url> node supabase/apply-migrations.js
 *
 * Requires:
 *   SUPABASE_ACCESS_TOKEN — Supabase personal access token
 *     (Dashboard → Account → Access Tokens)
 *   VITE_SUPABASE_URL — project URL, e.g. https://<ref>.supabase.co
 *
 * Each migration is idempotent (CREATE OR REPLACE / CREATE … IF NOT EXISTS / IF NOT EXISTS policies).
 * Re-running is safe.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !ACCESS_TOKEN) {
  console.error(
    "Missing env vars: VITE_SUPABASE_URL and SUPABASE_ACCESS_TOKEN are required."
  );
  process.exit(1);
}

const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!PROJECT_REF) {
  console.error("Could not parse project ref from VITE_SUPABASE_URL:", SUPABASE_URL);
  process.exit(1);
}

const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

// ---------------------------------------------------------------------------
// Migrations (ordered)
// ---------------------------------------------------------------------------
const MIGRATIONS = [
  {
    name: "schema — base tables, RLS policies, handle_new_user trigger, bootstrap_first_admin RPC",
    file: "schema.sql",
  },
  {
    name: "migration_v2 — meeting_attachments table, task_links table, storage bucket setup notes",
    file: "migration_v2.sql",
  },
  {
    name: "migration_v3 — addresses write policies (insert/update/delete for admin)",
    file: "migration_v3.sql",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function runSQL(sql, label) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  // Management API returns [] for DDL that produces no rows — that is success.
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (Array.isArray(parsed) && parsed.length === 0) {
    return { ok: true, rows: 0 };
  }
  if (Array.isArray(parsed) && parsed[0]?.message) {
    throw new Error(parsed[0].message);
  }
  return { ok: true, rows: Array.isArray(parsed) ? parsed.length : 1, data: parsed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log(`\nSupabase migration runner`);
console.log(`Project: ${PROJECT_REF}`);
console.log(`─────────────────────────────────────────\n`);

let exitCode = 0;

for (const migration of MIGRATIONS) {
  const sqlPath = join(__dirname, migration.file);
  let sql;
  try {
    sql = readFileSync(sqlPath, "utf8");
  } catch (e) {
    console.error(`  ✗ Could not read ${migration.file}: ${e.message}`);
    exitCode = 1;
    continue;
  }

  process.stdout.write(`Applying: ${migration.name} … `);
  try {
    const result = await runSQL(sql, migration.name);
    console.log(`✓ (rows affected: ${result.rows})`);
  } catch (err) {
    // Tolerate "already exists" errors so reruns are safe.
    const msg = err.message ?? String(err);
    if (/already exists/i.test(msg)) {
      console.log(`✓ (already applied — skipped)`);
    } else {
      console.error(`✗\n  Error: ${msg}`);
      exitCode = 1;
    }
  }
}

console.log(`\n─────────────────────────────────────────`);
if (exitCode === 0) {
  console.log("All migrations applied successfully.\n");

  // Verify bootstrap_first_admin is present
  const { data } = await runSQL(
    `SELECT proname, prosecdef FROM pg_proc WHERE proname = 'bootstrap_first_admin'`,
    "verify"
  );
  if (data?.length) {
    console.log(
      `✓ bootstrap_first_admin confirmed in pg_proc (security_definer=${data[0].prosecdef})`
    );
  }

  // Report current admin count
  const { data: admins } = await runSQL(
    `SELECT COUNT(*) AS admin_count FROM public.profiles WHERE role = 'admin'`,
    "admin count"
  );
  if (admins?.length) {
    console.log(`✓ Admin users in profiles: ${admins[0].admin_count}`);
  }
  console.log();
} else {
  console.error("Some migrations failed — see errors above.\n");
  process.exit(exitCode);
}
