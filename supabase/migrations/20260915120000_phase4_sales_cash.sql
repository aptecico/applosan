-- Phase 4: cash sessions, sales, receivables, inventory movements, FIFO consume
-- Rule: no financial movement without an open cash session (enforced in RPCs).
-- Purchases remain inventory-only and do NOT require cash.

-- ---------------------------------------------------------------------------
-- Seller role: allow cash open/view/close (needed to sell)
-- ---------------------------------------------------------------------------

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('cash.view', 'cash.open', 'cash.close')
WHERE r.tenant_id IS NULL
  AND r.code = 'seller'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.roles tpl ON tpl.code = 'seller' AND tpl.tenant_id IS NULL
JOIN public.role_permissions rp ON rp.role_id = tpl.id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE r.tenant_id IS NOT NULL
  AND r.code = 'seller'
  AND p.code IN ('cash.view', 'cash.open', 'cash.close')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Cash sessions
-- ---------------------------------------------------------------------------

CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  opened_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  closed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_cash numeric(14, 2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
  expected_cash numeric(14, 2),
  counted_cash numeric(14, 2),
  difference numeric(14, 2),
  difference_reason text,
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cash_sessions_one_open_per_user_branch
  ON public.cash_sessions (tenant_id, branch_id, opened_by)
  WHERE status = 'open';

CREATE INDEX cash_sessions_tenant_opened_at_idx
  ON public.cash_sessions (tenant_id, opened_at DESC);

CREATE TRIGGER cash_sessions_set_updated_at
  BEFORE UPDATE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.cash_sessions IS 'Cash drawer session per user+branch. Financial ops require status=open.';

-- ---------------------------------------------------------------------------
-- Cash movements
-- ---------------------------------------------------------------------------

CREATE TABLE public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  cash_session_id uuid NOT NULL REFERENCES public.cash_sessions (id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN (
    'sale_cash',
    'sale_transfer',
    'sale_credit',
    'credit_payment_cash',
    'credit_payment_transfer',
    'cash_in',
    'cash_out',
    'expense',
    'refund'
  )),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'credit')),
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
  affects_cash boolean NOT NULL DEFAULT false,
  reference_type text,
  reference_id uuid,
  summary text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cash_movements_session_idx ON public.cash_movements (cash_session_id, created_at);
CREATE INDEX cash_movements_tenant_idx ON public.cash_movements (tenant_id, created_at DESC);

COMMENT ON COLUMN public.cash_movements.affects_cash IS 'True only for physical cash in/out. Transfer/credit summary rows are false.';

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  cash_session_id uuid NOT NULL REFERENCES public.cash_sessions (id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  sold_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'credit')),
  subtotal numeric(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  tax_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  amount_received numeric(14, 2),
  change_given numeric(14, 2),
  transfer_reference text,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sales_tenant_sold_at_idx ON public.sales (tenant_id, sold_at DESC);
CREATE INDEX sales_session_idx ON public.sales (cash_session_id);
CREATE INDEX sales_customer_idx ON public.sales (customer_id);

CREATE TRIGGER sales_set_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
  unit_cost numeric(14, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sale_items_sale_idx ON public.sale_items (sale_id);

-- ---------------------------------------------------------------------------
-- Receivables / credit payments
-- ---------------------------------------------------------------------------

CREATE TABLE public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  sale_id uuid NOT NULL UNIQUE REFERENCES public.sales (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  total numeric(14, 2) NOT NULL CHECK (total >= 0),
  paid numeric(14, 2) NOT NULL DEFAULT 0 CHECK (paid >= 0),
  balance numeric(14, 2) NOT NULL CHECK (balance >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (paid + balance = total)
);

CREATE INDEX receivables_tenant_status_idx ON public.receivables (tenant_id, status);
CREATE INDEX receivables_customer_idx ON public.receivables (customer_id);

CREATE TRIGGER receivables_set_updated_at
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.credit_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  receivable_id uuid NOT NULL REFERENCES public.receivables (id) ON DELETE CASCADE,
  cash_session_id uuid NOT NULL REFERENCES public.cash_sessions (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  transfer_reference text,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_payments_receivable_idx ON public.credit_payments (receivable_id, created_at);

-- ---------------------------------------------------------------------------
-- Inventory movements (audit trail; lots remain source of truth for stock)
-- ---------------------------------------------------------------------------

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN (
    'purchase_in',
    'sale_out',
    'adjustment',
    'void_in',
    'void_out'
  )),
  quantity numeric(14, 3) NOT NULL,
  unit_cost numeric(14, 2),
  reference_type text,
  reference_id uuid,
  summary text NOT NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_movements_product_idx
  ON public.inventory_movements (tenant_id, product_id, created_at DESC);
CREATE INDEX inventory_movements_branch_idx
  ON public.inventory_movements (tenant_id, branch_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.require_open_cash_session(
  p_branch_id uuid,
  p_user_id uuid
)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.cash_sessions%ROWTYPE;
  v_tenant uuid := public.get_current_tenant_id();
BEGIN
  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE tenant_id = v_tenant
    AND branch_id = p_branch_id
    AND opened_by = p_user_id
    AND status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caja cerrada. Debes abrir la caja antes de realizar esta operación.';
  END IF;

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_inventory_fifo(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_actor uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining numeric := p_quantity;
  v_lot public.inventory_lots%ROWTYPE;
  v_take numeric;
  v_cost_total numeric := 0;
  v_avg_cost numeric := 0;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que 0.';
  END IF;

  FOR v_lot IN
    SELECT *
    FROM public.inventory_lots
    WHERE tenant_id = p_tenant_id
      AND branch_id = p_branch_id
      AND product_id = p_product_id
      AND status = 'open'
      AND qty_remaining > 0
    ORDER BY purchased_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_lot.qty_remaining, v_remaining);
    UPDATE public.inventory_lots
    SET
      qty_remaining = qty_remaining - v_take,
      status = CASE WHEN qty_remaining - v_take <= 0 THEN 'depleted' ELSE 'open' END
    WHERE id = v_lot.id;
    v_cost_total := v_cost_total + (v_take * v_lot.unit_cost);
    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Stock insuficiente para completar la venta.';
  END IF;

  v_avg_cost := CASE WHEN p_quantity > 0 THEN v_cost_total / p_quantity ELSE 0 END;

  INSERT INTO public.inventory_movements (
    tenant_id, branch_id, product_id, movement_type, quantity, unit_cost,
    reference_type, reference_id, summary, created_by
  ) VALUES (
    p_tenant_id, p_branch_id, p_product_id, 'sale_out', -p_quantity, v_avg_cost,
    p_reference_type, p_reference_id, 'Salida por venta', p_actor
  );

  RETURN v_avg_cost;
END;
$$;

-- Log purchase_in when receive_purchase creates lots
CREATE OR REPLACE FUNCTION public.receive_purchase(p_purchase_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_item public.purchase_items%ROWTYPE;
  v_actor uuid;
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

  v_actor := v_purchase.created_by;

  FOR v_item IN
    SELECT * FROM public.purchase_items WHERE purchase_id = p_purchase_id
  LOOP
    INSERT INTO public.inventory_lots (
      tenant_id, branch_id, product_id, purchase_item_id, purchased_at,
      qty_received, qty_remaining, unit_cost, status
    ) VALUES (
      v_purchase.tenant_id, v_purchase.branch_id, v_item.product_id, v_item.id,
      v_purchase.purchased_at, v_item.quantity, v_item.quantity, v_item.unit_cost, 'open'
    );

    INSERT INTO public.inventory_movements (
      tenant_id, branch_id, product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, summary, created_by
    ) VALUES (
      v_purchase.tenant_id, v_purchase.branch_id, v_item.product_id, 'purchase_in',
      v_item.quantity, v_item.unit_cost, 'purchase', p_purchase_id,
      'Entrada por compra', v_actor
    );
  END LOOP;

  UPDATE public.purchases SET status = 'received' WHERE id = p_purchase_id;
  RETURN p_purchase_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cash RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_open_cash_session(p_branch_id uuid DEFAULT NULL)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.cash_sessions%ROWTYPE;
  v_tenant uuid := public.get_current_tenant_id();
  v_user uuid := auth.uid();
  v_branch uuid;
BEGIN
  IF NOT public.has_permission('cash.view')
     AND NOT public.has_permission('cash.open')
     AND NOT public.has_permission('sales.create') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar caja.';
  END IF;

  v_branch := COALESCE(
    p_branch_id,
    (SELECT branch_id FROM public.tenant_users
     WHERE tenant_id = v_tenant AND user_id = v_user AND status = 'active' LIMIT 1)
  );

  IF v_branch IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE tenant_id = v_tenant
    AND branch_id = v_branch
    AND opened_by = v_user
    AND status = 'open';

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_cash_session(
  p_branch_id uuid,
  p_opening_cash numeric,
  p_notes text DEFAULT NULL
)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_current_tenant_id();
  v_user uuid := auth.uid();
  v_session public.cash_sessions%ROWTYPE;
BEGIN
  IF NOT public.has_permission('cash.open') THEN
    RAISE EXCEPTION 'No tienes permiso para abrir caja.';
  END IF;

  IF p_opening_cash IS NULL OR p_opening_cash < 0 THEN
    RAISE EXCEPTION 'Indica un efectivo inicial válido (>= 0).';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_branch_id AND tenant_id = v_tenant AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Sucursal no válida.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cash_sessions
    WHERE tenant_id = v_tenant
      AND branch_id = p_branch_id
      AND opened_by = v_user
      AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Ya existe una caja abierta.';
  END IF;

  INSERT INTO public.cash_sessions (
    tenant_id, branch_id, opened_by, status, opening_cash, notes
  ) VALUES (
    v_tenant, p_branch_id, v_user, 'open', p_opening_cash, NULLIF(BTRIM(COALESCE(p_notes, '')), '')
  )
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_cash_session(
  p_session_id uuid,
  p_counted_cash numeric,
  p_difference_reason text DEFAULT NULL
)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_current_tenant_id();
  v_user uuid := auth.uid();
  v_session public.cash_sessions%ROWTYPE;
  v_expected numeric := 0;
  v_diff numeric := 0;
BEGIN
  IF NOT public.has_permission('cash.close') THEN
    RAISE EXCEPTION 'No tienes permiso para cerrar caja.';
  END IF;

  IF p_counted_cash IS NULL OR p_counted_cash < 0 THEN
    RAISE EXCEPTION 'Indica el efectivo contado (>= 0).';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE id = p_session_id AND tenant_id = v_tenant
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caja no encontrada.';
  END IF;

  IF v_session.status = 'closed' THEN
    RAISE EXCEPTION 'Esta caja ya está cerrada.';
  END IF;

  IF v_session.opened_by <> v_user AND NOT public.has_permission('cash.close') THEN
    RAISE EXCEPTION 'No puedes cerrar la caja de otro usuario.';
  END IF;

  SELECT COALESCE(v_session.opening_cash, 0)
    + COALESCE(SUM(CASE WHEN affects_cash THEN
        CASE WHEN type IN ('cash_out', 'expense', 'refund') THEN -amount ELSE amount END
      ELSE 0 END), 0)
  INTO v_expected
  FROM public.cash_movements
  WHERE cash_session_id = v_session.id;

  v_diff := p_counted_cash - v_expected;

  IF v_diff <> 0 AND NULLIF(BTRIM(COALESCE(p_difference_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Indica el motivo de la diferencia de caja.';
  END IF;

  UPDATE public.cash_sessions
  SET
    status = 'closed',
    closed_by = v_user,
    closed_at = now(),
    expected_cash = v_expected,
    counted_cash = p_counted_cash,
    difference = v_diff,
    difference_reason = NULLIF(BTRIM(COALESCE(p_difference_reason, '')), '')
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_cash_movement(
  p_type text,
  p_amount numeric,
  p_summary text,
  p_branch_id uuid DEFAULT NULL
)
RETURNS public.cash_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_current_tenant_id();
  v_user uuid := auth.uid();
  v_branch uuid;
  v_session public.cash_sessions%ROWTYPE;
  v_row public.cash_movements%ROWTYPE;
  v_affects boolean;
  v_method text;
BEGIN
  IF NOT public.has_permission('cash.open')
     AND NOT public.has_permission('cash.close') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar movimientos de caja.';
  END IF;

  IF p_type NOT IN ('cash_in', 'cash_out', 'expense') THEN
    RAISE EXCEPTION 'Tipo de movimiento no permitido.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor que 0.';
  END IF;

  v_branch := COALESCE(
    p_branch_id,
    (SELECT branch_id FROM public.tenant_users
     WHERE tenant_id = v_tenant AND user_id = v_user AND status = 'active' LIMIT 1)
  );

  v_session := public.require_open_cash_session(v_branch, v_user);
  v_affects := true;
  v_method := 'cash';

  INSERT INTO public.cash_movements (
    tenant_id, branch_id, cash_session_id, type, payment_method, amount,
    affects_cash, summary, created_by
  ) VALUES (
    v_tenant, v_branch, v_session.id, p_type, v_method, p_amount,
    v_affects, COALESCE(NULLIF(BTRIM(p_summary), ''), p_type), v_user
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Create sale
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_sale(
  p_branch_id uuid,
  p_payment_method text,
  p_lines jsonb,
  p_customer_id uuid DEFAULT NULL,
  p_amount_received numeric DEFAULT NULL,
  p_transfer_reference text DEFAULT NULL,
  p_discount_total numeric DEFAULT 0,
  p_tax_total numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_current_tenant_id();
  v_user uuid := auth.uid();
  v_session public.cash_sessions%ROWTYPE;
  v_sale_id uuid;
  v_line jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_price numeric;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_line_total numeric;
  v_unit_cost numeric;
  v_change numeric := 0;
  v_settings public.tenant_settings%ROWTYPE;
  v_move_type text;
  v_affects boolean;
BEGIN
  IF NOT public.has_permission('sales.create') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar ventas.';
  END IF;

  IF p_payment_method NOT IN ('cash', 'transfer', 'credit') THEN
    RAISE EXCEPTION 'Método de pago no válido.';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos un producto.';
  END IF;

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant;

  IF p_payment_method = 'credit' THEN
    IF v_settings.allow_credit_sales IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Las ventas a crédito no están habilitadas.';
    END IF;
    IF p_customer_id IS NULL THEN
      RAISE EXCEPTION 'Selecciona un cliente para la venta a crédito.';
    END IF;
  END IF;

  v_session := public.require_open_cash_session(p_branch_id, v_user);

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_price := (v_line->>'unit_price')::numeric;
    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 OR v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'Línea de venta inválida.';
    END IF;
    v_subtotal := v_subtotal + (v_qty * v_price);
  END LOOP;

  v_total := GREATEST(0, v_subtotal - COALESCE(p_discount_total, 0) + COALESCE(p_tax_total, 0));

  IF p_payment_method = 'cash' THEN
    IF p_amount_received IS NULL OR p_amount_received < v_total THEN
      RAISE EXCEPTION 'El monto recibido debe cubrir el total de la venta.';
    END IF;
    v_change := p_amount_received - v_total;
  END IF;

  INSERT INTO public.sales (
    tenant_id, branch_id, cash_session_id, customer_id, payment_method,
    subtotal, discount_total, tax_total, total,
    amount_received, change_given, transfer_reference, notes, created_by, status
  ) VALUES (
    v_tenant, p_branch_id, v_session.id, p_customer_id, p_payment_method,
    v_subtotal, COALESCE(p_discount_total, 0), COALESCE(p_tax_total, 0), v_total,
    CASE WHEN p_payment_method = 'cash' THEN p_amount_received ELSE NULL END,
    CASE WHEN p_payment_method = 'cash' THEN v_change ELSE NULL END,
    CASE WHEN p_payment_method = 'transfer' THEN NULLIF(BTRIM(COALESCE(p_transfer_reference, '')), '') ELSE NULL END,
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    v_user,
    'completed'
  )
  RETURNING id INTO v_sale_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'quantity')::numeric;
    v_price := (v_line->>'unit_price')::numeric;
    v_line_total := v_qty * v_price;
    v_unit_cost := public.consume_inventory_fifo(
      v_tenant, p_branch_id, v_product_id, v_qty, 'sale', v_sale_id, v_user
    );
    INSERT INTO public.sale_items (
      tenant_id, sale_id, product_id, quantity, unit_price, line_total, unit_cost
    ) VALUES (
      v_tenant, v_sale_id, v_product_id, v_qty, v_price, v_line_total, v_unit_cost
    );
  END LOOP;

  IF p_payment_method = 'cash' THEN
    v_move_type := 'sale_cash';
    v_affects := true;
  ELSIF p_payment_method = 'transfer' THEN
    v_move_type := 'sale_transfer';
    v_affects := false;
  ELSE
    v_move_type := 'sale_credit';
    v_affects := false;
  END IF;

  INSERT INTO public.cash_movements (
    tenant_id, branch_id, cash_session_id, type, payment_method, amount,
    affects_cash, reference_type, reference_id, summary, created_by, meta
  ) VALUES (
    v_tenant, p_branch_id, v_session.id, v_move_type, p_payment_method, v_total,
    v_affects, 'sale', v_sale_id,
    CASE p_payment_method
      WHEN 'cash' THEN 'Venta en efectivo'
      WHEN 'transfer' THEN 'Venta por transferencia'
      ELSE 'Venta a crédito'
    END,
    v_user,
    jsonb_build_object(
      'amount_received', p_amount_received,
      'change_given', v_change,
      'transfer_reference', p_transfer_reference
    )
  );

  IF p_payment_method = 'credit' THEN
    INSERT INTO public.receivables (
      tenant_id, branch_id, sale_id, customer_id, total, paid, balance, status
    ) VALUES (
      v_tenant, p_branch_id, v_sale_id, p_customer_id, v_total, 0, v_total, 'pending'
    );
  END IF;

  RETURN v_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_credit_payment(
  p_receivable_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_transfer_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_current_tenant_id();
  v_user uuid := auth.uid();
  v_recv public.receivables%ROWTYPE;
  v_session public.cash_sessions%ROWTYPE;
  v_payment_id uuid;
  v_settings public.tenant_settings%ROWTYPE;
  v_new_paid numeric;
  v_new_balance numeric;
  v_status text;
  v_move_type text;
  v_affects boolean;
BEGIN
  IF NOT public.has_permission('credits.payments') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar abonos.';
  END IF;

  IF p_payment_method NOT IN ('cash', 'transfer') THEN
    RAISE EXCEPTION 'Método de pago no válido.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El abono debe ser mayor que 0.';
  END IF;

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant;
  IF v_settings.allow_partial_payments IS DISTINCT FROM true AND p_amount IS NOT NULL THEN
    -- still allow full payment even if partial disabled
    NULL;
  END IF;

  SELECT * INTO v_recv
  FROM public.receivables
  WHERE id = p_receivable_id AND tenant_id = v_tenant
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta por cobrar no encontrada.';
  END IF;

  IF v_recv.status = 'paid' OR v_recv.balance <= 0 THEN
    RAISE EXCEPTION 'Esta cuenta ya está pagada.';
  END IF;

  IF p_amount > v_recv.balance THEN
    RAISE EXCEPTION 'El abono no puede ser mayor al saldo pendiente.';
  END IF;

  IF v_settings.allow_partial_payments IS DISTINCT FROM true AND p_amount < v_recv.balance THEN
    RAISE EXCEPTION 'Los pagos parciales no están habilitados. Debes pagar el saldo completo.';
  END IF;

  v_session := public.require_open_cash_session(v_recv.branch_id, v_user);

  INSERT INTO public.credit_payments (
    tenant_id, receivable_id, cash_session_id, amount, payment_method,
    transfer_reference, notes, created_by
  ) VALUES (
    v_tenant, v_recv.id, v_session.id, p_amount, p_payment_method,
    NULLIF(BTRIM(COALESCE(p_transfer_reference, '')), ''),
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    v_user
  )
  RETURNING id INTO v_payment_id;

  v_new_paid := v_recv.paid + p_amount;
  v_new_balance := v_recv.total - v_new_paid;
  v_status := CASE
    WHEN v_new_balance <= 0 THEN 'paid'
    WHEN v_new_paid > 0 THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE public.receivables
  SET paid = v_new_paid, balance = GREATEST(0, v_new_balance), status = v_status
  WHERE id = v_recv.id;

  IF p_payment_method = 'cash' THEN
    v_move_type := 'credit_payment_cash';
    v_affects := true;
  ELSE
    v_move_type := 'credit_payment_transfer';
    v_affects := false;
  END IF;

  INSERT INTO public.cash_movements (
    tenant_id, branch_id, cash_session_id, type, payment_method, amount,
    affects_cash, reference_type, reference_id, summary, created_by
  ) VALUES (
    v_tenant, v_recv.branch_id, v_session.id, v_move_type, p_payment_method, p_amount,
    v_affects, 'credit_payment', v_payment_id, 'Abono a crédito', v_user
  );

  RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cash_session_summary(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.get_current_tenant_id();
  v_session public.cash_sessions%ROWTYPE;
  v_sales_cash numeric := 0;
  v_sales_transfer numeric := 0;
  v_sales_credit numeric := 0;
  v_pay_cash numeric := 0;
  v_pay_transfer numeric := 0;
  v_cash_in numeric := 0;
  v_cash_out numeric := 0;
  v_expected numeric := 0;
BEGIN
  IF NOT public.has_permission('cash.view')
     AND NOT public.has_permission('sales.view') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar el resumen de caja.';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE id = p_session_id AND tenant_id = v_tenant;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caja no encontrada.';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN type = 'sale_cash' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'sale_transfer' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'sale_credit' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'credit_payment_cash' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'credit_payment_transfer' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'cash_in' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('cash_out', 'expense') THEN amount ELSE 0 END), 0)
  INTO v_sales_cash, v_sales_transfer, v_sales_credit, v_pay_cash, v_pay_transfer, v_cash_in, v_cash_out
  FROM public.cash_movements
  WHERE cash_session_id = p_session_id;

  v_expected := v_session.opening_cash + v_sales_cash + v_pay_cash + v_cash_in - v_cash_out;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'status', v_session.status,
    'opening_cash', v_session.opening_cash,
    'sales_cash', v_sales_cash,
    'sales_transfer', v_sales_transfer,
    'sales_credit', v_sales_credit,
    'credit_payments_cash', v_pay_cash,
    'credit_payments_transfer', v_pay_transfer,
    'cash_in', v_cash_in,
    'cash_out', v_cash_out,
    'expected_cash', COALESCE(v_session.expected_cash, v_expected),
    'counted_cash', v_session.counted_cash,
    'difference', v_session.difference,
    'transfers_total', v_sales_transfer + v_pay_transfer,
    'credit_balance_open', (
      SELECT COALESCE(SUM(r.balance), 0)
      FROM public.receivables r
      JOIN public.sales s ON s.id = r.sale_id
      WHERE s.cash_session_id = p_session_id AND r.balance > 0
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_sessions_select ON public.cash_sessions
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND (
      public.has_permission('cash.view')
      OR public.has_permission('sales.view')
      OR opened_by = auth.uid()
    )
  );

CREATE POLICY cash_movements_select ON public.cash_movements
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND (
      public.has_permission('cash.view')
      OR public.has_permission('sales.view')
    )
  );

CREATE POLICY sales_select ON public.sales
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('sales.view')
  );

CREATE POLICY sale_items_select ON public.sale_items
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND public.has_permission('sales.view')
  );

CREATE POLICY receivables_select ON public.receivables
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND (
      public.has_permission('credits.view')
      OR public.has_permission('sales.view')
    )
  );

CREATE POLICY credit_payments_select ON public.credit_payments
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND (
      public.has_permission('credits.view')
      OR public.has_permission('credits.payments')
    )
  );

CREATE POLICY inventory_movements_select ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_tenant_id())
    AND (
      public.has_permission('inventory.view')
      OR public.has_permission('sales.view')
      OR public.has_permission('purchases.view')
    )
  );

GRANT SELECT ON TABLE public.cash_sessions TO authenticated;
GRANT SELECT ON TABLE public.cash_movements TO authenticated;
GRANT SELECT ON TABLE public.sales TO authenticated;
GRANT SELECT ON TABLE public.sale_items TO authenticated;
GRANT SELECT ON TABLE public.receivables TO authenticated;
GRANT SELECT ON TABLE public.credit_payments TO authenticated;
GRANT SELECT ON TABLE public.inventory_movements TO authenticated;

REVOKE ALL ON FUNCTION public.require_open_cash_session(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_inventory_fifo(uuid, uuid, uuid, numeric, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_open_cash_session(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_cash_session(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_cash_session(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_cash_movement(text, numeric, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_sale(uuid, text, jsonb, uuid, numeric, text, numeric, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_credit_payment(uuid, numeric, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cash_session_summary(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_open_cash_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_cash_session(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_session(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_cash_movement(text, numeric, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale(uuid, text, jsonb, uuid, numeric, text, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_credit_payment(uuid, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cash_session_summary(uuid) TO authenticated;
