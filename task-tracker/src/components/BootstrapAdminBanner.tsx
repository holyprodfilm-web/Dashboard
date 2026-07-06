import { useState } from 'react';
import { ShieldAlert, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface Props {
  /** Current logged-in user's profile */
  currentProfile: Profile | null;
  /** All profiles — used to detect whether any admin exists and who registered first */
  profiles: Profile[];
  /** Called after successful promotion so the parent can reload profile/data */
  onPromoted: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'error: admin_exists': 'Администратор уже назначен. Обновите страницу.',
  'error: not_first_user':
    'Права администратора может получить только первый зарегистрированный пользователь системы.',
};

/**
 * Shown when no admin exists yet.
 *
 * - If the current user IS the earliest-registered profile, they see a
 *   "Become admin" button that calls bootstrap_first_admin() RPC.
 * - If they are NOT the earliest, they see an informational notice only.
 *
 * The RPC enforces the same rule atomically on the server side, so the
 * UI state is consistent with what the backend will allow.
 */
export default function BootstrapAdminBanner({ currentProfile, profiles, onPromoted }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Don't render if an admin already exists
  const hasAdmin = profiles.some(p => p.role === 'admin');
  if (hasAdmin || !currentProfile) return null;

  // Determine who registered first by created_at
  const firstProfile = profiles.reduce<Profile | null>((earliest, p) => {
    if (!earliest) return p;
    const a = earliest.created_at ?? '';
    const b = p.created_at ?? '';
    return b < a ? p : earliest;
  }, null);

  const isFirstUser = firstProfile?.id === currentProfile.id;

  const promote = async () => {
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('bootstrap_first_admin');
    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (data === 'ok') {
      onPromoted();
    } else {
      setError(ERROR_MESSAGES[data as string] ?? data);
    }
  };

  if (!isFirstUser) {
    return (
      <div className="mb-6 flex items-start gap-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl">
        <ShieldAlert className="text-slate-400 shrink-0 mt-0.5" size={22} />
        <div>
          <p className="font-semibold text-slate-700 mb-1">Ожидание администратора</p>
          <p className="text-sm text-slate-500">
            В системе пока нет администратора. Первый зарегистрированный пользователь должен
            войти и принять роль администратора.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-start gap-4 p-5 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm">
      <ShieldCheck className="text-amber-500 shrink-0 mt-0.5" size={22} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-900 mb-1">
          Вы первый пользователь — назначьте себя администратором
        </p>
        <p className="text-sm text-amber-700">
          В системе ещё нет администратора. Как первый зарегистрированный пользователь, вы
          можете получить права администратора и начать управлять системой.
        </p>
        {error && (
          <p className="mt-2 text-sm text-[#E93A58]">{error}</p>
        )}
      </div>
      <button
        onClick={promote}
        disabled={loading}
        className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition"
      >
        {loading
          ? <><Loader2 size={16} className="animate-spin" /> Применяем…</>
          : <><CheckCircle2 size={16} /> Стать администратором</>
        }
      </button>
    </div>
  );
}
