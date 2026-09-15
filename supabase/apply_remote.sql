-- Applosan Fase 1: aplicar en el SQL Editor de Supabase (nube) o con: npx supabase db push
-- Orden: schema -> functions -> rls -> catalog -> helpers de prueba
-- No incluye seed.sql (usuarios de prueba). Eso solo en local con db reset.


-- =====================================================================
-- FILE: supabase/migrations/20260822150000_phase1_schema.sql
-- =====================================================================

-- Phase 1: multi-tenant SaaS foundation (schema)
-- Inventory, sales, purchases and related modules are intentionally not created here.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  commercial_name text,
  document_number text,
  email text,
  phone text,
  address text,
  logo_url text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tenants_set_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.tenants IS 'Each row is an independent company/warehouse (SaaS tenant).';

-- ---------------------------------------------------------------------------
-- Branches
-- ---------------------------------------------------------------------------

CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  address text,
  phone text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX branches_tenant_id_idx ON public.branches (tenant_id);

CREATE TRIGGER branches_set_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.branches IS 'Physical locations of a tenant. Future inventory, sales and cash are per branch.';

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  avatar_url text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  active_tenant_id uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_active_tenant_id_idx ON public.profiles (active_tenant_id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.profiles IS 'Public profile for auth.users. Passwords never live here.';
COMMENT ON COLUMN public.profiles.active_tenant_id IS 'Current workspace. Supports a user belonging to more than one tenant later.';

-- ---------------------------------------------------------------------------
-- Roles (global templates when tenant_id IS NULL; cloned per tenant on signup)
-- ---------------------------------------------------------------------------

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX roles_system_code_uidx
  ON public.roles (code)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX roles_tenant_code_uidx
  ON public.roles (tenant_id, code)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX roles_tenant_id_idx ON public.roles (tenant_id);

CREATE TRIGGER roles_set_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.roles IS 'tenant_id NULL = global system templates. Tenant copies are created on register.';

-- ---------------------------------------------------------------------------
-- Permissions catalog (global, not tenant-scoped)
-- ---------------------------------------------------------------------------

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  module text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX permissions_module_idx ON public.permissions (module);

COMMENT ON TABLE public.permissions IS 'Global permission catalog. Future modules reuse these codes in RLS.';

-- ---------------------------------------------------------------------------
-- Role â†” permission
-- ---------------------------------------------------------------------------

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX role_permissions_permission_id_idx ON public.role_permissions (permission_id);

-- ---------------------------------------------------------------------------
-- Tenant membership (user can later belong to multiple tenants)
-- ---------------------------------------------------------------------------

CREATE TABLE public.tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.branches (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'invited')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX tenant_users_user_id_idx ON public.tenant_users (user_id);
CREATE INDEX tenant_users_tenant_id_idx ON public.tenant_users (tenant_id);
CREATE INDEX tenant_users_role_id_idx ON public.tenant_users (role_id);

CREATE TRIGGER tenant_users_set_updated_at
  BEFORE UPDATE ON public.tenant_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.tenant_users IS 'Membership of a user in a tenant, with role and optional home branch.';

-- ---------------------------------------------------------------------------
-- SaaS plans
-- ---------------------------------------------------------------------------

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  billing_period text NOT NULL DEFAULT 'none'
    CHECK (billing_period IN ('none', 'monthly', 'yearly')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX plans_one_default_uidx
  ON public.plans (is_default)
  WHERE is_default = true;

CREATE TRIGGER plans_set_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Features catalog
-- ---------------------------------------------------------------------------

CREATE TABLE public.features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Plan â†” feature (limits reserved for later monetization)
-- ---------------------------------------------------------------------------

CREATE TABLE public.plan_features (
  plan_id uuid NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.features (id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  limit_value numeric,
  limit_unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, feature_id)
);

COMMENT ON COLUMN public.plan_features.limit_value IS 'Optional cap (users, branches, products, sales, storage). Null = unlimited.';
COMMENT ON COLUMN public.plan_features.limit_unit IS 'Unit for limit_value: users, branches, products, sales, megabytes, etc.';

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_tenant_id_idx ON public.subscriptions (tenant_id);
CREATE INDEX subscriptions_plan_id_idx ON public.subscriptions (plan_id);

CREATE UNIQUE INDEX subscriptions_one_current_uidx
  ON public.subscriptions (tenant_id)
  WHERE status IN ('trial', 'active', 'past_due');

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant settings
-- ---------------------------------------------------------------------------

CREATE TABLE public.tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'COP',
  timezone text NOT NULL DEFAULT 'America/Bogota',
  default_min_stock integer NOT NULL DEFAULT 0 CHECK (default_min_stock >= 0),
  allow_credit_sales boolean NOT NULL DEFAULT true,
  allow_partial_payments boolean NOT NULL DEFAULT true,
  business_name text,
  invoice_name text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tenant_settings_set_updated_at
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.tenant_settings.extra IS 'Forward-compatible bag for settings that do not yet need a dedicated column.';

-- ---------------------------------------------------------------------------
-- Integrity: membership role/branch must belong to the same tenant
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_tenant_user_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = NEW.role_id
      AND r.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'role_id does not belong to tenant %', NEW.tenant_id;
  END IF;

  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = NEW.branch_id
      AND b.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'branch_id does not belong to tenant %', NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tenant_users_integrity
  BEFORE INSERT OR UPDATE ON public.tenant_users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_user_integrity();

CREATE OR REPLACE FUNCTION public.protect_system_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'System roles cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_system THEN
    IF NEW.is_system IS DISTINCT FROM OLD.is_system
      OR NEW.code IS DISTINCT FROM OLD.code
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    THEN
      RAISE EXCEPTION 'System roles cannot change code, tenant_id or is_system';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER roles_protect_system
  BEFORE UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_roles();

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup (hook del proveedor de Auth)
-- Supabase/GoTrue: auth.users + raw_user_meta_data.
-- InsForge: mismo patrÃ³n con auth.users; si el metadata va en profile JSONB,
-- sustituye solo este trigger, no el resto del schema.
-- ---------------------------------------------------------------------------

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
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Grants (cloud no longer auto-exposes new public objects)
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.tenants,
  public.branches,
  public.profiles,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.tenant_users,
  public.plans,
  public.features,
  public.plan_features,
  public.subscriptions,
  public.tenant_settings
TO authenticated;

-- Anon has no table access. Auth is handled by GoTrue, not by these tables.
REVOKE ALL ON TABLE
  public.tenants,
  public.branches,
  public.profiles,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.tenant_users,
  public.plans,
  public.features,
  public.plan_features,
  public.subscriptions,
  public.tenant_settings
FROM anon;

-- =====================================================================
-- FILE: supabase/migrations/20260822150001_phase1_functions.sql
-- =====================================================================

-- Phase 1: session, permission and tenant provisioning functions

-- Membership helper used by RLS. SECURITY DEFINER avoids recursive RLS on tenant_users.
CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.tenant_id = _tenant_id
      AND tu.user_id = (SELECT auth.uid())
      AND tu.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_tenant_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.active_tenant_id
  INTO v_tenant_id
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_tenant_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.tenant_id = v_tenant_id
      AND tu.user_id = v_uid
      AND tu.status = 'active'
  ) THEN
    RETURN v_tenant_id;
  END IF;

  SELECT tu.tenant_id
  INTO v_tenant_id
  FROM public.tenant_users tu
  WHERE tu.user_id = v_uid
    AND tu.status = 'active'
  ORDER BY tu.created_at
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    JOIN public.role_permissions rp ON rp.role_id = tu.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE tu.user_id = (SELECT auth.uid())
      AND tu.tenant_id = public.get_current_tenant_id()
      AND tu.status = 'active'
      AND p.code = permission_code
  );
$$;

CREATE OR REPLACE FUNCTION public.has_feature(feature_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.plan_features pf ON pf.plan_id = s.plan_id
    JOIN public.features f ON f.id = pf.feature_id
    WHERE s.tenant_id = public.get_current_tenant_id()
      AND s.status IN ('trial', 'active')
      AND f.code = feature_code
      AND pf.enabled = true
  );
$$;

CREATE OR REPLACE FUNCTION public.set_active_tenant(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id
      AND tu.user_id = v_uid
      AND tu.status = 'active'
  ) THEN
    RAISE EXCEPTION 'User is not an active member of this tenant';
  END IF;

  UPDATE public.profiles
  SET active_tenant_id = p_tenant_id
  WHERE id = v_uid;

  RETURN p_tenant_id;
END;
$$;

-- Internal provisioning. Not granted to authenticated/anon.
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

CREATE OR REPLACE FUNCTION public.register_tenant(
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
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN public.provision_tenant(
    v_uid,
    p_name,
    p_commercial_name,
    p_document_number,
    p_email,
    p_phone,
    p_address,
    p_branch_name,
    p_branch_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_session_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_tenant_id uuid;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  v_tenant_id := public.get_current_tenant_id();

  SELECT jsonb_build_object(
    'profile', to_jsonb(p),
    'tenant', to_jsonb(t),
    'membership', to_jsonb(tu),
    'role', to_jsonb(r),
    'branch', to_jsonb(b),
    'permissions', COALESCE((
      SELECT jsonb_agg(perm.code ORDER BY perm.code)
      FROM public.role_permissions rp
      JOIN public.permissions perm ON perm.id = rp.permission_id
      WHERE rp.role_id = tu.role_id
    ), '[]'::jsonb),
    'subscription', to_jsonb(s),
    'plan', to_jsonb(pl),
    'features', COALESCE((
      SELECT jsonb_agg(f.code ORDER BY f.code)
      FROM public.plan_features pf
      JOIN public.features f ON f.id = pf.feature_id
      WHERE pf.plan_id = s.plan_id
        AND pf.enabled = true
    ), '[]'::jsonb),
    'settings', to_jsonb(ts)
  )
  INTO v_result
  FROM public.profiles p
  LEFT JOIN public.tenant_users tu
    ON tu.user_id = p.id
   AND tu.tenant_id = v_tenant_id
   AND tu.status = 'active'
  LEFT JOIN public.tenants t ON t.id = tu.tenant_id
  LEFT JOIN public.roles r ON r.id = tu.role_id
  LEFT JOIN public.branches b ON b.id = tu.branch_id
  LEFT JOIN public.subscriptions s
    ON s.tenant_id = t.id
   AND s.status IN ('trial', 'active', 'past_due')
  LEFT JOIN public.plans pl ON pl.id = s.plan_id
  LEFT JOIN public.tenant_settings ts ON ts.tenant_id = t.id
  WHERE p.id = v_uid;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.is_tenant_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_feature(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_active_tenant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_tenant(uuid, text, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_tenant(text, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_session_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_feature(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_tenant(text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_session_context() TO authenticated;

-- provision_tenant is seed/internal only (postgres / service_role).
GRANT EXECUTE ON FUNCTION public.provision_tenant(uuid, text, text, text, text, text, text, text, text) TO postgres, service_role;

-- =====================================================================
-- FILE: supabase/migrations/20260822150002_phase1_rls.sql
-- =====================================================================

-- Phase 1: Row Level Security
-- Client filters are not trusted. Every tenant-scoped table is isolated by get_current_tenant_id().

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------

CREATE POLICY tenants_select_member
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(id));

CREATE POLICY tenants_update_settings
  ON public.tenants
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('settings.update')
  )
  WITH CHECK (
    id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('settings.update')
  );

-- Inserts go through register_tenant() (SECURITY DEFINER). No client INSERT/DELETE.

-- ---------------------------------------------------------------------------
-- branches
-- ---------------------------------------------------------------------------

CREATE POLICY branches_select_member
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY branches_insert_permission
  ON public.branches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('branches.create')
  );

CREATE POLICY branches_update_permission
  ON public.branches
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('branches.update')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('branches.update')
  );

CREATE POLICY branches_delete_permission
  ON public.branches
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('branches.delete')
  );

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select_self_or_directory
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (
      public.has_permission('users.view')
      AND EXISTS (
        SELECT 1
        FROM public.tenant_users tu
        WHERE tu.user_id = profiles.id
          AND tu.tenant_id = (SELECT public.get_current_tenant_id())
          AND tu.status IN ('active', 'invited', 'inactive')
      )
    )
  );

CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Inserts are created by handle_new_user().

-- ---------------------------------------------------------------------------
-- tenant_users
-- ---------------------------------------------------------------------------

CREATE POLICY tenant_users_select_self_or_directory
  ON public.tenant_users
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      tenant_id = (SELECT public.get_current_tenant_id())
      AND public.has_permission('users.view')
    )
  );

CREATE POLICY tenant_users_insert_permission
  ON public.tenant_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('users.create')
  );

CREATE POLICY tenant_users_update_permission
  ON public.tenant_users
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('users.update')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('users.update')
  );

CREATE POLICY tenant_users_delete_permission
  ON public.tenant_users
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('users.delete')
  );

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------

CREATE POLICY roles_select_member
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    OR tenant_id IS NULL
  );

CREATE POLICY roles_insert_permission
  ON public.roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND is_system = false
    AND public.has_permission('roles.create')
  );

CREATE POLICY roles_update_permission
  ON public.roles
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('roles.update')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('roles.update')
  );

CREATE POLICY roles_delete_permission
  ON public.roles
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND is_system = false
    AND public.has_permission('roles.delete')
  );

-- ---------------------------------------------------------------------------
-- permissions (global catalog)
-- ---------------------------------------------------------------------------

CREATE POLICY permissions_select_authenticated
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- role_permissions
-- ---------------------------------------------------------------------------

CREATE POLICY role_permissions_select_visible_roles
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND (
          r.tenant_id = (SELECT public.get_current_tenant_id())
          OR r.tenant_id IS NULL
        )
    )
  );

CREATE POLICY role_permissions_insert_permission
  ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('roles.update')
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = role_id
        AND r.tenant_id = (SELECT public.get_current_tenant_id())
        AND r.is_system = false
    )
  );

CREATE POLICY role_permissions_delete_permission
  ON public.role_permissions
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('roles.update')
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = role_id
        AND r.tenant_id = (SELECT public.get_current_tenant_id())
        AND r.is_system = false
    )
  );

-- ---------------------------------------------------------------------------
-- plans / features / plan_features (global SaaS catalog)
-- ---------------------------------------------------------------------------

CREATE POLICY plans_select_authenticated
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY features_select_authenticated
  ON public.features
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY plan_features_select_authenticated
  ON public.plan_features
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------

CREATE POLICY subscriptions_select_member
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- Writes are provisioning / future billing (service_role), not the mobile client.

-- ---------------------------------------------------------------------------
-- tenant_settings
-- ---------------------------------------------------------------------------

CREATE POLICY tenant_settings_select_member
  ON public.tenant_settings
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY tenant_settings_update_permission
  ON public.tenant_settings
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('settings.update')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('settings.update')
  );

-- =====================================================================
-- FILE: supabase/migrations/20260822150003_phase1_catalog.sql
-- =====================================================================

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
  ('credits.view', 'Ver crÃ©ditos', 'credits', 'Consultar crÃ©ditos'),
  ('credits.create', 'Crear crÃ©ditos', 'credits', 'Otorgar crÃ©ditos'),
  ('credits.payments', 'Registrar abonos', 'credits', 'Abonos a crÃ©ditos'),
  ('cash.view', 'Ver caja', 'cash', 'Consultar caja'),
  ('cash.open', 'Abrir caja', 'cash', 'Apertura de caja'),
  ('cash.close', 'Cerrar caja', 'cash', 'Cierre de caja'),
  ('reports.view', 'Ver reportes', 'reports', 'Reportes bÃ¡sicos'),
  ('reports.advanced', 'Reportes avanzados', 'reports', 'Reportes avanzados'),
  ('users.view', 'Ver usuarios', 'users', 'Listar usuarios del tenant'),
  ('users.create', 'Crear usuarios', 'users', 'Invitar o crear usuarios'),
  ('users.update', 'Editar usuarios', 'users', 'Actualizar usuarios'),
  ('users.delete', 'Eliminar usuarios', 'users', 'Desactivar o quitar usuarios'),
  ('roles.view', 'Ver roles', 'roles', 'Listar roles'),
  ('roles.create', 'Crear roles', 'roles', 'Crear roles personalizados'),
  ('roles.update', 'Editar roles', 'roles', 'Actualizar roles y permisos'),
  ('roles.delete', 'Eliminar roles', 'roles', 'Eliminar roles no de sistema'),
  ('settings.view', 'Ver configuraciÃ³n', 'settings', 'Consultar configuraciÃ³n del tenant'),
  ('settings.update', 'Editar configuraciÃ³n', 'settings', 'Actualizar configuraciÃ³n del tenant'),
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

-- Seller template: sales-oriented defaults
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'dashboard.view',
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
  'Plan inicial gratuito. Todas las funciones operativas bÃ¡sicas, sin reportes avanzados, exportaciones ni multi-sucursal de pago.',
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
  ('products', 'Productos', 'CatÃ¡logo de productos'),
  ('purchases', 'Compras', 'Registro de compras'),
  ('inventory', 'Inventario', 'Control de existencias'),
  ('sales', 'Ventas', 'Punto de venta'),
  ('customers', 'Clientes', 'Directorio de clientes'),
  ('credits', 'CrÃ©ditos', 'Ventas a crÃ©dito y abonos'),
  ('cash', 'Caja', 'Apertura y cierre de caja'),
  ('combos', 'Combos', 'Combos con precio propio'),
  ('basic_reports', 'Reportes bÃ¡sicos', 'Reportes operativos'),
  ('advanced_reports', 'Reportes avanzados', 'AnalÃ­tica avanzada'),
  ('exports', 'Exportaciones', 'Exportar datos'),
  ('multi_branch', 'Multi-sucursal', 'MÃ¡s de una sucursal activa'),
  ('advanced_configuration', 'ConfiguraciÃ³n avanzada', 'Ajustes avanzados del tenant')
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

-- =====================================================================
-- FILE: supabase/migrations/20260822150004_phase1_security_tests.sql
-- =====================================================================

-- Phase 1: security test helper (used after seed data exists)

CREATE OR REPLACE FUNCTION public.run_phase1_security_tests()
RETURNS TABLE(test_name text, passed boolean, details text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_a uuid := '11111111-1111-1111-1111-1111111111a1';
  v_seller_a uuid := '11111111-1111-1111-1111-1111111111a2';
  v_admin_b uuid := '11111111-1111-1111-1111-1111111111b1';
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_count integer;
  v_flag boolean;
  v_plan_code text;
BEGIN
  SELECT p.active_tenant_id INTO v_tenant_a FROM public.profiles p WHERE p.id = v_admin_a;
  SELECT p.active_tenant_id INTO v_tenant_b FROM public.profiles p WHERE p.id = v_admin_b;

  IF v_tenant_a IS NULL OR v_tenant_b IS NULL THEN
    test_name := 'seed_tenants_exist';
    passed := false;
    details := 'Seed tenants/users are missing. Run supabase/seed.sql';
    RETURN NEXT;
    RETURN;
  END IF;

  test_name := 'seed_tenants_distinct';
  passed := v_tenant_a <> v_tenant_b;
  details := format('A=%s B=%s', v_tenant_a, v_tenant_b);
  RETURN NEXT;

  -- Tenant A admin sees only tenant A
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO v_count FROM public.tenants;
  test_name := 'admin_a_sees_only_own_tenant';
  passed := v_count = 1;
  details := format('visible tenants=%s (expected 1)', v_count);
  RETURN NEXT;

  SELECT count(*) INTO v_count FROM public.tenants WHERE id = v_tenant_b;
  test_name := 'admin_a_cannot_see_tenant_b';
  passed := v_count = 0;
  details := format('visible rows for tenant B=%s', v_count);
  RETURN NEXT;

  SELECT public.has_permission('users.create') INTO v_flag;
  test_name := 'admin_a_has_users_create';
  passed := v_flag;
  details := format('has_permission(users.create)=%s', v_flag);
  RETURN NEXT;

  SELECT public.has_permission('sales.create') INTO v_flag;
  test_name := 'admin_a_has_sales_create';
  passed := v_flag;
  details := format('has_permission(sales.create)=%s', v_flag);
  RETURN NEXT;

  SELECT pl.code INTO v_plan_code
  FROM public.subscriptions s
  JOIN public.plans pl ON pl.id = s.plan_id
  WHERE s.tenant_id = v_tenant_a
    AND s.status IN ('trial', 'active')
  LIMIT 1;

  test_name := 'tenant_a_has_free_plan';
  passed := v_plan_code = 'free';
  details := format('plan=%s', v_plan_code);
  RETURN NEXT;

  EXECUTE 'RESET ROLE';

  -- Tenant B admin cannot see tenant A
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin_b::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO v_count FROM public.tenants WHERE id = v_tenant_a;
  test_name := 'admin_b_cannot_see_tenant_a';
  passed := v_count = 0;
  details := format('visible rows for tenant A=%s', v_count);
  RETURN NEXT;

  SELECT count(*) INTO v_count FROM public.tenants;
  test_name := 'admin_b_sees_only_own_tenant';
  passed := v_count = 1;
  details := format('visible tenants=%s (expected 1)', v_count);
  RETURN NEXT;

  EXECUTE 'RESET ROLE';

  -- Seller permissions
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_seller_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT public.has_permission('sales.create') INTO v_flag;
  test_name := 'seller_has_sales_create';
  passed := v_flag;
  details := format('has_permission(sales.create)=%s', v_flag);
  RETURN NEXT;

  SELECT public.has_permission('users.create') INTO v_flag;
  test_name := 'seller_lacks_users_create';
  passed := NOT v_flag;
  details := format('has_permission(users.create)=%s (expected false)', v_flag);
  RETURN NEXT;

  SELECT public.has_permission('users.delete') INTO v_flag;
  test_name := 'seller_lacks_users_delete';
  passed := NOT v_flag;
  details := format('has_permission(users.delete)=%s (expected false)', v_flag);
  RETURN NEXT;

  SELECT public.has_permission('roles.create') INTO v_flag;
  test_name := 'seller_lacks_roles_create';
  passed := NOT v_flag;
  details := format('has_permission(roles.create)=%s (expected false)', v_flag);
  RETURN NEXT;

  SELECT public.has_permission('purchases.create') INTO v_flag;
  test_name := 'seller_lacks_purchases_create';
  passed := NOT v_flag;
  details := format('has_permission(purchases.create)=%s (expected false)', v_flag);
  RETURN NEXT;

  SELECT public.has_permission('inventory.adjust') INTO v_flag;
  test_name := 'seller_lacks_inventory_adjust';
  passed := NOT v_flag;
  details := format('has_permission(inventory.adjust)=%s (expected false)', v_flag);
  RETURN NEXT;

  SELECT public.has_permission('settings.update') INTO v_flag;
  test_name := 'seller_lacks_settings_update';
  passed := NOT v_flag;
  details := format('has_permission(settings.update)=%s (expected false)', v_flag);
  RETURN NEXT;

  SELECT count(*) INTO v_count FROM public.tenant_users;
  test_name := 'seller_cannot_list_other_users';
  passed := v_count = 1;
  details := format('visible tenant_users=%s (expected 1 = self)', v_count);
  RETURN NEXT;

  BEGIN
    INSERT INTO public.branches (tenant_id, name, code)
    VALUES (v_tenant_a, 'Sucursal no autorizada', 'DENIED');
    test_name := 'seller_cannot_create_branch';
    passed := false;
    details := 'INSERT into branches succeeded but should have been denied by RLS';
    RETURN NEXT;
  EXCEPTION
    WHEN insufficient_privilege THEN
      test_name := 'seller_cannot_create_branch';
      passed := true;
      details := 'RLS denied branch insert';
      RETURN NEXT;
  END;

  BEGIN
    INSERT INTO public.tenant_users (tenant_id, user_id, role_id, status)
    SELECT v_tenant_a, v_admin_b, r.id, 'active'
    FROM public.roles r
    WHERE r.tenant_id = v_tenant_a AND r.code = 'seller'
    LIMIT 1;
    test_name := 'seller_cannot_create_user';
    passed := false;
    details := 'INSERT into tenant_users succeeded but should have been denied by RLS';
    RETURN NEXT;
  EXCEPTION
    WHEN insufficient_privilege THEN
      test_name := 'seller_cannot_create_user';
      passed := true;
      details := 'RLS denied tenant_users insert';
      RETURN NEXT;
  END;

  EXECUTE 'RESET ROLE';
END;
$$;

REVOKE ALL ON FUNCTION public.run_phase1_security_tests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_phase1_security_tests() TO postgres, service_role;
