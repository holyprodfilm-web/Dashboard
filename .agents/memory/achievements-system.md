---
name: Achievements system
description: Gamification/achievements system architecture, quirks, and key decisions
---

## DB table
`user_achievements` (migration v13, already applied):
- `user_id` → profiles(id), `achievement_id` TEXT, `earned_at`, `notified` BOOL
- UNIQUE(user_id, achievement_id)
- RLS: users manage own rows; authenticated users can read all (for % stats)

## Achievement definitions
All 28 achievements defined as static constants in `src/lib/achievements.ts`.
**Never in DB** — changing text/thresholds requires only a code deploy, no migration.

Modules: `nts` | `tasks` | `closure`
Kinds: `positive` (earned permanently) | `negative` (only highest active tier kept; lower tiers deleted when situation improves)

## Computation logic (`computeEarnedAchievements`)
- NTS views: count `nts_entries` where `rp_main_id = userId OR rp2_id = userId`
- Clean rounds: `nts_doc_rounds` with `checklist_approved=true` + inner join to `nts_entries.rp_main_id`
- Overdue NTS: rounds with no `remarks_issued_at`, not approved, received > 3 days ago
- Tasks: **tasks.responsible stores full_name, NOT uuid** — must look up profile.full_name first, then filter tasks by name
- On-time tasks: completed tasks that have a deadline (no completion timestamp in schema — can't be more precise)
- Closure: proxy via `closure_changes.user_id` — distinct object_id count = participation

**Why tasks use full_name:** The tasks table was designed before UUID-based assignments; changing it would be a separate migration.

## Hook (`useAchievements`)
- Runs on mount; calls `computeEarnedAchievements`; inserts new; deletes stale negative tiers
- If compute throws (DB error), aborts — does NOT mutate stored state
- Returns `pendingToasts` (unnotified achievements) for the toast queue

## Toast
- Bottom-right, 6s, animated shrink bar (CSS `@keyframes shrink-bar` in index.css)
- Queue: shows one at a time; next appears after dismiss
- Click opens UserProfileModal to achievements tab

## Known limitation
- `recheck()` is not yet called after relevant actions (task completion, NTS checklist approval) — only runs on app load. Follow-up task exists for this.
