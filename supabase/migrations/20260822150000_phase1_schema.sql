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
-- Role ↔ permission
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
-- Plan ↔ feature (limits reserved for later monetization)
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
-- InsForge: mismo patrón con auth.users; si el metadata va en profile JSONB,
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
  )
  ON CONFLICT (id) DO NOTHING;
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
