import { useState, useEffect } from 'react';
import { X, User, Mail, Shield, Key, Save, Loader2, Check, Eye, EyeOff, MapPin, Search, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { ROLE_LABELS, ROLE_COLORS } from '../types';
import AchievementsView from './AchievementsView';

interface Props {
  onClose: () => void;
  openAchievements?: boolean;
}

type ProfileTab = 'profile' | 'achievements';

export default function UserProfileModal({ onClose, openAchievements = false }: Props) {
  const { user, profile, reloadProfile } = useAuth();

  const [tab, setTab] = useState<ProfileTab>(openAchievements ? 'achievements' : 'profile');

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

  // Districts (managers only)
  const [allDistricts, setAllDistricts] = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(profile?.districts ?? []);
  const [districtSearch, setDistrictSearch] = useState('');
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [savingDistricts, setSavingDistricts] = useState(false);
  const [districtsSaved, setDistrictsSaved] = useState(false);
  const [districtsError, setDistrictsError] = useState('');

  const isManager = profile?.role === 'manager';
  const isAdmin = profile?.role === 'admin';

  const initials = (profile?.full_name || user?.email || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Load distinct districts from addresses table (for managers and admins)
  useEffect(() => {
    if (!isManager && !isAdmin) return;
    setLoadingDistricts(true);
    supabase
      .from('addresses')
      .select('"Городской округ"')
      .then(({ data, error }) => {
        setLoadingDistricts(false);
        if (error || !data) return;
        const unique = Array.from(
          new Set(
            data
              .map(r => r['Городской округ'] as string)
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b, 'ru'));
        setAllDistricts(unique);
      });
  }, [isManager, isAdmin]);

  // Sync selectedDistricts when profile changes
  useEffect(() => {
    setSelectedDistricts(profile?.districts ?? []);
  }, [profile?.districts]);

  const toggleDistrict = (d: string) => {
    setSelectedDistricts(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  };

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

  const handleSaveDistricts = async () => {
    setSavingDistricts(true);
    setDistrictsError('');
    const { error } = await supabase
      .from('profiles')
      .update({ districts: selectedDistricts })
      .eq('id', user!.id);
    setSavingDistricts(false);
    if (error) {
      setDistrictsError('Ошибка сохранения: ' + error.message);
    } else {
      await reloadProfile();
      setDistrictsSaved(true);
      setTimeout(() => setDistrictsSaved(false), 2500);
    }
  };

  const districtsChanged = JSON.stringify([...(profile?.districts || [])].sort()) !==
    JSON.stringify([...selectedDistricts].sort());

  const filteredDistricts = allDistricts.filter(d =>
    d.toLowerCase().includes(districtSearch.toLowerCase())
  );

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
              <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-white/20 text-white">
                {ROLE_LABELS[profile?.role || 'guest']}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 bg-white border-b border-slate-100">
          <button
            onClick={() => setTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition ${
              tab === 'profile'
                ? 'border-teal-500 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <User size={14} /> Профиль
          </button>
          <button
            onClick={() => setTab('achievements')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition ${
              tab === 'achievements'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Trophy size={14} /> Достижения
          </button>
        </div>

        {/* Achievements tab */}
        {tab === 'achievements' && user && (
          <div className="p-6 max-h-[65vh] overflow-y-auto">
            <AchievementsView userId={user.id} />
          </div>
        )}

        {/* Profile tab */}
        {tab === 'profile' && (
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
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

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-[#EDDED8]/40 text-sm text-slate-700">
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  {user?.email}
                </div>
              </div>

              {/* Role */}
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

          {/* Districts — managers and admins only */}
          {(isManager || isAdmin) && (
            <>
              <div className="border-t border-slate-100" />
              <section>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#8A4C08] uppercase tracking-wide flex items-center gap-2">
                    <MapPin size={14} /> Закреплённые округа
                  </h3>
                  <span className="text-xs text-slate-400">
                    {selectedDistricts.length > 0
                      ? `Выбрано: ${selectedDistricts.length}`
                      : 'Не выбрано'}
                  </span>
                </div>

                {/* Selected badges */}
                {selectedDistricts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[...selectedDistricts].sort((a, b) => a.localeCompare(b, 'ru')).map(d => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-xs font-medium"
                      >
                        {d}
                        <button
                          onClick={() => toggleDistrict(d)}
                          className="hover:text-[#E93A58] transition ml-0.5"
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}

                {loadingDistricts ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-3">
                    <Loader2 size={14} className="animate-spin" /> Загрузка округов…
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={districtSearch}
                        onChange={e => setDistrictSearch(e.target.value)}
                        placeholder="Поиск округа…"
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm transition"
                      />
                    </div>

                    {/* Checklist */}
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                      {filteredDistricts.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">
                          {districtSearch ? 'Ничего не найдено' : 'Округа не загружены'}
                        </p>
                      ) : (
                        filteredDistricts.map(d => {
                          const checked = selectedDistricts.includes(d);
                          return (
                            <label
                              key={d}
                              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition text-sm select-none
                                ${checked ? 'bg-teal-50/60' : 'hover:bg-slate-50'}`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition
                                ${checked
                                  ? 'bg-teal-600 border-teal-600'
                                  : 'border-slate-300 bg-white'}`}
                              >
                                {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                              </div>
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                onChange={() => toggleDistrict(d)}
                              />
                              <span className={checked ? 'text-teal-800 font-medium' : 'text-slate-700'}>{d}</span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    {/* Bulk actions */}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setSelectedDistricts([...allDistricts])}
                        className="text-xs text-teal-600 hover:underline"
                      >Выбрать все</button>
                      <span className="text-slate-300">·</span>
                      <button
                        onClick={() => setSelectedDistricts([])}
                        className="text-xs text-slate-500 hover:underline"
                      >Снять все</button>
                    </div>
                  </>
                )}

                {districtsError && <p className="text-xs text-[#E93A58] mt-2">{districtsError}</p>}

                <button
                  onClick={handleSaveDistricts}
                  disabled={savingDistricts || !districtsChanged}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-40"
                >
                  {savingDistricts
                    ? <><Loader2 size={14} className="animate-spin" /> Сохранение…</>
                    : districtsSaved
                    ? <><Check size={14} /> Сохранено</>
                    : <><Save size={14} /> Сохранить округа</>}
                </button>
              </section>
            </>
          )}

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
              <div className="flex justify-between">
                <span>Система</span>
                <span className="font-medium text-slate-700">АРМ мониторинга теплоснабжения МО</span>
              </div>
              <div className="flex justify-between">
                <span>User ID</span>
                <span className="font-mono text-slate-600">{user?.id?.slice(0, 8)}…</span>
              </div>
              <div className="flex justify-between">
                <span>Последний вход</span>
                <span className="font-medium text-slate-700">
                  {user?.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleDateString('ru-RU', {
                        day: '2-digit', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : '—'}
                </span>
              </div>
            </div>
          </section>
        </div>
        )}
      </div>
    </div>
  );
}
