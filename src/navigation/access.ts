import { APP_NAV_ITEMS, type AppNavItem } from '@/navigation/modules';

export function canAccessAdmin(permissions: string[]) {
  return ['users.view', 'roles.view', 'branches.view', 'settings.view'].some((code) =>
    permissions.includes(code),
  );
}

export function canAccessItem(
  item: AppNavItem,
  permissions: string[],
  features: string[],
): boolean {
  if (item.id === 'admin') {
    return canAccessAdmin(permissions);
  }
  if (!permissions.includes(item.permission)) {
    return false;
  }
  if (item.feature && !features.includes(item.feature)) {
    return false;
  }
  return true;
}

/** Accesos del menú / grilla de módulos (sin duplicar “Nueva venta”). */
export function getVisibleModules(permissions: string[], features: string[]): AppNavItem[] {
  const hubIds = new Set([
    'dashboard',
    'sales-list',
    'products',
    'inventory',
    'purchases',
    'suppliers',
    'customers',
    'reports',
    'admin',
  ]);
  return APP_NAV_ITEMS.filter(
    (item) => hubIds.has(item.id) && canAccessItem(item, permissions, features),
  );
}

export function getQuickActions(permissions: string[], features: string[]): AppNavItem[] {
  return APP_NAV_ITEMS.filter(
    (item) => item.quickAction && canAccessItem(item, permissions, features),
  ).sort((a, b) => (a.quickOrder ?? 99) - (b.quickOrder ?? 99));
}
