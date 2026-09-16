-- Phase 4 hardening: transfer ref, cash in/out safety, overdue sync, credit due dates

CREATE OR REPLACE FUNCTION public.require_open_cash_session(
  p_branch_id uuid,
  p_user_id uuid
)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $require_cash$
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
    RAISE EXCEPTION 'Debes abrir la caja para realizar esta operación.';
  END IF;

  RETURN v_session;
END;
$require_cash$;

-- ---------------------------------------------------------------------------
-- Sync overdue receivables (call on list/get; no cron required)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_overdue_receivables()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sync_overdue$
DECLARE
  v_tenant uuid := public.get_current_tenant_id();
  v_updated integer := 0;
BEGIN
  IF v_tenant IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT public.has_permission('credits.view')
     AND NOT public.has_permission('credits.payments')
     AND NOT public.has_permission('sales.view') THEN
    RETURN 0;
  END IF;

  -- Mark past-due open balances as overdue
  UPDATE public.receivables
  SET status = 'overdue', updated_at = now()
  WHERE tenant_id = v_tenant
    AND balance > 0
    AND due_at IS NOT NULL
    AND due_at < now()
    AND status IN ('pending', 'partial');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Restore wrongly overdue rows that are paid or not yet due
  UPDATE public.receivables
  SET
    status = CASE
      WHEN balance <= 0 THEN 'paid'
      WHEN paid > 0 THEN 'partial'
      ELSE 'pending'
    END,
    updated_at = now()
  WHERE tenant_id = v_tenant
    AND status = 'overdue'
    AND (
      balance <= 0
      OR due_at IS NULL
      OR due_at >= now()
    );

  RETURN v_updated;
END;
$sync_overdue$;

REVOKE ALL ON FUNCTION public.sync_overdue_receivables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_overdue_receivables() TO authenticated;

-- ---------------------------------------------------------------------------
-- register_cash_movement: optional reference + insufficient cash guard
-- Single 5-arg signature (defaults keep 4-arg RPC calls working).
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.register_cash_movement(text, numeric, text, uuid);
DROP FUNCTION IF EXISTS public.register_cash_movement(text, numeric, text, uuid, text);

CREATE OR REPLACE FUNCTION public.register_cash_movement(
  p_type text,
  p_amount numeric,
  p_summary text,
  p_branch_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL
)
RETURNS public.cash_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cash_move$
DECLARE
  v_tenant uuid := public.get_current_tenant_id();
  v_user uuid := auth.uid();
  v_branch uuid;
  v_session public.cash_sessions%ROWTYPE;
  v_row public.cash_movements%ROWTYPE;
  v_affects boolean;
  v_method text;
  v_available numeric := 0;
  v_summary text;
  v_reference text;
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

  v_summary := NULLIF(BTRIM(COALESCE(p_summary, '')), '');
  IF v_summary IS NULL THEN
    RAISE EXCEPTION 'Indica el concepto del movimiento.';
  END IF;

  v_reference := NULLIF(BTRIM(COALESCE(p_reference, '')), '');

  v_branch := COALESCE(
    p_branch_id,
    (SELECT branch_id FROM public.tenant_users
     WHERE tenant_id = v_tenant AND user_id = v_user AND status = 'active' LIMIT 1)
  );

  v_session := public.require_open_cash_session(v_branch, v_user);
  v_affects := true;
  v_method := 'cash';

  SELECT COALESCE(v_session.opening_cash, 0)
    + COALESCE(SUM(CASE WHEN affects_cash THEN
        CASE WHEN type IN ('cash_out', 'expense', 'refund') THEN -amount ELSE amount END
      ELSE 0 END), 0)
  INTO v_available
  FROM public.cash_movements
  WHERE cash_session_id = v_session.id;

  IF p_type IN ('cash_out', 'expense') AND p_amount > v_available THEN
    RAISE EXCEPTION 'No hay suficiente efectivo disponible.';
  END IF;

  INSERT INTO public.cash_movements (
    tenant_id, branch_id, cash_session_id, type, payment_method, amount,
    affects_cash, summary, created_by, meta
  ) VALUES (
    v_tenant, v_branch, v_session.id, p_type, v_method, p_amount,
    v_affects, v_summary, v_user,
    CASE
      WHEN v_reference IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object('reference', v_reference)
    END
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$cash_move$;

REVOKE ALL ON FUNCTION public.register_cash_movement(text, numeric, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_cash_movement(text, numeric, text, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- create_sale: require transfer reference; set credit due_at
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
AS $create_sale$
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
  v_transfer_ref text;
  v_due_days integer := 30;
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

  v_transfer_ref := NULLIF(BTRIM(COALESCE(p_transfer_reference, '')), '');
  IF p_payment_method = 'transfer' AND v_transfer_ref IS NULL THEN
    RAISE EXCEPTION 'Ingresa la referencia de la transferencia.';
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
    CASE WHEN p_payment_method = 'transfer' THEN v_transfer_ref ELSE NULL END,
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
      'transfer_reference', v_transfer_ref
    )
  );

  IF p_payment_method = 'credit' THEN
    IF (v_settings.extra ? 'credit_due_days') THEN
      BEGIN
        v_due_days := GREATEST(1, (v_settings.extra->>'credit_due_days')::integer);
      EXCEPTION WHEN others THEN
        v_due_days := 30;
      END;
    END IF;

    INSERT INTO public.receivables (
      tenant_id, branch_id, sale_id, customer_id, total, paid, balance, status, due_at
    ) VALUES (
      v_tenant, p_branch_id, v_sale_id, p_customer_id, v_total, 0, v_total, 'pending',
      now() + make_interval(days => v_due_days)
    );
  END IF;

  RETURN v_sale_id;
END;
$create_sale$;

-- ---------------------------------------------------------------------------
-- register_credit_payment: require transfer reference; overdue-aware status
-- ---------------------------------------------------------------------------

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
AS $credit_pay$
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
  v_transfer_ref text;
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

  v_transfer_ref := NULLIF(BTRIM(COALESCE(p_transfer_reference, '')), '');
  IF p_payment_method = 'transfer' AND v_transfer_ref IS NULL THEN
    RAISE EXCEPTION 'Ingresa la referencia de la transferencia.';
  END IF;

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant;

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
    v_transfer_ref,
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    v_user
  )
  RETURNING id INTO v_payment_id;

  v_new_paid := v_recv.paid + p_amount;
  v_new_balance := v_recv.total - v_new_paid;
  v_status := CASE
    WHEN v_new_balance <= 0 THEN 'paid'
    WHEN v_recv.due_at IS NOT NULL AND v_recv.due_at < now() THEN 'overdue'
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
    affects_cash, reference_type, reference_id, summary, created_by, meta
  ) VALUES (
    v_tenant, v_recv.branch_id, v_session.id, v_move_type, p_payment_method, p_amount,
    v_affects, 'credit_payment', v_payment_id, 'Abono a crédito', v_user,
    CASE
      WHEN v_transfer_ref IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object('transfer_reference', v_transfer_ref)
    END
  );

  RETURN v_payment_id;
END;
$credit_pay$;
