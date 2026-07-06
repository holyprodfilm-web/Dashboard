---
name: Closure system (Закрытие объектов)
description: Edit/audit/import implementation for closure_objects module
---

## Tables
- `closure_objects` — main data, RLS: admin/manager/analyst can write, all authenticated read
- `closure_changes` — audit trail: object_id, user_id, user_name, field_name, old_value, new_value, changed_at
  - RLS: all authenticated read; insert only with user_id = auth.uid()

## Edit flow (ClosureEditModal)
- Computes diff between original and new values
- Updates closure_objects, then inserts into closure_changes for each changed field
- These are NOT transactional (Supabase anon key can't run transactions); audit failures are logged but non-blocking
- Optimistic updates not used — waits for DB response

## Import flow (ClosureImportModal)
- Uses XLSX library (already in package.json: "xlsx": "^0.18.5")
- Column auto-detection: matches Russian column headers case-insensitively
- **Critical:** sum unit must be explicit user choice (млн or ₽) — heuristic-based multiplication is unsafe and corrupts data
- Import uses `.insert()` not `.upsert()` — each import creates new records (snapshot data model)
- Required columns: omsu + object_name; others auto-detected

## TypeScript pitfall
Using `as const` on arrays with optional fields (like `locked?: boolean`) produces hard-to-resolve union types.
**Fix:** use typed array syntax: `[] as Array<{ locked: boolean; ... }>` instead of `as const`.

## canEdit check
```typescript
const canEdit = ['admin', 'manager', 'analyst'].includes(profile?.role ?? '');
```
Used in ClosureView to show/hide edit buttons and import button.
