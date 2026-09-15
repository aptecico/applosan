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
