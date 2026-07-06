import { useState, useEffect, Fragment } from 'react';
import { Users, Shield, Loader2, Settings2, Check, ChevronRight, ChevronDown, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile, RolePermission } from '../types';
import { ROLE_LABELS } from '../types';

interface UsersViewProps {
  profiles: Profile[];
  rolePermissions: RolePermission[];
  onReload: () => void;
}

const ROLES_LIST: Array<Profile['role']> = ['admin', 'manager', 'analyst', 'guest'];
const EDITABLE_ROLES: Array<Profile['role']> = ['manager', 'analyst', 'guest'];

const MODULES_CONFIG = [
  {
    id: 'dashboard',
    label: 'Протокольные поручения',
    features: [
      { id: 'create_meeting', label: 'Создание совещаний' },
      { id: 'delete_meeting', label: 'Удаление протоколов' },
    ],
  },
  {
    id: 'objects',
    label: 'Объекты ГП',
    features: [
      { id: 'delete_objects', label: 'Удаление объектов' },
    ],
  },
  {
    id: 'closure',
    label: 'Закрытие объектов',
    features: [],
  },
  {
    id: 'nts',
    label: 'НТС',
    features: [],
  },
];

export default function UsersView({ profiles, rolePermissions, onReload }: UsersViewProps) {
  const [tab, setTab] = useState<'users' | 'permissions'>('users');
  const [updating, setUpdating] = useState<string | null>(null);
  const [localPerms, setLocalPerms] = useState<RolePermission[]>(rolePermissions);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [updatingModules, setUpdatingModules] = useState<string | null>(null);

  useEffect(() => {
    setLocalPerms(rolePermissions);
  }, [rolePermissions]);

  const updateRole = async (userId: string, role: Profile['role']) => {
    setUpdating(userId);
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    setUpdating(null);
    if (error) alert('Ошибка обновления роли: ' + error.message);
    else onReload();
  };

  const updateResponsibleModules = async (userId: string, modules: string[]) => {
    setUpdatingModules(userId);
    const { error } = await supabase.from('profiles').update({ responsible_modules: modules }).eq('id', userId);
    setUpdatingModules(null);
    if (error) alert('Ошибка обновления назначений: ' + error.message);
    else onReload();
  };

  const toggleModuleAssignment = (profile: Profile, moduleId: string) => {
    const current = profile.responsible_modules ?? [];
    const updated = current.includes(moduleId)
      ? current.filter(m => m !== moduleId)
      : [...current, moduleId];
    void updateResponsibleModules(profile.id, updated);
  };

  const getPerm = (role: string, module: string): RolePermission | undefined =>
    localPerms.find(p => p.role === role && p.module === module);

  const upsertPerm = async (role: string, module: string, updates: Partial<RolePermission>) => {
    const existing = getPerm(role, module);
    const newPerm: RolePermission = {
      role,
      module,
      can_access: existing?.can_access ?? true,
      features:   existing?.features ?? {},
      ...updates,
    };
    const key = `${role}:${module}`;
    setSaving(key);

    setLocalPerms(prev => {
      const idx = prev.findIndex(p => p.role === role && p.module === module);
      if (idx >= 0) { const next = [...prev]; next[idx] = newPerm; return next; }
      return [...prev, newPerm];
    });

    const { error } = await supabase
      .from('role_permissions')
      .upsert(newPerm, { onConflict: 'role,module' });

    setSaving(null);
    if (error) {
      alert('Ошибка сохранения прав: ' + error.message);
      setLocalPerms(rolePermissions);
    } else {
      onReload();
    }
  };

  const toggleModuleAccess = (role: string, module: string) => {
    const existing = getPerm(role, module);
    upsertPerm(role, module, { can_access: !(existing?.can_access ?? true) });
  };

  const toggleFeature = (role: string, module: string, feature: string) => {
    const existing = getPerm(role, module);
    const features = { ...(existing?.features ?? {}) };
    features[feature] = !features[feature];
    upsertPerm(role, module, { features });
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-1 flex items-center gap-3">
          <Users size={28} className="text-purple-600" />
          Управление пользователями
        </h2>
        <p className="text-slate-500">Роли, права доступа и назначения по модулям</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { id: 'users', icon: <Users size={15} />, label: 'Пользователи' },
          { id: 'permissions', icon: <Settings2 size={15} />, label: 'Права доступа' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              tab === t.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Users tab ── */}
      {tab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-6" />
                <th className="px-4 py-3 text-left font-medium">ФИО</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Текущая роль</th>
                <th className="px-4 py-3 text-left font-medium w-48">Изменить роль</th>
                <th className="px-4 py-3 text-left font-medium">Назначения (модули)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map(p => {
                const isExpanded = expandedUser === p.id;
                const modules = p.responsible_modules ?? [];
                return (
                  <Fragment key={p.id}>
                    <tr className={`hover:bg-slate-50 transition ${isExpanded ? 'bg-purple-50/40' : ''}`}>
                      {/* Expand toggle */}
                      <td className="px-4 py-4 text-center">
                        {p.role !== 'admin' && (
                          <button
                            onClick={() => setExpandedUser(isExpanded ? null : p.id)}
                            className="text-slate-400 hover:text-purple-600 transition"
                            title={isExpanded ? 'Свернуть' : 'Управление назначениями'}
                          >
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </button>
                        )}
                      </td>

                      <td className="px-4 py-4 font-medium text-slate-900">{p.full_name || '—'}</td>
                      <td className="px-4 py-4 text-slate-600 text-xs">{p.email}</td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <Shield size={14} />
                          {ROLE_LABELS[p.role] ?? p.role}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {p.role !== 'admin' ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={p.role}
                              disabled={updating === p.id}
                              onChange={e => updateRole(p.id, e.target.value as Profile['role'])}
                              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none disabled:opacity-50"
                            >
                              {ROLES_LIST.filter(r => r !== 'admin').map(role => (
                                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                              ))}
                            </select>
                            {updating === p.id && <Loader2 className="animate-spin text-purple-600 shrink-0" size={14} />}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Полный доступ</span>
                        )}
                      </td>

                      {/* Module designations chips */}
                      <td className="px-4 py-4">
                        {p.role === 'admin' ? (
                          <span className="text-xs text-slate-400 italic">Все модули</span>
                        ) : modules.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {modules.map(mid => {
                              const mod = MODULES_CONFIG.find(m => m.id === mid);
                              return (
                                <span key={mid} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                                  {mod?.label ?? mid}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded: module designation editor */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-purple-50/30 border-t border-purple-100">
                          <div className="flex items-start gap-6">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mt-0.5 shrink-0">
                              <Package size={15} className="text-orange-500" />
                              Ответственный за модуль:
                            </div>
                            <div className="flex flex-wrap gap-4">
                              {MODULES_CONFIG.map(mod => {
                                const isChecked = modules.includes(mod.id);
                                const isSaving = updatingModules === p.id;
                                return (
                                  <label key={mod.id} className={`flex items-center gap-2 cursor-pointer select-none ${isSaving ? 'opacity-50' : ''}`}>
                                    <div
                                      onClick={() => !isSaving && toggleModuleAssignment(p, mod.id)}
                                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                                        isChecked
                                          ? 'bg-orange-500 border-orange-500'
                                          : 'bg-white border-slate-300 hover:border-orange-400'
                                      }`}
                                    >
                                      {isChecked && <Check size={12} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <span className={`text-sm ${isChecked ? 'text-orange-700 font-medium' : 'text-slate-600'}`}>
                                      {mod.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {updatingModules === p.id && (
                              <Loader2 size={14} className="animate-spin text-purple-500 mt-1" />
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-2 ml-7">
                            Ответственный за модуль получает права администратора в выбранном модуле.
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Пользователи не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Permissions tab ── */}
      {tab === 'permissions' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Настройте доступ к модулям и функционалу для каждой роли.{' '}
            <span className="font-medium text-slate-700">Администратор</span>{' '}
            всегда имеет полный доступ.{' '}
            <span className="font-medium text-slate-700">Ответственный за модуль</span>{' '}
            получает права администратора в своём модуле независимо от настроек здесь.
          </p>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-slate-700 w-72">
                    Модуль / Функционал
                  </th>
                  {/* Admin column — always locked */}
                  <th className="px-4 py-4 text-center w-36">
                    <div className="flex flex-col items-center gap-1">
                      <Shield size={14} className="text-purple-400" />
                      <span className="text-xs font-semibold text-slate-400">{ROLE_LABELS['admin']}</span>
                      <span className="text-[10px] text-slate-400 font-normal">Полный доступ</span>
                    </div>
                  </th>
                  {EDITABLE_ROLES.map(role => (
                    <th key={role} className="px-4 py-4 text-center w-36">
                      <div className="flex flex-col items-center gap-1">
                        <Shield size={14} className="text-purple-600" />
                        <span className="text-xs font-semibold text-slate-700">{ROLE_LABELS[role]}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES_CONFIG.map(mod => (
                  <Fragment key={mod.id}>
                    <tr className="border-t border-slate-100 bg-slate-50/40">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                          <ChevronRight size={14} className="text-slate-400 shrink-0" />
                          {mod.label}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <div className="w-5 h-5 rounded bg-purple-100 border border-purple-200 flex items-center justify-center">
                            <Check size={12} className="text-purple-600" strokeWidth={3} />
                          </div>
                        </div>
                      </td>
                      {EDITABLE_ROLES.map(role => {
                        const perm = getPerm(role, mod.id);
                        const checked = perm?.can_access ?? true;
                        const key = `${role}:${mod.id}`;
                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            <div className="flex justify-center">
                              {saving === key ? (
                                <Loader2 size={18} className="animate-spin text-slate-400" />
                              ) : (
                                <button
                                  onClick={() => toggleModuleAccess(role, mod.id)}
                                  title={checked ? 'Запретить доступ' : 'Разрешить доступ'}
                                  className="focus:outline-none"
                                >
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${
                                    checked
                                      ? 'bg-teal-600 border-teal-600'
                                      : 'bg-white border-slate-300 hover:border-slate-400'
                                  }`}>
                                    {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                                  </div>
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {mod.features.map(feat => (
                      <tr key={`${mod.id}:${feat.id}`} className="border-t border-slate-100">
                        <td className="px-6 py-2.5 pl-14 text-xs text-slate-500">
                          {feat.label}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex justify-center">
                            <div className="w-4 h-4 rounded bg-purple-50 border border-purple-200 flex items-center justify-center">
                              <Check size={10} className="text-purple-500" strokeWidth={3} />
                            </div>
                          </div>
                        </td>
                        {EDITABLE_ROLES.map(role => {
                          const perm = getPerm(role, mod.id);
                          const moduleOff = !(perm?.can_access ?? true);
                          const checked = !moduleOff && !!(perm?.features?.[feat.id]);
                          const key = `${role}:${mod.id}:${feat.id}`;
                          const parentSaving = saving === `${role}:${mod.id}`;
                          return (
                            <td key={role} className="px-4 py-2.5 text-center">
                              <div className="flex justify-center">
                                {parentSaving ? (
                                  <Loader2 size={14} className="animate-spin text-slate-300" />
                                ) : moduleOff ? (
                                  <div className="w-4 h-4 rounded border border-slate-200 bg-slate-50 opacity-30" title="Модуль отключён" />
                                ) : (
                                  <button
                                    onClick={() => toggleFeature(role, mod.id, feat.id)}
                                    disabled={saving === key}
                                    title={checked ? 'Отключить' : 'Включить'}
                                    className="focus:outline-none"
                                  >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                                      checked
                                        ? 'bg-teal-500 border-teal-500'
                                        : 'bg-white border-slate-300 hover:border-slate-400'
                                    }`}>
                                      {checked && <Check size={9} className="text-white" strokeWidth={3} />}
                                    </div>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
