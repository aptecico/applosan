-- Phase 3a: customers table (minimal) for Clientes module
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  document_number text,
  phone text,
  email text,
  address text,
  notes text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_tenant_id_idx ON public.customers (tenant_id);
CREATE INDEX IF NOT EXISTS customers_tenant_name_idx ON public.customers (tenant_id, full_name);

DROP TRIGGER IF EXISTS customers_set_updated_at ON public.customers;
CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_select ON public.customers;
CREATE POLICY customers_select ON public.customers
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('customers.view')
  );

DROP POLICY IF EXISTS customers_insert ON public.customers;
CREATE POLICY customers_insert ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('customers.create')
  );

DROP POLICY IF EXISTS customers_update ON public.customers;
CREATE POLICY customers_update ON public.customers
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('customers.update')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('customers.update')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO authenticated;
REVOKE ALL ON TABLE public.customers FROM anon;
