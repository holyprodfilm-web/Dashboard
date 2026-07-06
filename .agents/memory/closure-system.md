---
name: Closure system (Закрытие объектов)
description: Edit/audit/import implementation for closure_objects module
---

## Tables
- `closure_objects` — main data, RLS: admin/manager/analyst can write, all authenticated read
  - Key columns: payment_date DATE (migration_v7), typical_block, typical_cause, payment_reason
- `closure_changes` — audit trail: object_id, user_id, user_name, field_name, old_value, new_value, changed_at
  - RLS: all authenticated read; insert only with user_id = auth.uid()

## Tabs in ClosureView
1. **Оплаты** — KPI cards, donut chart, МОГЭ breakdown, objects table (default)
2. **Подрядчики** — aggregated by contractor, expandable rows
3. **Причины** — grouped by typical_block → typical_cause (skip paid/terminated)
4. **График оплаты** — PaymentScheduleTab: groups Просрочено/До30дней/Более30дней/Без даты
5. **Динамика** — payment dynamics over snapshot dates
6. **История** — moved OUT of tabs → separate button in header → opens right-side drawer

## Edit flow (ClosureEditModal)
Editable fields: payment_status, mogae_status, contract/paid/remaining sums, comment, typical_block (NEW), typical_cause, payment_date (NEW date picker), payment_reason (NEW), smr_completed, actions
- Updates closure_objects, logs each change to closure_changes
- Audit failures are non-blocking (logged to console)

## Import flow (ClosureImportModal)
- Uses XLSX library
- Column auto-detection: Russian headers, case-insensitive
- **payment_date** detected from: 'дата оплаты', 'плановая дата оплаты', 'крайняя дата оплаты', 'срок оплаты'
- **Sum unit must be explicit** (млн or ₽ toggle) — heuristic-based multiplication is unsafe
- Import uses `.insert()` — each import creates new snapshot records

## payment_date display in ObjectsTable
- overdue (< today, not paid/terminated): red `#E93A58` background row + ⚠ icon
- soon (0–30 days): amber text
- paid/terminated: never shown as overdue or soon regardless of date
- isSoon requires `daysDiff >= 0` to avoid false amber on past paid rows

## TypeScript pitfall
Using `as const` on arrays with optional fields produces hard-to-resolve union types.
**Fix:** use typed array: `[] as Array<{ locked: boolean; ... }>` instead of `as const`.

## ImportField type
Must include `'payment_date'` or COL_DETECT entry causes TS2322 build error. Always keep ImportField, COL_DETECT, ParsedRow, and row mapping in sync when adding new fields.

## Migrations applied
- v4: closure_objects table creation
- v4b: payment_reason column
- v5: districts, analyst role, role_permissions
- v6: closure_changes audit table, analyst write access
- v7: payment_date DATE column
