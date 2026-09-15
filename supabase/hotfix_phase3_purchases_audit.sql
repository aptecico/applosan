-- Purchases redesign: audit trail, cancel/delete permission, safe sync/cancel RPCs

-- ---------------------------------------------------------------------------
-- Permission: anular compras
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, name, module, description) VALUES
  ('purchases.delete', 'Anular compras', 'purchases', 'Anular compras recibidas y revertir lotes intactos')
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- Admin template gets every permission (including new ones)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.tenant_id IS NULL
  AND r.code = 'admin'
  AND p.code = 'purchases.delete'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'purchases.delete'
WHERE r.tenant_id IS NOT NULL
  AND r.code = 'admin'
  AND r.is_system = true
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Audit events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.purchase_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.purchases (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL
    CHECK (action IN (
      'created',
      'received',
      'updated',
      'item_added',
      'item_removed',
      'item_changed',
      'cancelled'
    )),
  summary text NOT NULL,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_audit_events_purchase_idx
  ON public.purchase_audit_events (purchase_id, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_audit_events_tenant_idx
  ON public.purchase_audit_events (tenant_id, created_at DESC);

ALTER TABLE public.purchase_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_audit_events_select ON public.purchase_audit_events;
CREATE POLICY purchase_audit_events_select ON public.purchase_audit_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('purchases.view')
  );

-- Inserts only via SECURITY DEFINER RPCs
GRANT SELECT ON TABLE public.purchase_audit_events TO authenticated;
REVOKE ALL ON TABLE public.purchase_audit_events FROM anon;

CREATE OR REPLACE FUNCTION public.log_purchase_audit(
  p_purchase_id uuid,
  p_action text,
  p_summary text,
  p_reason text DEFAULT NULL,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant
  FROM public.purchases
  WHERE id = p_purchase_id;

  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.purchase_audit_events (
    tenant_id, purchase_id, actor_id, action, summary, reason, before_data, after_data
  )
  VALUES (
    v_tenant,
    p_purchase_id,
    (SELECT auth.uid()),
    p_action,
    p_summary,
    NULLIF(BTRIM(COALESCE(p_reason, '')), ''),
    p_before,
    p_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_purchase_audit(uuid, text, text, text, jsonb, jsonb) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Cancel purchase (logical). Voids intact lots only.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_purchase(
  p_purchase_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_lot public.inventory_lots%ROWTYPE;
  v_reason text := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.has_permission('purchases.delete')
     AND NOT public.has_permission('purchases.update') THEN
    RAISE EXCEPTION 'Not allowed to cancel purchases';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Motivo de anulación requerido';
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
    RETURN p_purchase_id;
  END IF;

  -- Cannot cancel if any lot from this purchase was partially sold
  IF EXISTS (
    SELECT 1
    FROM public.inventory_lots l
    JOIN public.purchase_items i ON i.id = l.purchase_item_id
    WHERE i.purchase_id = p_purchase_id
      AND l.status = 'open'
      AND l.qty_remaining < l.qty_received
  ) THEN
    RAISE EXCEPTION 'No se puede anular: parte del inventario de esta compra ya se vendió';
  END IF;

  FOR v_lot IN
    SELECT l.*
    FROM public.inventory_lots l
    JOIN public.purchase_items i ON i.id = l.purchase_item_id
    WHERE i.purchase_id = p_purchase_id
      AND l.status = 'open'
  LOOP
    UPDATE public.inventory_lots
    SET qty_remaining = 0,
        status = 'void',
        updated_at = now()
    WHERE id = v_lot.id;
  END LOOP;

  UPDATE public.purchases
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_purchase_id;

  PERFORM public.log_purchase_audit(
    p_purchase_id,
    'cancelled',
    'Compra anulada',
    v_reason,
    to_jsonb(v_purchase),
    jsonb_build_object('status', 'cancelled')
  );

  RETURN p_purchase_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_purchase(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_purchase(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Sync purchase lines (draft or received with intact lots)
-- p_lines: [{product_id, quantity, unit_cost}]
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_purchase(
  p_purchase_id uuid,
  p_supplier_id uuid,
  p_purchased_at timestamptz,
  p_reference text,
  p_notes text,
  p_lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item public.purchase_items%ROWTYPE;
  v_lot public.inventory_lots%ROWTYPE;
  v_line jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_cost numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_new_item_id uuid;
  v_before jsonb;
  v_changes text := '';
BEGIN
  IF NOT public.has_permission('purchases.update')
     AND NOT public.has_permission('purchases.create') THEN
    RAISE EXCEPTION 'Not allowed to update purchases';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'La compra debe tener al menos un producto';
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
    RAISE EXCEPTION 'No se puede editar una compra anulada';
  END IF;

  IF v_purchase.status = 'received' AND EXISTS (
    SELECT 1
    FROM public.inventory_lots l
    JOIN public.purchase_items i ON i.id = l.purchase_item_id
    WHERE i.purchase_id = p_purchase_id
      AND l.status = 'open'
      AND l.qty_remaining < l.qty_received
  ) THEN
    RAISE EXCEPTION 'No se puede editar: hay unidades ya vendidas de esta compra';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'product_id', product_id,
    'quantity', quantity,
    'unit_cost', unit_cost
  )) INTO v_before
  FROM public.purchase_items
  WHERE purchase_id = p_purchase_id;

  -- Remove existing lots (intact) and items, then recreate
  IF v_purchase.status = 'received' THEN
    UPDATE public.inventory_lots l
    SET qty_remaining = 0,
        status = 'void',
        updated_at = now()
    FROM public.purchase_items i
    WHERE i.purchase_id = p_purchase_id
      AND l.purchase_item_id = i.id
      AND l.status = 'open';
  END IF;

  DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line ->> 'product_id')::uuid;
    v_qty := (v_line ->> 'quantity')::numeric;
    v_cost := (v_line ->> 'unit_cost')::numeric;

    IF v_product_id IS NULL OR v_qty IS NULL OR v_cost IS NULL OR v_qty <= 0 OR v_cost < 0 THEN
      RAISE EXCEPTION 'Cada línea necesita producto, cantidad > 0 y costo >= 0';
    END IF;

    v_line_total := round(v_qty * v_cost, 2);
    v_subtotal := v_subtotal + v_line_total;

    INSERT INTO public.purchase_items (
      tenant_id, purchase_id, product_id, quantity, unit_cost, line_total
    )
    VALUES (
      v_purchase.tenant_id, p_purchase_id, v_product_id, v_qty, v_cost, v_line_total
    )
    RETURNING id INTO v_new_item_id;

    IF v_purchase.status = 'received' THEN
      INSERT INTO public.inventory_lots (
        tenant_id, branch_id, product_id, purchase_item_id, purchased_at,
        qty_received, qty_remaining, unit_cost, status
      )
      VALUES (
        v_purchase.tenant_id,
        v_purchase.branch_id,
        v_product_id,
        v_new_item_id,
        COALESCE(p_purchased_at, v_purchase.purchased_at),
        v_qty,
        v_qty,
        v_cost,
        'open'
      );
    END IF;
  END LOOP;

  UPDATE public.purchases
  SET supplier_id = p_supplier_id,
      purchased_at = COALESCE(p_purchased_at, purchased_at),
      reference = NULLIF(BTRIM(COALESCE(p_reference, '')), ''),
      notes = NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
      subtotal = v_subtotal,
      tax_total = 0,
      total = v_subtotal,
      updated_at = now()
  WHERE id = p_purchase_id;

  PERFORM public.log_purchase_audit(
    p_purchase_id,
    'updated',
    'Compra actualizada (productos, cantidades o costos)',
    NULL,
    v_before,
    p_lines
  );

  RETURN p_purchase_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_purchase(uuid, uuid, timestamptz, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_purchase(uuid, uuid, timestamptz, text, text, jsonb) TO authenticated;

-- Log create when receiving for the first time (extend receive_purchase)
CREATE OR REPLACE FUNCTION public.receive_purchase(p_purchase_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item public.purchase_items%ROWTYPE;
  v_already boolean;
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

  SELECT EXISTS (
    SELECT 1 FROM public.inventory_lots WHERE purchase_item_id IN (
      SELECT id FROM public.purchase_items WHERE purchase_id = p_purchase_id
    )
  ) INTO v_already;

  IF v_purchase.status = 'received' AND v_already THEN
    RETURN p_purchase_id;
  END IF;

  FOR v_item IN
    SELECT * FROM public.purchase_items WHERE purchase_id = p_purchase_id
  LOOP
    INSERT INTO public.inventory_lots (
      tenant_id, branch_id, product_id, purchase_item_id, purchased_at,
      qty_received, qty_remaining, unit_cost, status
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

  PERFORM public.log_purchase_audit(
    p_purchase_id,
    'received',
    'Compra recibida: inventario actualizado con lotes de costo',
    NULL,
    NULL,
    jsonb_build_object('status', 'received')
  );

  RETURN p_purchase_id;
END;
$$;
