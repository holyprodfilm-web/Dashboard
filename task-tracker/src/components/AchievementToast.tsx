import { useEffect, useState, useRef } from 'react';
import { X, Trophy } from 'lucide-react';
import type { ToastAchievement } from '../hooks/useAchievements';
import { MODULE_LABELS } from '../lib/achievements';

interface AchievementToastQueueProps {
  toasts: ToastAchievement[];
  onDismiss: (achievementId: string) => void;
  onOpenAchievements?: () => void;
}

/**
 * Renders one toast at a time from the queue (bottom-right, 6 s auto-dismiss).
 */
export default function AchievementToastQueue({
  toasts,
  onDismiss,
  onOpenAchievements,
}: AchievementToastQueueProps) {
  // Show only the first pending toast
  const current = toasts[0];
  if (!current) return null;

  return (
    <SingleAchievementToast
      key={current.achievement.id}
      toast={current}
      onDismiss={onDismiss}
      onOpenAchievements={onOpenAchievements}
    />
  );
}

function SingleAchievementToast({
  toast,
  onDismiss,
  onOpenAchievements,
}: {
  toast: ToastAchievement;
  onDismiss: (id: string) => void;
  onOpenAchievements?: () => void;
}) {
  const { achievement } = toast;
  const [visible, setVisible] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const dismiss = () => {
    timersRef.current.forEach(clearTimeout);
    setVisible(false);
    setTimeout(() => onDismiss(achievement.id), 350);
  };

  useEffect(() => {
    const enter = setTimeout(() => setVisible(true), 20);
    const exit  = setTimeout(() => setVisible(false), 5700);
    const close = setTimeout(() => onDismiss(achievement.id), 6050);
    timersRef.current = [enter, exit, close];
    return () => timersRef.current.forEach(clearTimeout);
  }, [achievement.id, onDismiss]);

  const modCfg = MODULE_LABELS[achievement.module];
  const isNegative = achievement.kind === 'negative';

  const bgClass   = isNegative
    ? 'bg-slate-900 border-slate-700'
    : 'bg-white border-amber-200';
  const textClass = isNegative ? 'text-white' : 'text-slate-900';
  const subClass  = isNegative ? 'text-slate-400' : 'text-slate-500';
  const btnClass  = isNegative
    ? 'text-slate-400 hover:text-white hover:bg-slate-700'
    : 'text-slate-400 hover:text-slate-700 hover:bg-amber-50';

  const tierLabel = isNegative
    ? `Уровень ${achievement.tier} — ${modCfg.label}`
    : `Уровень ${achievement.tier} — ${modCfg.label}`;

  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] w-80 rounded-2xl border shadow-xl transition-all duration-350 ease-out
        ${bgClass}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${subClass}`}>
            {isNegative ? (
              <span className="text-amber-400">⚠️ Получена ачивка</span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500">
                <Trophy size={12} /> Новая ачивка!
              </span>
            )}
          </div>
          <button onClick={dismiss} className={`p-1 rounded-lg transition ${btnClass}`}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <button
          className="w-full text-left"
          onClick={() => {
            dismiss();
            onOpenAchievements?.();
          }}
        >
          <div className="flex items-center gap-3">
            <div className={`text-4xl leading-none select-none ${isNegative ? 'grayscale' : ''}`}>
              {achievement.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-bold text-sm leading-snug ${textClass}`}>
                {achievement.name}
              </div>
              <div className={`text-xs mt-0.5 ${subClass}`}>{tierLabel}</div>
            </div>
          </div>

          <p className={`mt-2.5 text-xs leading-relaxed ${subClass}`}>
            {achievement.description}
          </p>

          <div className={`mt-2 text-xs ${isNegative ? 'text-slate-500' : 'text-amber-500'} font-medium`}>
            Нажмите, чтобы посмотреть все достижения →
          </div>
        </button>
      </div>

      {/* Progress bar */}
      <div className={`h-1 rounded-b-2xl overflow-hidden ${isNegative ? 'bg-slate-700' : 'bg-amber-100'}`}>
        <div
          className={`h-full ${isNegative ? 'bg-amber-400' : 'bg-amber-400'} animate-shrink-bar`}
          style={{ animationDuration: '6s' }}
        />
      </div>
    </div>
  );
}
