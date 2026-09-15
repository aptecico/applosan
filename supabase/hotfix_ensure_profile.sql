-- Hotfix: perfiles faltantes + register_tenant autocrea perfil.
-- Pegar en SQL Editor de Supabase y Run (una sola vez).

-- 1) Backfill de perfiles para usuarios Auth sin fila en public.profiles
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(COALESCE(u.email, ''), '@', 1), ''),
  u.raw_user_meta_data ->> 'avatar_url'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 2) Asegurar trigger de perfil en signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) provision_tenant: crea perfil si falta (misma lógica que la migration)
CREATE OR REPLACE FUNCTION public.provision_tenant(
  p_owner_id uuid,
  p_name text,
  p_commercial_name text DEFAULT NULL,
  p_document_number text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_branch_name text DEFAULT 'Principal',
  p_branch_code text DEFAULT 'MAIN'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_branch_id uuid;
  v_admin_role_id uuid;
  v_plan_id uuid;
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner is required';
  END IF;

  IF NULLIF(BTRIM(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Tenant name is required';
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(COALESCE(u.email, ''), '@', 1), ''),
    u.raw_user_meta_data ->> 'avatar_url'
  FROM auth.users u
  WHERE u.id = p_owner_id
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_owner_id) THEN
    RAISE EXCEPTION 'Profile does not exist for owner';
  END IF;

  SELECT id INTO v_plan_id
  FROM public.plans
  WHERE is_default = true AND status = 'active'
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id
    FROM public.plans
    WHERE code = 'free' AND status = 'active'
    LIMIT 1;
  END IF;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Default free plan is not seeded';
  END IF;

  INSERT INTO public.tenants (
    name,
    commercial_name,
    document_number,
    email,
    phone,
    address,
    status
  )
  VALUES (
    BTRIM(p_name),
    NULLIF(BTRIM(COALESCE(p_commercial_name, '')), ''),
    NULLIF(BTRIM(COALESCE(p_document_number, '')), ''),
    NULLIF(BTRIM(COALESCE(p_email, '')), ''),
    NULLIF(BTRIM(COALESCE(p_phone, '')), ''),
    NULLIF(BTRIM(COALESCE(p_address, '')), ''),
    'active'
  )
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.branches (tenant_id, name, code, status)
  VALUES (
    v_tenant_id,
    COALESCE(NULLIF(BTRIM(p_branch_name), ''), 'Principal'),
    UPPER(COALESCE(NULLIF(BTRIM(p_branch_code), ''), 'MAIN')),
    'active'
  )
  RETURNING id INTO v_branch_id;

  INSERT INTO public.roles (tenant_id, name, code, description, is_system)
  SELECT v_tenant_id, r.name, r.code, r.description, true
  FROM public.roles r
  WHERE r.tenant_id IS NULL
    AND r.is_system = true;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT tenant_role.id, rp.permission_id
  FROM public.roles tenant_role
  JOIN public.roles template_role
    ON template_role.code = tenant_role.code
   AND template_role.tenant_id IS NULL
  JOIN public.role_permissions rp
    ON rp.role_id = template_role.id
  WHERE tenant_role.tenant_id = v_tenant_id;

  SELECT id INTO v_admin_role_id
  FROM public.roles
  WHERE tenant_id = v_tenant_id
    AND code = 'admin';

  IF v_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Admin role template is not seeded';
  END IF;

  INSERT INTO public.tenant_users (tenant_id, user_id, role_id, branch_id, status)
  VALUES (v_tenant_id, p_owner_id, v_admin_role_id, v_branch_id, 'active');

  INSERT INTO public.subscriptions (tenant_id, plan_id, status, starts_at)
  VALUES (v_tenant_id, v_plan_id, 'active', now());

  INSERT INTO public.tenant_settings (
    tenant_id,
    currency,
    timezone,
    business_name,
    invoice_name
  )
  VALUES (
    v_tenant_id,
    'COP',
    'America/Bogota',
    BTRIM(p_name),
    COALESCE(NULLIF(BTRIM(COALESCE(p_commercial_name, '')), ''), BTRIM(p_name))
  );

  UPDATE public.profiles
  SET active_tenant_id = v_tenant_id
  WHERE id = p_owner_id
    AND active_tenant_id IS NULL;

  RETURN v_tenant_id;
END;
$$;
