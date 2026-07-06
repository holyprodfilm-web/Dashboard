import { useAuth } from './AuthContext';

// Базовые права для каждой роли (используются как fallback если role_permissions не загружены)
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

export function usePermissions() {
  const { profile } = useAuth();
  const role = profile?.role || 'guest';
  const permissions = PERMISSIONS[role as keyof typeof PERMISSIONS] || PERMISSIONS.guest;

  return {
    role,
    ...permissions,
    isAdmin:    role === 'admin',
    isManager:  role === 'manager',
    isAnalyst:  role === 'analyst',
    isGuest:    role === 'guest',
  };
}
