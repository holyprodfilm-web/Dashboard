-- Migration v13: user_achievements table for gamification system

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT user_achievements_unique UNIQUE (user_id, achievement_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS user_achievements_user_idx ON public.user_achievements (user_id);
CREATE INDEX IF NOT EXISTS user_achievements_notified_idx ON public.user_achievements (user_id, notified) WHERE notified = FALSE;

-- RLS
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can read/insert/update their own achievements
CREATE POLICY "users_own_achievements_select" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_own_achievements_insert" ON public.user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_achievements_update" ON public.user_achievements
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can read all achievements (for % of employees stats)
CREATE POLICY "admin_achievements_select" ON public.user_achievements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow any authenticated user to read achievement counts for statistics
-- (needed for "X% of colleagues earned this" feature)
CREATE POLICY "authenticated_count_select" ON public.user_achievements
  FOR SELECT USING (auth.role() = 'authenticated');
