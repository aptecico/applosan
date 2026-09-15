-- Phase 1 catalog: permissions, system roles, free plan, features

INSERT INTO public.permissions (code, name, module, description) VALUES
  ('dashboard.view', 'Ver dashboard', 'dashboard', 'Acceso al panel principal'),
  ('products.view', 'Ver productos', 'products', 'Listar productos y variantes'),
  ('products.create', 'Crear productos', 'products', 'Crear productos'),
  ('products.update', 'Editar productos', 'products', 'Actualizar productos'),
  ('products.delete', 'Eliminar productos', 'products', 'Eliminar productos'),
  ('purchases.view', 'Ver compras', 'purchases', 'Listar compras'),
  ('purchases.create', 'Crear compras', 'purchases', 'Registrar compras'),
  ('purchases.update', 'Editar compras', 'purchases', 'Actualizar compras'),
  ('inventory.view', 'Ver inventario', 'inventory', 'Consultar existencias'),
  ('inventory.adjust', 'Ajustar inventario', 'inventory', 'Ajustes manuales de stock'),
  ('sales.view', 'Ver ventas', 'sales', 'Listar ventas'),
  ('sales.create', 'Crear ventas', 'sales', 'Registrar ventas'),
  ('sales.cancel', 'Anular ventas', 'sales', 'Anular ventas'),
  ('customers.view', 'Ver clientes', 'customers', 'Listar clientes'),
  ('customers.create', 'Crear clientes', 'customers', 'Registrar clientes'),
  ('customers.update', 'Editar clientes', 'customers', 'Actualizar clientes'),
  ('credits.view', 'Ver créditos', 'credits', 'Consultar créditos'),
  ('credits.create', 'Crear créditos', 'credits', 'Otorgar créditos'),
  ('credits.payments', 'Registrar abonos', 'credits', 'Abonos a créditos'),
  ('cash.view', 'Ver caja', 'cash', 'Consultar caja'),
  ('cash.open', 'Abrir caja', 'cash', 'Apertura de caja'),
  ('cash.close', 'Cerrar caja', 'cash', 'Cierre de caja'),
  ('reports.view', 'Ver reportes', 'reports', 'Reportes básicos'),
  ('reports.advanced', 'Reportes avanzados', 'reports', 'Reportes avanzados'),
  ('users.view', 'Ver usuarios', 'users', 'Listar usuarios del tenant'),
  ('users.create', 'Crear usuarios', 'users', 'Invitar o crear usuarios'),
  ('users.update', 'Editar usuarios', 'users', 'Actualizar usuarios'),
  ('users.delete', 'Eliminar usuarios', 'users', 'Desactivar o quitar usuarios'),
  ('roles.view', 'Ver roles', 'roles', 'Listar roles'),
  ('roles.create', 'Crear roles', 'roles', 'Crear roles personalizados'),
  ('roles.update', 'Editar roles', 'roles', 'Actualizar roles y permisos'),
  ('roles.delete', 'Eliminar roles', 'roles', 'Eliminar roles no de sistema'),
  ('settings.view', 'Ver configuración', 'settings', 'Consultar configuración del tenant'),
  ('settings.update', 'Editar configuración', 'settings', 'Actualizar configuración del tenant'),
  ('branches.view', 'Ver sucursales', 'branches', 'Listar sucursales'),
  ('branches.create', 'Crear sucursales', 'branches', 'Crear sucursales'),
  ('branches.update', 'Editar sucursales', 'branches', 'Actualizar sucursales'),
  ('branches.delete', 'Eliminar sucursales', 'branches', 'Eliminar sucursales')
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO public.roles (tenant_id, name, code, description, is_system)
VALUES
  (NULL, 'Administrador', 'admin', 'Acceso completo al tenant', true),
  (NULL, 'Vendedor', 'seller', 'Ventas, clientes y consulta de productos/inventario', true)
ON CONFLICT (code) WHERE tenant_id IS NULL DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = true;

-- Admin template: every permission
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.tenant_id IS NULL
  AND r.code = 'admin'
ON CONFLICT DO NOTHING;

-- Seller template: sales-oriented defaults (sin dashboard obligatorio)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'products.view',
  'inventory.view',
  'sales.view',
  'sales.create',
  'customers.view',
  'customers.create',
  'credits.view',
  'credits.create',
  'credits.payments'
)
WHERE r.tenant_id IS NULL
  AND r.code = 'seller'
ON CONFLICT DO NOTHING;

INSERT INTO public.plans (name, code, description, price, billing_period, status, is_default)
VALUES (
  'Gratis',
  'free',
  'Plan inicial gratuito. Todas las funciones operativas básicas, sin reportes avanzados, exportaciones ni multi-sucursal de pago.',
  0,
  'none',
  'active',
  true
)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  billing_period = EXCLUDED.billing_period,
  status = EXCLUDED.status,
  is_default = EXCLUDED.is_default;

INSERT INTO public.features (code, name, description) VALUES
  ('products', 'Productos', 'Catálogo de productos'),
  ('purchases', 'Compras', 'Registro de compras'),
  ('inventory', 'Inventario', 'Control de existencias'),
  ('sales', 'Ventas', 'Punto de venta'),
  ('customers', 'Clientes', 'Directorio de clientes'),
  ('credits', 'Créditos', 'Ventas a crédito y abonos'),
  ('cash', 'Caja', 'Apertura y cierre de caja'),
  ('combos', 'Combos', 'Combos con precio propio'),
  ('basic_reports', 'Reportes básicos', 'Reportes operativos'),
  ('advanced_reports', 'Reportes avanzados', 'Analítica avanzada'),
  ('exports', 'Exportaciones', 'Exportar datos'),
  ('multi_branch', 'Multi-sucursal', 'Más de una sucursal activa'),
  ('advanced_configuration', 'Configuración avanzada', 'Ajustes avanzados del tenant')
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO public.plan_features (plan_id, feature_id, enabled, limit_value, limit_unit)
SELECT pl.id, f.id,
  CASE
    WHEN f.code IN ('advanced_reports', 'exports', 'multi_branch', 'advanced_configuration') THEN false
    ELSE true
  END,
  CASE
    WHEN f.code = 'multi_branch' THEN 1
    ELSE NULL
  END,
  CASE
    WHEN f.code = 'multi_branch' THEN 'branches'
    ELSE NULL
  END
FROM public.plans pl
CROSS JOIN public.features f
WHERE pl.code = 'free'
ON CONFLICT (plan_id, feature_id) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  limit_value = EXCLUDED.limit_value,
  limit_unit = EXCLUDED.limit_unit;
