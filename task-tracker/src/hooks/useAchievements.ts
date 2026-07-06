import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { computeEarnedAchievements, getAchievementById, type Achievement } from '../lib/achievements';

export interface ToastAchievement {
  achievement: Achievement;
  earnedAt: string;
}

interface UseAchievementsReturn {
  pendingToasts: ToastAchievement[];
  dismissToast: (achievementId: string) => void;
  recheck: () => void;
}

export function useAchievements(userId: string | undefined): UseAchievementsReturn {
  const [pendingToasts, setPendingToasts] = useState<ToastAchievement[]>([]);
  const checkingRef = useRef(false);

  const checkAchievements = useCallback(async () => {
    if (!userId || checkingRef.current) return;
    checkingRef.current = true;

    try {
      // Get currently earned achievement IDs from computation
      // If computation throws (e.g. DB error), abort — don't mutate stored state
      let earned: string[];
      try {
        earned = await computeEarnedAchievements(userId, supabase);
      } catch (computeErr) {
        console.warn('[useAchievements] compute failed, skipping mutation:', computeErr);
        return;
      }

      // Get already stored achievements
      const { data: existing } = await supabase
        .from('user_achievements')
        .select('achievement_id, earned_at, notified')
        .eq('user_id', userId);

      const existingMap = new Map(
        (existing ?? []).map(e => [e.achievement_id, e])
      );

      // For negative achievements: find categories and remove lower tiers that no longer apply
      const negCategories = ['nts_overdue', 'tasks_overdue'];
      for (const prefix of negCategories) {
        const earnedInCat = earned.filter(id => id.startsWith(prefix));
        const storedInCat = [...existingMap.keys()].filter(id => id.startsWith(prefix));

        // Remove stored negative achievements that are no longer in earned list
        for (const storedId of storedInCat) {
          if (!earnedInCat.includes(storedId)) {
            await supabase
              .from('user_achievements')
              .delete()
              .eq('user_id', userId)
              .eq('achievement_id', storedId);
            existingMap.delete(storedId);
          }
        }
      }

      // Insert newly earned achievements
      const newlyEarned: ToastAchievement[] = [];
      for (const achievementId of earned) {
        if (!existingMap.has(achievementId)) {
          const earnedAt = new Date().toISOString();
          const { error } = await supabase
            .from('user_achievements')
            .insert({ user_id: userId, achievement_id: achievementId, earned_at: earnedAt, notified: false })
            .select()
            .single();

          if (!error) {
            const ach = getAchievementById(achievementId);
            if (ach) {
              newlyEarned.push({ achievement: ach, earnedAt });
            }
          }
        }
      }

      // Also pick up any un-notified achievements from previous sessions
      const { data: unnotified } = await supabase
        .from('user_achievements')
        .select('achievement_id, earned_at')
        .eq('user_id', userId)
        .eq('notified', false);

      const allPending: ToastAchievement[] = [];
      const seenIds = new Set(newlyEarned.map(t => t.achievement.id));

      for (const row of (unnotified ?? [])) {
        if (!seenIds.has(row.achievement_id)) {
          const ach = getAchievementById(row.achievement_id);
          if (ach) {
            allPending.push({ achievement: ach, earnedAt: row.earned_at });
            seenIds.add(row.achievement_id);
          }
        }
      }

      const combined = [...newlyEarned, ...allPending];
      if (combined.length > 0) {
        setPendingToasts(prev => {
          const existingIds = new Set(prev.map(t => t.achievement.id));
          return [...prev, ...combined.filter(t => !existingIds.has(t.achievement.id))];
        });
      }
    } finally {
      checkingRef.current = false;
    }
  }, [userId]);

  // Check on mount and user change
  useEffect(() => {
    if (userId) {
      void checkAchievements();
    }
  }, [userId, checkAchievements]);

  const dismissToast = useCallback(async (achievementId: string) => {
    setPendingToasts(prev => prev.filter(t => t.achievement.id !== achievementId));
    if (userId) {
      await supabase
        .from('user_achievements')
        .update({ notified: true })
        .eq('user_id', userId)
        .eq('achievement_id', achievementId);
    }
  }, [userId]);

  return {
    pendingToasts,
    dismissToast,
    recheck: checkAchievements,
  };
}
