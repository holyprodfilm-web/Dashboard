---
name: Role system and module permissions
description: How roles and module-level access control work in this app
---

## Roles
`admin | manager | analyst | guest`  
Previously `contractor` was renamed to `analyst` in migration_v5.sql.

**Why:** Business requirement — roles are Администратор, Руководитель проекта, Главный аналитик, Гость.

## Module permissions
Table: `role_permissions` (role, module, can_access BOOLEAN, features JSONB)  
Modules: `dashboard`, `objects`, `closure`  
Features per module: dashboard → create_meeting, delete_meeting; objects → delete_objects

**Admin is always full access** — never stored in role_permissions, hardcoded in `hasModule()`.

**Deny-by-default:** if `role_permissions` is loaded and no entry found → `false`. If not yet loaded (empty array) → allow (loading state).

## closure_objects write access
admin, manager, analyst can edit closure_objects (migration_v6.sql updated the policy).
guest can only read.

## How to apply
- `hasModule(module)` in App.tsx guards view rendering
- `moduleAccess` prop on HomePage filters visible module cards
- UsersView tab "Права доступа" — matrix UI, upserts to role_permissions via Supabase client

## Migration
- `migration_v5.sql` — applied: districts column, analyst role, role_permissions table + default rows
- `migration_v6.sql` — applied: closure_changes audit table, analyst write access to closure_objects
