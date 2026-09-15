-- Local/dev seed only. Not applied on supabase db push.
-- Test password for all seed users: Test1234!

CREATE OR REPLACE FUNCTION public.seed_auth_user(
  p_id uuid,
  p_email text,
  p_full_name text,
  p_password text DEFAULT 'Test1234!'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_id OR email = p_email) THEN
    RETURN;
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_sso_user,
    is_anonymous
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_full_name),
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    false
  );

  INSERT INTO auth.identities (
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    p_id,
    p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    now(),
    now(),
    now()
  );
END;
$$;

SELECT public.seed_auth_user(
  '11111111-1111-1111-1111-1111111111a1',
  'tenant-a-admin@applosan.test',
  'Admin Tenant A'
);

SELECT public.seed_auth_user(
  '11111111-1111-1111-1111-1111111111a2',
  'tenant-a-seller@applosan.test',
  'Vendedor Tenant A'
);

SELECT public.seed_auth_user(
  '11111111-1111-1111-1111-1111111111b1',
  'tenant-b-admin@applosan.test',
  'Admin Tenant B'
);

-- Tenant A: Almacén La Moda
SELECT public.provision_tenant(
  '11111111-1111-1111-1111-1111111111a1',
  'Almacén La Moda',
  'Almacén La Moda',
  '900111111-1',
  'tenant-a-admin@applosan.test',
  '3001111111',
  'Calle 1 #1-11',
  'Principal',
  'MAIN'
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenant_users
  WHERE user_id = '11111111-1111-1111-1111-1111111111a1'
);

-- Seller membership on tenant A
INSERT INTO public.tenant_users (tenant_id, user_id, role_id, branch_id, status)
SELECT
  p.active_tenant_id,
  '11111111-1111-1111-1111-1111111111a2',
  r.id,
  b.id,
  'active'
FROM public.profiles p
JOIN public.roles r
  ON r.tenant_id = p.active_tenant_id
 AND r.code = 'seller'
JOIN public.branches b
  ON b.tenant_id = p.active_tenant_id
 AND b.code = 'MAIN'
WHERE p.id = '11111111-1111-1111-1111-1111111111a1'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

UPDATE public.profiles
SET active_tenant_id = (
  SELECT active_tenant_id
  FROM public.profiles
  WHERE id = '11111111-1111-1111-1111-1111111111a1'
)
WHERE id = '11111111-1111-1111-1111-1111111111a2'
  AND active_tenant_id IS NULL;

-- Tenant B: Boutique Andrea
SELECT public.provision_tenant(
  '11111111-1111-1111-1111-1111111111b1',
  'Boutique Andrea',
  'Boutique Andrea',
  '900222222-2',
  'tenant-b-admin@applosan.test',
  '3002222222',
  'Calle 2 #2-22',
  'Principal',
  'MAIN'
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenant_users
  WHERE user_id = '11111111-1111-1111-1111-1111111111b1'
);

DO $$
DECLARE
  rec record;
  failures integer := 0;
BEGIN
  FOR rec IN SELECT * FROM public.run_phase1_security_tests() LOOP
    RAISE NOTICE '[%] passed=% details=%', rec.test_name, rec.passed, rec.details;
    IF NOT rec.passed THEN
      failures := failures + 1;
    END IF;
  END LOOP;

  IF failures > 0 THEN
    RAISE EXCEPTION 'Phase 1 security tests failed (% failures)', failures;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.seed_auth_user(uuid, text, text, text);
