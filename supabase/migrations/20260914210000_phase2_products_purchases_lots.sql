-- Phase 2b: products, suppliers, purchases and inventory lots (FIFO-ready)
-- Same product can have many purchase lots with different unit costs.
-- Sales FIFO consumption comes in a later phase; lots preserve qty_remaining + purchased_at.

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  document_number text,
  email text,
  phone text,
  address text,
  notes text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX suppliers_tenant_id_idx ON public.suppliers (tenant_id);
CREATE INDEX suppliers_tenant_name_idx ON public.suppliers (tenant_id, name);

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.suppliers IS 'Vendors that supply inventory to a tenant.';

-- ---------------------------------------------------------------------------
-- Product categories
-- ---------------------------------------------------------------------------

CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.product_categories (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX product_categories_tenant_id_idx ON public.product_categories (tenant_id);

CREATE TRIGGER product_categories_set_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Products (one logical garment/SKU family; costs live on lots, not here)
-- ---------------------------------------------------------------------------

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.product_categories (id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  barcode text,
  description text,
  brand text,
  color text,
  size text,
  unit text NOT NULL DEFAULT 'unit',
  sale_price numeric(14, 2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  min_stock numeric(14, 3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  track_inventory boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'discontinued')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_tenant_id_idx ON public.products (tenant_id);
CREATE INDEX products_tenant_name_idx ON public.products (tenant_id, name);
CREATE UNIQUE INDEX products_tenant_sku_uidx
  ON public.products (tenant_id, sku)
  WHERE sku IS NOT NULL AND BTRIM(sku) <> '';

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.products IS 'Catalog item. Acquisition cost history is in inventory_lots, not averaged here.';

-- ---------------------------------------------------------------------------
-- Purchases (header)
-- ---------------------------------------------------------------------------

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers (id) ON DELETE SET NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  reference text,
  notes text,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('draft', 'received', 'cancelled')),
  subtotal numeric(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchases_tenant_id_idx ON public.purchases (tenant_id);
CREATE INDEX purchases_tenant_purchased_at_idx ON public.purchases (tenant_id, purchased_at DESC);
CREATE INDEX purchases_branch_id_idx ON public.purchases (branch_id);

CREATE TRIGGER purchases_set_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.purchases IS 'Purchase document. Each line can create an inventory lot with its own unit_cost.';

-- ---------------------------------------------------------------------------
-- Purchase items (line: qty + unit cost for THIS acquisition)
-- ---------------------------------------------------------------------------

CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.purchases (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(14, 2) NOT NULL CHECK (unit_cost >= 0),
  line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_items_purchase_id_idx ON public.purchase_items (purchase_id);
CREATE INDEX purchase_items_product_id_idx ON public.purchase_items (product_id);
CREATE INDEX purchase_items_tenant_id_idx ON public.purchase_items (tenant_id);

COMMENT ON COLUMN public.purchase_items.unit_cost IS 'Cost for this purchase only. Same product may have other costs in other rows.';

-- ---------------------------------------------------------------------------
-- Inventory lots (FIFO source of truth for remaining qty + cost)
-- ---------------------------------------------------------------------------

CREATE TABLE public.inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  purchase_item_id uuid REFERENCES public.purchase_items (id) ON DELETE SET NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  qty_received numeric(14, 3) NOT NULL CHECK (qty_received > 0),
  qty_remaining numeric(14, 3) NOT NULL CHECK (qty_remaining >= 0),
  unit_cost numeric(14, 2) NOT NULL CHECK (unit_cost >= 0),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'depleted', 'void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (qty_remaining <= qty_received)
);

CREATE INDEX inventory_lots_fifo_idx
  ON public.inventory_lots (tenant_id, branch_id, product_id, purchased_at ASC)
  WHERE status = 'open' AND qty_remaining > 0;

CREATE INDEX inventory_lots_product_idx ON public.inventory_lots (product_id);
CREATE INDEX inventory_lots_purchase_item_idx ON public.inventory_lots (purchase_item_id);

CREATE TRIGGER inventory_lots_set_updated_at
  BEFORE UPDATE ON public.inventory_lots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.inventory_lots IS 'Cost layers. Sell FIFO by consuming oldest open lots (purchased_at ASC).';

-- ---------------------------------------------------------------------------
-- Inventory balances (read model: sum of open lots)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.inventory_balances
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  branch_id,
  product_id,
  COALESCE(SUM(qty_remaining), 0)::numeric(14, 3) AS qty_on_hand,
  COUNT(*) FILTER (WHERE qty_remaining > 0)::integer AS open_lots
FROM public.inventory_lots
WHERE status = 'open'
GROUP BY tenant_id, branch_id, product_id;

COMMENT ON VIEW public.inventory_balances IS 'Aggregated stock from lots. Does not destroy lot-level cost history.';

-- ---------------------------------------------------------------------------
-- Receive purchase RPC: creates lots in one transaction
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.receive_purchase(p_purchase_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item public.purchase_items%ROWTYPE;
BEGIN
  IF NOT public.has_permission('purchases.create')
     AND NOT public.has_permission('purchases.update') THEN
    RAISE EXCEPTION 'Not allowed to receive purchases';
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
    AND tenant_id = public.get_current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;

  IF v_purchase.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot receive a cancelled purchase';
  END IF;

  IF v_purchase.status = 'received'
     AND EXISTS (SELECT 1 FROM public.inventory_lots WHERE purchase_item_id IN (
       SELECT id FROM public.purchase_items WHERE purchase_id = p_purchase_id
     )) THEN
    RETURN p_purchase_id;
  END IF;

  FOR v_item IN
    SELECT * FROM public.purchase_items WHERE purchase_id = p_purchase_id
  LOOP
    INSERT INTO public.inventory_lots (
      tenant_id,
      branch_id,
      product_id,
      purchase_item_id,
      purchased_at,
      qty_received,
      qty_remaining,
      unit_cost,
      status
    )
    VALUES (
      v_purchase.tenant_id,
      v_purchase.branch_id,
      v_item.product_id,
      v_item.id,
      v_purchase.purchased_at,
      v_item.quantity,
      v_item.quantity,
      v_item.unit_cost,
      'open'
    );
  END LOOP;

  UPDATE public.purchases
  SET status = 'received'
  WHERE id = p_purchase_id;

  RETURN p_purchase_id;
END;
$$;

REVOKE ALL ON FUNCTION public.receive_purchase(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_purchase(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;

-- suppliers
CREATE POLICY suppliers_select ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.view')
  );
CREATE POLICY suppliers_insert ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.create')
  );
CREATE POLICY suppliers_update ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.update')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.update')
  );

-- categories
CREATE POLICY product_categories_select ON public.product_categories
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('products.view')
  );
CREATE POLICY product_categories_insert ON public.product_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('products.create')
  );
CREATE POLICY product_categories_update ON public.product_categories
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('products.update')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('products.update')
  );
CREATE POLICY product_categories_delete ON public.product_categories
  FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('products.delete')
  );

-- products
CREATE POLICY products_select ON public.products
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND (
      public.has_permission('products.view')
      OR public.has_permission('sales.create')
      OR public.has_permission('inventory.view')
    )
  );
CREATE POLICY products_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('products.create')
  );
CREATE POLICY products_update ON public.products
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('products.update')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('products.update')
  );
CREATE POLICY products_delete ON public.products
  FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('products.delete')
  );

-- purchases
CREATE POLICY purchases_select ON public.purchases
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.view')
  );
CREATE POLICY purchases_insert ON public.purchases
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.create')
  );
CREATE POLICY purchases_update ON public.purchases
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.update')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.update')
  );

-- purchase_items
CREATE POLICY purchase_items_select ON public.purchase_items
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.view')
  );
CREATE POLICY purchase_items_insert ON public.purchase_items
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.create')
  );
CREATE POLICY purchase_items_update ON public.purchase_items
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.update')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.update')
  );
CREATE POLICY purchase_items_delete ON public.purchase_items
  FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.update')
  );

-- inventory_lots
CREATE POLICY inventory_lots_select ON public.inventory_lots
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND (
      public.has_permission('inventory.view')
      OR public.has_permission('sales.create')
      OR public.has_permission('purchases.view')
    )
  );
CREATE POLICY inventory_lots_insert ON public.inventory_lots
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND (
      public.has_permission('purchases.create')
      OR public.has_permission('inventory.adjust')
    )
  );
CREATE POLICY inventory_lots_update ON public.inventory_lots
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND (
      public.has_permission('inventory.adjust')
      OR public.has_permission('purchases.update')
      OR public.has_permission('sales.create')
    )
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND (
      public.has_permission('inventory.adjust')
      OR public.has_permission('purchases.update')
      OR public.has_permission('sales.create')
    )
  );

-- ---------------------------------------------------------------------------
-- Grants (cloud requires explicit grants)
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.suppliers,
  public.product_categories,
  public.products,
  public.purchases,
  public.purchase_items,
  public.inventory_lots
TO authenticated;

GRANT SELECT ON public.inventory_balances TO authenticated;

REVOKE ALL ON TABLE
  public.suppliers,
  public.product_categories,
  public.products,
  public.purchases,
  public.purchase_items,
  public.inventory_lots
FROM anon;
