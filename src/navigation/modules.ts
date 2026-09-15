/**
 * Catálogo de navegación de la app.
 * Internamente usa códigos técnicos (permissions / features).
 * Al usuario se muestran labels humanos.
 */

export type AppModuleId =
  | 'dashboard'
  | 'sales'
  | 'products'
  | 'inventory'
  | 'purchases'
  | 'suppliers'
  | 'customers'
  | 'reports'
  | 'admin';

export type AppNavItem = {
  id: string;
  moduleId: AppModuleId;
  title: string;
  description: string;
  href: string;
  /** Permiso mínimo para ver el ítem */
  permission: string;
  /** Feature de plan requerida (opcional) */
  feature?: string;
  /** Mostrar en Acciones rápidas (vendedores / operación diaria) */
  quickAction?: boolean;
  /** Prioridad en acciones rápidas (menor = primero) */
  quickOrder?: number;
  /** Icono Material Design para tabs / tiles */
  mdIcon: string;
  /** Si true, la pantalla aún es placeholder */
  comingSoon?: boolean;
};

export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Productos',
  purchases: 'Compras',
  inventory: 'Inventario',
  sales: 'Ventas',
  customers: 'Clientes',
  credits: 'Créditos',
  cash: 'Caja',
  reports: 'Reportes',
  users: 'Usuarios',
  roles: 'Roles',
  settings: 'Configuración',
  branches: 'Sucursales',
  suppliers: 'Proveedores',
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    id: 'dashboard',
    moduleId: 'dashboard',
    title: 'Dashboard',
    description: 'Resumen del negocio y métricas',
    href: '/dashboard',
    permission: 'dashboard.view',
    mdIcon: 'dashboard',
    quickAction: false,
  },
  {
    id: 'sales-new',
    moduleId: 'sales',
    title: 'Nueva venta',
    description: 'Registrar una venta rápido',
    href: '/sales/new',
    permission: 'sales.create',
    feature: 'sales',
    mdIcon: 'point_of_sale',
    quickAction: true,
    quickOrder: 1,
    comingSoon: true,
  },
  {
    id: 'sales-list',
    moduleId: 'sales',
    title: 'Ventas del día',
    description: 'Consultar ventas realizadas',
    href: '/sales/',
    permission: 'sales.view',
    feature: 'sales',
    mdIcon: 'receipt_long',
    quickAction: true,
    quickOrder: 4,
    comingSoon: true,
  },
  {
    id: 'products',
    moduleId: 'products',
    title: 'Productos',
    description: 'Catálogo de prendas',
    href: '/products',
    permission: 'products.view',
    feature: 'products',
    mdIcon: 'checkroom',
    quickAction: true,
    quickOrder: 2,
  },
  {
    id: 'inventory',
    moduleId: 'inventory',
    title: 'Consultar inventario',
    description: 'Existencias y lotes de costo',
    href: '/inventory',
    permission: 'inventory.view',
    feature: 'inventory',
    mdIcon: 'inventory_2',
    quickAction: true,
    quickOrder: 3,
  },
  {
    id: 'purchases',
    moduleId: 'purchases',
    title: 'Compras',
    description: 'Compras y costos por lote',
    href: '/purchases',
    permission: 'purchases.view',
    feature: 'purchases',
    mdIcon: 'shopping_cart',
    quickAction: true,
    quickOrder: 6,
  },
  {
    id: 'suppliers',
    moduleId: 'suppliers',
    title: 'Proveedores',
    description: 'Directorio de proveedores',
    href: '/suppliers',
    permission: 'purchases.view',
    feature: 'purchases',
    mdIcon: 'local_shipping',
  },
  {
    id: 'customers',
    moduleId: 'customers',
    title: 'Clientes',
    description: 'Directorio de clientes',
    href: '/customers',
    permission: 'customers.view',
    feature: 'customers',
    mdIcon: 'groups',
    quickAction: true,
    quickOrder: 5,
  },
  {
    id: 'reports',
    moduleId: 'reports',
    title: 'Reportes',
    description: 'Reportes operativos',
    href: '/reports',
    permission: 'reports.view',
    feature: 'basic_reports',
    mdIcon: 'bar_chart',
    comingSoon: true,
  },
  {
    id: 'admin',
    moduleId: 'admin',
    title: 'Administración',
    description: 'Usuarios, roles y sucursales',
    href: '/admin',
    permission: 'users.view',
    mdIcon: 'settings',
  },
];

export function getModuleLabel(moduleCode: string): string {
  return MODULE_LABELS[moduleCode] ?? moduleCode;
}
