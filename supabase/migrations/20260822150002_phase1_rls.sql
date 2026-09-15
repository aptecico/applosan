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
