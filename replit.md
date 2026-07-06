# АРМ мониторинга строительства объектов теплоснабжения МО

Web application for tracking protocol orders, meetings, and a facility registry for a state heat-supply construction programme.

## Stack

- React 19 + TypeScript
- Vite (dev server on port 5000)
- Tailwind CSS
- Supabase (Auth + PostgreSQL)

## How to run

The app lives in the `task-tracker/` subdirectory.

```bash
cd task-tracker && npm run dev
```

The workflow **Start application** handles this automatically.

## Required secrets

Set these in Replit Secrets before starting:

| Secret | Where to find it |
|--------|-----------------|
| `VITE_SUPABASE_URL` | Supabase project → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase project → Settings → API → anon/public key |

## Database setup

1. Create a project on [supabase.com](https://supabase.com)
2. Run `task-tracker/supabase/schema.sql` in the Supabase SQL Editor
3. Grant the first user the `admin` role in the `profiles` table

## User roles

| Role | Access |
|------|--------|
| **admin** | Full access, user management, deletion |
| **manager** | Create meetings and orders, edit own protocols |
| **contractor** | Update status of own orders |
| **guest** | Read-only |

## User preferences

- Keep the existing project structure; do not restructure or migrate the stack.
