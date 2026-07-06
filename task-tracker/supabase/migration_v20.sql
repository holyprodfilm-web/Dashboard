-- Migration v20: user_achievements table for gamification system
-- Note: this schema was first applied as v13 on 2026-07-06.
-- This file ensures fresh sequential environments that may have skipped v13
-- also receive the table, since all statements use IF NOT EXISTS / IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT user_achievements_unique UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS user_achievements_user_idx
  ON public.user_achievements (user_id);

CREATE INDEX IF NOT EXISTS user_achievements_notified_idx
  ON public.user_achievements (user_id, notified)
  WHERE notified = FALSE;

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_achievements'
      AND policyname = 'users_own_achievements_select'
  ) THEN
    CREATE POLICY "users_own_achievements_select" ON public.user_achievements
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_achievements'
      AND policyname = 'users_own_achievements_insert'
  ) THEN
    CREATE POLICY "users_own_achievements_insert" ON public.user_achievements
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_achievements'
      AND policyname = 'users_own_achievements_update'
  ) THEN
    CREATE POLICY "users_own_achievements_update" ON public.user_achievements
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_achievements'
      AND policyname = 'authenticated_count_select'
  ) THEN
    CREATE POLICY "authenticated_count_select" ON public.user_achievements
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;
