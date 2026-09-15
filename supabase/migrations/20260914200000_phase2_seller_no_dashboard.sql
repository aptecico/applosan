-- Phase 2a: welcome flow catalog fixes
-- - Vendedor ya no requiere dashboard.view
-- - Sync en roles seller ya clonados por tenant

-- Quitar dashboard.view del template seller (tenant_id IS NULL)
DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.tenant_id IS NULL
  AND r.code = 'seller'
  AND p.code = 'dashboard.view';

-- Quitar dashboard.view de roles seller de sistema por tenant
DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.tenant_id IS NOT NULL
  AND r.code = 'seller'
  AND r.is_system = true
  AND p.code = 'dashboard.view';

-- Asegurar permisos operativos del seller (template + clones)
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
WHERE r.code = 'seller'
  AND r.is_system = true
ON CONFLICT DO NOTHING;
