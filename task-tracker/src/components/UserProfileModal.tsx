import { useState } from 'react';
import { X, User, Mail, Shield, Key, Save, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { ROLE_LABELS, ROLE_COLORS } from '../types';

interface Props {
  onClose: () => void;
}

export default function UserProfileModal({ onClose }: Props) {
  const { user, profile, reloadProfile } = useAuth();

  // Name editing
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState('');

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const initials = (profile?.full_name || user?.email || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSaveName = async () => {
    if (!fullName.trim()) { setNameError('Имя не может быть пустым'); return; }
    setSavingName(true);
    setNameError('');
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', user!.id);
    setSavingName(false);
    if (error) {
      setNameError('Ошибка сохранения: ' + error.message);
    } else {
      await reloadProfile();
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { setPasswordError('Пароль должен быть не менее 6 символов'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Пароли не совпадают'); return; }
    setSavingPassword(true);
    setPasswordError('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPasswordError('Ошибка: ' + error.message);
    } else {
      setPasswordSaved(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSaved(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#E97386] to-[#EFA566] p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/25 flex items-center justify-center text-2xl font-bold shadow-inner">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile?.full_name || 'Пользователь'}</h2>
              <p className="text-sm text-white/80">{user?.email}</p>
              <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-white/20 text-white`}>
                {ROLE_LABELS[profile?.role || 'guest']}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Profile info */}
          <section>
            <h3 className="text-sm font-semibold text-[#8A4C08] uppercase tracking-wide mb-3 flex items-center gap-2">
              <User size={14} /> Личные данные
            </h3>
            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Отображаемое имя</label>
                <div className="flex gap-2">
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm transition"
                    placeholder="Имя Фамилия"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName || fullName === profile?.full_name}
                    className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm transition disabled:opacity-40"
                  >
                    {savingName ? <Loader2 size={14} className="animate-spin" /> : nameSaved ? <Check size={14} /> : <Save size={14} />}
                    {nameSaved ? 'Сохранено' : 'Сохранить'}
                  </button>
                </div>
                {nameError && <p className="text-xs text-[#E93A58] mt-1">{nameError}</p>}
              </div>

              {/* Email — read-only */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-[#EDDED8]/40 text-sm text-slate-700">
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  {user?.email}
                </div>
              </div>

              {/* Role — read-only */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Роль в системе</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-[#EDDED8]/40 text-sm">
                  <Shield size={14} className="text-slate-400 shrink-0" />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[profile?.role || 'guest']}`}>
                    {ROLE_LABELS[profile?.role || 'guest']}
                  </span>
                  <span className="text-slate-400 text-xs">· назначается администратором</span>
                </div>
              </div>
            </div>
          </section>

          <div className="border-t border-slate-100" />

          {/* Password change */}
          <section>
            <h3 className="text-sm font-semibold text-[#8A4C08] uppercase tracking-wide mb-3 flex items-center gap-2">
              <Key size={14} /> Смена пароля
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Новый пароль</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm transition"
                    placeholder="Минимум 6 символов"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Подтвердите пароль</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm transition"
                  placeholder="Повторите новый пароль"
                />
              </div>
              {passwordError && <p className="text-xs text-[#E93A58]">{passwordError}</p>}
              {passwordSaved && (
                <p className="text-xs text-teal-600 flex items-center gap-1">
                  <Check size={12} /> Пароль успешно изменён
                </p>
              )}
              <button
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#E97386] to-[#EFA566] hover:from-[#d4607a] hover:to-[#e0925a] text-white rounded-xl text-sm font-medium transition disabled:opacity-40"
              >
                {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                Изменить пароль
              </button>
            </div>
          </section>

          <div className="border-t border-slate-100" />

          {/* System info */}
          <section>
            <h3 className="text-sm font-semibold text-[#8A4C08] uppercase tracking-wide mb-3">
              О системе
            </h3>
            <div className="bg-[#EDDED8]/40 rounded-xl p-4 text-xs text-slate-500 space-y-1">
              <div className="flex justify-between"><span>Система</span><span className="font-medium text-slate-700">АРМ мониторинга теплоснабжения МО</span></div>
              <div className="flex justify-between"><span>User ID</span><span className="font-mono text-slate-600">{user?.id?.slice(0, 8)}…</span></div>
              <div className="flex justify-between"><span>Последний вход</span><span className="font-medium text-slate-700">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
