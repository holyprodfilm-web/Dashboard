---
name: NTS module
description: Architecture and key decisions for the НТС (scientific-technical council) module
---

## Tables
- `nts_entries` — main record (object, contractor, costs, rp_main_id, rp2_id, status)
- `nts_doc_rounds` — documentation rounds per entry (received_date, presentation_date, remarks_issued_at, checklist_approved)
- `nts_checklist_items` — 61 static checklist items (seeded once)
- `nts_checklist_responses` — per-round per-role responses (rp/rp2/responsible)
- `nts_sessions` — legacy, no longer used in UI

## Workflow rules
- Status is **auto-computed** from rounds state (`computeStatus()` in NtsEntryModal.tsx) — no manual dropdown
- Status saved on: round created, round field updated, checklist approved
- Sessions tab removed — meeting date now lives on `nts_doc_rounds.presentation_date`
- Protocol tab is **locked** until last round's checklist is fully approved (`checklist_approved = true`)

## Carry-forward remarks
- On new round creation: fail/clarify responses from previous round are copied into new round with `[Раунд N]` prefix
- Only rounds where actual copying happened show the carry-over banner (tracked via `roundsWithCarryover` state Set)

## Auto-contractor
- When an object is selected in NtsEntryModal, contractor is auto-fetched from `closure_objects.contractor` where `uin` matches

## Role constraint
- `module_responsible` role requires the v16b constraint patch (migration applied)
- RLS is open for authenticated users on NTS tables

## Status computation
- No rounds → `rp_review`
- Latest round has `remarks_issued_at` → `remarks_fix`
- Latest round has `presentation_date` (no remarks yet) → `vks_scheduled`
- Latest round `checklist_approved` + excess ≤ 30% → `below_30`
- Latest round `checklist_approved` + excess > 30% → `positive_mogae`

**Why:** positive_mogae is tied to cost threshold because there's no separate MOGAE outcome field in the DB. This is a known approximation.
