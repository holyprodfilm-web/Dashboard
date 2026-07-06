---
name: Supabase seeding from Replit
description: How to insert bulk data into Supabase from Replit without Supabase dashboard access
---

## Approach
Use Supabase Management API (`POST /v1/projects/{ref}/database/query`) with `SUPABASE_ACCESS_TOKEN`.

**Why:** Direct PostgreSQL port 5432 is blocked from Replit. Anon key is blocked by RLS. Management API runs as superuser.

**OOM issue:** Large SQL strings (100+ rows per batch) trigger Redis OOM on Supabase management API. Use batches of 5 rows max.

**Temporary policy approach (not recommended):** Creating/dropping anon INSERT policy works but creates a security window. Prefer management API direct inserts.

## How to apply
- Script: `task-tracker/scripts/seed-closure.cjs` — reads JSON, inserts via management API in 5-row batches
- Script: `task-tracker/scripts/apply-migration.cjs <file.sql>` — applies any SQL migration file via management API

## Data source
- Excel → JSON: use XLSX package in Node.js (installed in task-tracker)
- JSON: `attached_assets/closure_objects.json` (500 rows)
