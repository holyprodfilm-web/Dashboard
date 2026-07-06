import { useState } from 'react';
import { Users, Shield, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { ROLE_LABELS } from '../types';

interface UsersViewProps {
  profiles: Profile[];
  onReload: () => void;
}

const ROLES: Profile['role'][] = ['admin', 'manager', 'contractor', 'guest'];

export default function UsersView({ profiles, onReload }: UsersViewProps) {
  const [updating, setUpdating] = useState<string | null>(null);

  const updateRole = async (userId: string, role: Profile['role']) => {
    setUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    setUpdating(null);
    if (error) {
      alert('Ошибка обновления роли: ' + error.message);
    } else {
      onReload();
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-1 flex items-center gap-3">
          <Users size={28} className="text-purple-600" />
          Управление пользователями
        </h2>
        <p className="text-slate-500">Назначение ролей и прав доступа</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
            <tr>
              <th className="px-6 py-3 text-left font-medium">ФИО</th>
              <th className="px-6 py-3 text-left font-medium">Email</th>
              <th className="px-6 py-3 text-left font-medium">Роль</th>
              <th className="px-6 py-3 text-left font-medium w-48">Изменить роль</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {profiles.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">{p.full_name}</td>
                <td className="px-6 py-4 text-slate-600">{p.email}</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Shield size={14} />
                    {ROLE_LABELS[p.role]}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={p.role}
                    disabled={updating === p.id}
                    onChange={e => updateRole(p.id, e.target.value as Profile['role'])}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none disabled:opacity-50"
                  >
                    {ROLES.map(role => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                  {updating === p.id && (
                    <Loader2 className="inline-block ml-2 animate-spin text-teal-600" size={14} />
                  )}
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                  Пользователи не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
