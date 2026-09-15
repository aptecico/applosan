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

  -- Si el usuario se registró antes del trigger o el trigger falló, creamos el perfil aquí.
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
