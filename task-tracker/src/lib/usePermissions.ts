import { useAuth } from './AuthContext';

// Права доступа для каждой роли
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
    canViewAll: false, // Только свой округ
  },
  contractor: {
    canCreate: false,
    canEdit: true, // Может менять статус своих поручений
    canDelete: false,
    canManageUsers: false,
    canViewAll: false, // Только свои поручения
  },
  guest: {
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageUsers: false,
    canViewAll: true, // Видит всё, но только на чтение
  },
};

export function usePermissions() {
  const { profile } = useAuth();
  const role = profile?.role || 'guest';
  const permissions = PERMISSIONS[role as keyof typeof PERMISSIONS] || PERMISSIONS.guest;

  return {
    role,
    ...permissions,
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isContractor: role === 'contractor',
    isGuest: role === 'guest',
  };
}