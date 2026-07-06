---
name: NTS module
description: Architecture and constraints for the НТС (Научно-технический совет) module added in migration_v16.
---

## Schema

5 tables:
- `nts_entries` — main НТС record per GP object (linked by `object_uin`)
- `nts_sessions` — ВКС sessions with remarks, FK → nts_entries
- `nts_doc_rounds` — document receipt rounds, FK → nts_entries
- `nts_checklist_items` — 61 static items seeded from Excel; do NOT re-seed (guarded by COUNT check)
- `nts_checklist_responses` — per-round, per-item, per-role answers; UNIQUE(round_id, item_id, respondent_role)

## Role

`module_responsible` role added. profiles_role_check constraint updated in migration v16b to include it.

**Why:** Existing constraint in migration_v5.sql only covered 4 roles; assigning module_responsible would fail at DB level without v16b patch.

## RLS

All NTS tables use RLS enabled + `FOR ALL TO authenticated USING (true)` — same open pattern as existing app tables.

## Checklist readiness logic

Item passes when all 3 respondent_roles (rp/rp2/responsible) have status = 'ok' OR 'na'. Any 'fail' or 'clarify' → red warning, no VKS allowed.

## Protocol file storage

Files uploaded to Supabase Storage bucket `protocols` at path `nts/{entry_id}/protocol_{timestamp}_{filename}`.

## Navigation

NTS module accessed via HomePage card (id: 'nts') or setView('nts') in App.tsx. hasModule('nts') guard checks role_permissions.
