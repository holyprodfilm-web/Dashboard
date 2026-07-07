import { useAuth } from './AuthContext';

// Базовые права для каждой роли
const PERMISSIONS = {
  admin: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageUsers: true,
    canViewAll: true,
  },
  manager: {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageUsers: false,
    canViewAll: false,
  },
  analyst: {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageUsers: false,
    canViewAll: true,
  },
  guest: {
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageUsers: false,
    canViewAll: true,
  },
};

/**
 * Возвращает права доступа текущего пользователя.
 * @param forModule  Если указан, ответственный за этот модуль получает права администратора.
 */
export function usePermissions(forModule?: string) {
  const { profile } = useAuth();
  const role = profile?.role || 'guest';

  // Ответственный за конкретный модуль получает права администратора в нём
  const isModuleResponsible = forModule
    ? (profile?.responsible_modules?.includes(forModule) ?? false)
    : false;

  if (role === 'admin' || isModuleResponsible) {
    return {
      role,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManageUsers: role === 'admin',
      canViewAll: true,
      isAdmin: role === 'admin',
      isManager: role === 'manager',
      isAnalyst: role === 'analyst',
      isGuest: false,
      isModuleResponsible,
    };
  }

  const permissions = PERMISSIONS[role as keyof typeof PERMISSIONS] ?? PERMISSIONS.guest;
  return {
    role,
    ...permissions,
    isAdmin: false,
    isManager: role === 'manager',
    isAnalyst: role === 'analyst',
    isGuest: role === 'guest',
    isModuleResponsible: false,
  };
}
