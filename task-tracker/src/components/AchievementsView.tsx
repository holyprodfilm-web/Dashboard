import { useEffect, useState, useMemo } from 'react';
import { Trophy, Lock, Users, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  ACHIEVEMENTS, groupAchievements, MODULE_LABELS,
  type AchievementModule,
} from '../lib/achievements';
import type { UserAchievement } from '../types';

interface Props {
  userId: string;
}

export default function AchievementsView({ userId }: Props) {
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [allCounts, setAllCounts] = useState<Record<string, number>>({});
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeModule, setActiveModule] = useState<AchievementModule>('nts');

  const load = async () => {
    setLoading(true);
    setError('');
    const [ownRes, allRes, profilesRes] = await Promise.all([
      supabase.from('user_achievements').select('*').eq('user_id', userId),
      supabase.from('user_achievements').select('achievement_id'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

    if (ownRes.error) { setError(ownRes.error.message); setLoading(false); return; }

    setUserAchievements((ownRes.data ?? []) as UserAchievement[]);

    // Count per achievement_id across all users
    // If global count query failed, degrade gracefully (hide % stats rather than crash)
    const counts: Record<string, number> = {};
    if (!allRes.error) {
      for (const row of (allRes.data ?? [])) {
        counts[row.achievement_id] = (counts[row.achievement_id] ?? 0) + 1;
      }
    }
    setAllCounts(counts);
    setTotalUsers(!profilesRes.error ? (profilesRes.count ?? 1) : 0);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const earnedSet = useMemo(
    () => new Set(userAchievements.map(ua => ua.achievement_id)),
    [userAchievements]
  );

  const earnedAtMap = useMemo(
    () => new Map(userAchievements.map(ua => [ua.achievement_id, ua.earned_at])),
    [userAchievements]
  );

  const grouped = groupAchievements();

  const modules: AchievementModule[] = ['nts', 'tasks', 'closure'];

  const earnedCountForModule = (mod: AchievementModule) =>
    ACHIEVEMENTS.filter(a => a.module === mod && earnedSet.has(a.id)).length;

  const totalForModule = (mod: AchievementModule) =>
    ACHIEVEMENTS.filter(a => a.module === mod).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
        Загрузка достижений…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-red-600">Не удалось загрузить достижения: {error}</p>
        <button
          onClick={() => void load()}
          className="text-sm text-amber-600 hover:underline"
        >
          Повторить
        </button>
      </div>
    );
  }

  const earnedTotal = earnedSet.size;
  const totalAll = ACHIEVEMENTS.length;

  return (
    <div className="space-y-6">
      {/* Header summary */}
      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl">
        <div className="text-4xl">🏆</div>
        <div>
          <div className="font-bold text-slate-900 text-lg">
            {earnedTotal} / {totalAll} достижений
          </div>
          <div className="text-sm text-slate-500">
            Разблокировано ачивок
          </div>
        </div>
        <div className="ml-auto">
          <div className="w-32 h-2 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-2 bg-amber-400 rounded-full transition-all"
              style={{ width: `${(earnedTotal / totalAll) * 100}%` }}
            />
          </div>
          <div className="text-xs text-amber-600 font-medium mt-1 text-right">
            {Math.round((earnedTotal / totalAll) * 100)}%
          </div>
        </div>
      </div>

      {/* Module tabs */}
      <div className="flex gap-2 flex-wrap">
        {modules.map(mod => {
          const cfg = MODULE_LABELS[mod];
          const earned = earnedCountForModule(mod);
          const total = totalForModule(mod);
          const isActive = activeModule === mod;
          return (
            <button
              key={mod}
              onClick={() => setActiveModule(mod)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition ${
                isActive
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-amber-200 hover:text-amber-700'
              }`}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                isActive ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-500'
              }`}>
                {earned}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Achievement cards by category */}
      <div className="space-y-6">
        {Object.entries(grouped[activeModule] ?? {}).map(([category, achievements]) => (
          <div key={category}>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {category}
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {achievements.map(ach => {
                const isEarned = earnedSet.has(ach.id);
                const earnedAt = earnedAtMap.get(ach.id);
                const countEarned = allCounts[ach.id] ?? 0;
                const pct = totalUsers > 0 ? Math.round((countEarned / totalUsers) * 100) : 0;
                const isNegative = ach.kind === 'negative';

                return (
                  <div
                    key={ach.id}
                    className={`flex items-start gap-4 p-4 rounded-2xl border transition ${
                      isEarned
                        ? isNegative
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-amber-50 border-amber-200'
                        : 'bg-white border-slate-100 opacity-50'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`text-3xl leading-none shrink-0 ${!isEarned ? 'grayscale' : ''}`}>
                      {isEarned ? ach.icon : <Lock size={24} className="text-slate-300 mt-1" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-sm ${
                          isEarned ? (isNegative ? 'text-slate-700' : 'text-amber-900') : 'text-slate-400'
                        }`}>
                          {ach.name}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          isNegative
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          Уровень {ach.tier}
                        </span>
                        {isNegative && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">
                            Штрафная
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {ach.description}
                      </p>

                      {isEarned && (
                        <div className="flex items-center gap-4 mt-2">
                          {earnedAt && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Calendar size={11} />
                              {new Date(earnedAt).toLocaleDateString('ru-RU', {
                                day: 'numeric', month: 'long', year: 'numeric',
                              })}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Users size={11} />
                            {pct}% коллег тоже получили
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Trophy indicator */}
                    {isEarned && !isNegative && (
                      <Trophy size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
