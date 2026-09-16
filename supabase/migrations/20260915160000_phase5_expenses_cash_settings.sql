-- Phase 5: expenses module + cash settings defaults + summary split

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (code, name, module, description) VALUES
  ('expenses.view', 'Consultar gastos', 'expenses', 'Listar y ver gastos'),
  ('expenses.create', 'Registrar gastos', 'expenses', 'Crear gastos'),
  ('expenses.cancel', 'Anular gastos', 'expenses', 'Anular gastos registrados')
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- Admin template + tenant admin roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'admin'
  AND p.code IN ('expenses.view', 'expenses.create', 'expenses.cancel')
ON CONFLICT DO NOTHING;

-- Seller template + tenant seller roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'seller'
  AND p.code IN ('expenses.view', 'expenses.create')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TRIGGER expense_categories_set_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX expense_categories_tenant_idx
  ON public.expense_categories (tenant_id, status, name);

-- Seed default categories for every existing tenant
INSERT INTO public.expense_categories (tenant_id, name)
SELECT t.id, c.name
FROM public.tenants t
CROSS JOIN (VALUES
  ('Transporte'),
  ('Papelería'),
  ('Servicios'),
  ('Mantenimiento'),
  ('Alimentación'),
  ('Compras menores'),
  ('Otros')
) AS c(name)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.expense_categories (id) ON DELETE SET NULL,
  cash_session_id uuid REFERENCES public.cash_sessions (id) ON DELETE RESTRICT,
  concept text NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  money_source text NOT NULL DEFAULT 'cash_drawer'
    CHECK (money_source IN ('cash_drawer', 'bank', 'other')),
  transfer_reference text,
  notes text,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'cancelled')),
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  cancel_reason text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (payment_method <> 'transfer')
    OR (transfer_reference IS NOT NULL AND BTRIM(transfer_reference) <> '')
  ),
  CHECK (
    (status <> 'cancelled')
    OR (cancel_reason IS NOT NULL AND BTRIM(cancel_reason) <> '')
  )
);

CREATE INDEX expenses_tenant_created_idx
  ON public.expenses (tenant_id, created_at DESC);
CREATE INDEX expenses_session_idx ON public.expenses (cash_session_id);
CREATE INDEX expenses_category_idx ON public.expenses (category_id);
CREATE INDEX expenses_status_idx ON public.expenses (tenant_id, status);

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.expense_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.expenses (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  summary text NOT NULL,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expense_audit_expense_idx ON public.expense_audit (expense_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Default opening cash on tenant_settings (dedicated column)
-- ---------------------------------------------------------------------------

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS default_opening_cash numeric(14, 2) NOT NULL DEFAULT 0
  CHECK (default_opening_cash >= 0);

COMMENT ON COLUMN public.tenant_settings.default_opening_cash IS
  'Default physical cash suggested when opening a cash session.';

-- ---------------------------------------------------------------------------
-- Seed categories for new tenants (hook into register if needed via trigger)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_expense_categories_for_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $seed_exp_cat$
BEGIN
  INSERT INTO public.expense_categories (tenant_id, name)
  VALUES
    (p_tenant_id, 'Transporte'),
    (p_tenant_id, 'Papelería'),
    (p_tenant_id, 'Servicios'),
    (p_tenant_id, 'Mantenimiento'),
    (p_tenant_id, 'Alimentación'),
    (p_tenant_id, 'Compras menores'),
    (p_tenant_id, 'Otros')
  ON CONFLICT (tenant_id, name) DO NOTHING;
END;
$seed_exp_cat$;

REVOKE ALL ON FUNCTION public.seed_expense_categories_for_tenant(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.trg_seed_expense_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $trg_seed$
BEGIN
  PERFORM public.seed_expense_categories_for_tenant(NEW.tenant_id);
  RETURN NEW;
END;
$trg_seed$;

DROP TRIGGER IF EXISTS tenant_settings_seed_expense_categories ON public.tenant_settings;
CREATE TRIGGER tenant_settings_seed_expense_categories
  AFTER INSERT ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_expense_categories();

-- ---------------------------------------------------------------------------
-- create_expense
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_expense(
  p_branch_id uuid,
  p_concept text,
  p_amount numeric,
  p_payment_method text,
  p_category_id uuid DEFAULT NULL,
  p_money_source text DEFAULT 'cash_drawer',
  p_transfer_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $create_expense$
DECLARE
  v_tenant uuid := public.get_current_tenant_id();
  v_user uuid := auth.uid();
  v_session public.cash_sessions%ROWTYPE;
  v_expense_id uuid;
  v_concept text;
  v_transfer_ref text;
  v_source text;
  v_available numeric := 0;
  v_affects boolean;
  v_move_type text;
BEGIN
  IF NOT public.has_permission('expenses.create') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar gastos.';
  END IF;

  v_concept := NULLIF(BTRIM(COALESCE(p_concept, '')), '');
  IF v_concept IS NULL THEN
    RAISE EXCEPTION 'Indica el concepto del gasto.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto del gasto debe ser mayor que 0.';
  END IF;

  IF p_payment_method NOT IN ('cash', 'transfer') THEN
    RAISE EXCEPTION 'Método de pago no válido.';
  END IF;

  v_source := COALESCE(NULLIF(BTRIM(COALESCE(p_money_source, '')), ''), 'cash_drawer');
  IF v_source NOT IN ('cash_drawer', 'bank', 'other') THEN
    RAISE EXCEPTION 'Origen del dinero no válido.';
  END IF;

  v_transfer_ref := NULLIF(BTRIM(COALESCE(p_transfer_reference, '')), '');
  IF p_payment_method = 'transfer' AND v_transfer_ref IS NULL THEN
    RAISE EXCEPTION 'Ingresa la referencia de la transferencia.';
  END IF;

  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.expense_categories
    WHERE id = p_category_id AND tenant_id = v_tenant AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'La categoría de gasto no es válida.';
  END IF;

  -- Any expense requires an open cash session (operational control).
  -- Only cash method reduces physical expected cash.
  v_session := public.require_open_cash_session(p_branch_id, v_user);

  IF p_payment_method = 'cash' THEN
    SELECT COALESCE(v_session.opening_cash, 0)
      + COALESCE(SUM(CASE WHEN affects_cash THEN
          CASE WHEN type IN ('cash_out', 'expense', 'refund') THEN -amount ELSE amount END
        ELSE 0 END), 0)
    INTO v_available
    FROM public.cash_movements
    WHERE cash_session_id = v_session.id;

    IF p_amount > v_available THEN
      RAISE EXCEPTION 'No hay suficiente efectivo disponible para registrar este gasto.';
    END IF;

    v_affects := true;
    v_move_type := 'expense';
  ELSE
    v_affects := false;
    v_move_type := 'expense';
  END IF;

  INSERT INTO public.expenses (
    tenant_id, branch_id, category_id, cash_session_id, concept, amount,
    payment_method, money_source, transfer_reference, notes, created_by, status
  ) VALUES (
    v_tenant, p_branch_id, p_category_id, v_session.id, v_concept, p_amount,
    p_payment_method, v_source, v_transfer_ref,
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    v_user, 'posted'
  )
  RETURNING id INTO v_expense_id;

  INSERT INTO public.cash_movements (
    tenant_id, branch_id, cash_session_id, type, payment_method, amount,
    affects_cash, reference_type, reference_id, summary, created_by, meta
  ) VALUES (
    v_tenant, p_branch_id, v_session.id, v_move_type, p_payment_method, p_amount,
    v_affects, 'expense', v_expense_id,
    'Gasto: ' || v_concept,
    v_user,
    jsonb_build_object(
      'money_source', v_source,
      'transfer_reference', v_transfer_ref,
      'category_id', p_category_id
    )
  );

  INSERT INTO public.expense_audit (
    tenant_id, expense_id, actor_id, action, summary, after_data
  ) VALUES (
    v_tenant, v_expense_id, v_user, 'create', 'Gasto registrado',
    jsonb_build_object(
      'amount', p_amount,
      'concept', v_concept,
      'payment_method', p_payment_method,
      'money_source', v_source
    )
  );

  RETURN v_expense_id;
END;
$create_expense$;

REVOKE ALL ON FUNCTION public.create_expense(uuid, text, numeric, text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_expense(uuid, text, numeric, text, uuid, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- cancel_expense
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_expense(
  p_expense_id uuid,
  p_reason text
)
RETURNS public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cancel_expense$
DECLARE
  v_tenant uuid := public.get_current_tenant_id();
  v_user uuid := auth.uid();
  v_expense public.expenses%ROWTYPE;
  v_reason text;
  v_session public.cash_sessions%ROWTYPE;
BEGIN
  IF NOT public.has_permission('expenses.cancel') THEN
    RAISE EXCEPTION 'No tienes permiso para anular gastos.';
  END IF;

  v_reason := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Indica el motivo de anulación.';
  END IF;

  SELECT * INTO v_expense
  FROM public.expenses
  WHERE id = p_expense_id AND tenant_id = v_tenant
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gasto no encontrado.';
  END IF;

  IF v_expense.status = 'cancelled' THEN
    RAISE EXCEPTION 'Este gasto ya está anulado.';
  END IF;

  IF v_expense.cash_session_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE id = v_expense.cash_session_id AND tenant_id = v_tenant;

    IF v_session.status = 'closed' THEN
      RAISE EXCEPTION 'No puedes anular un gasto de una caja ya cerrada.';
    END IF;
  END IF;

  UPDATE public.expenses
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_user,
    cancel_reason = v_reason
  WHERE id = v_expense.id
  RETURNING * INTO v_expense;

  -- Compensating cash movement (reverses original impact)
  IF v_expense.cash_session_id IS NOT NULL THEN
    INSERT INTO public.cash_movements (
      tenant_id, branch_id, cash_session_id, type, payment_method, amount,
      affects_cash, reference_type, reference_id, summary, created_by, meta
    ) VALUES (
      v_tenant, v_expense.branch_id, v_expense.cash_session_id,
      CASE WHEN v_expense.payment_method = 'cash' THEN 'cash_in' ELSE 'expense' END,
      v_expense.payment_method,
      v_expense.amount,
      (v_expense.payment_method = 'cash'),
      'expense_cancel', v_expense.id,
      'Anulación de gasto: ' || v_expense.concept,
      v_user,
      jsonb_build_object('cancel_reason', v_reason, 'expense_id', v_expense.id)
    );
  END IF;

  INSERT INTO public.expense_audit (
    tenant_id, expense_id, actor_id, action, summary, reason, after_data
  ) VALUES (
    v_tenant, v_expense.id, v_user, 'cancel', 'Gasto anulado', v_reason,
    jsonb_build_object('status', 'cancelled')
  );

  RETURN v_expense;
END;
$cancel_expense$;

REVOKE ALL ON FUNCTION public.cancel_expense(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_expense(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Update cash_session_summary to split expenses vs withdrawals
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cash_session_summary(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cash_summary$
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
  v_expenses_cash numeric := 0;
  v_expenses_transfer numeric := 0;
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
    COALESCE(SUM(CASE WHEN type = 'cash_out' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' AND payment_method = 'cash' AND affects_cash THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' AND payment_method = 'transfer' THEN amount ELSE 0 END), 0)
  INTO
    v_sales_cash, v_sales_transfer, v_sales_credit, v_pay_cash, v_pay_transfer,
    v_cash_in, v_cash_out, v_expenses_cash, v_expenses_transfer
  FROM public.cash_movements
  WHERE cash_session_id = p_session_id;

  v_expected := v_session.opening_cash + v_sales_cash + v_pay_cash + v_cash_in
    - v_cash_out - v_expenses_cash;

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
    'expenses_cash', v_expenses_cash,
    'expenses_transfer', v_expenses_transfer,
    'expected_cash', COALESCE(v_session.expected_cash, v_expected),
    'counted_cash', v_session.counted_cash,
    'difference', v_session.difference,
    'transfers_total', v_sales_transfer + v_pay_transfer + v_expenses_transfer,
    'credit_balance_open', (
      SELECT COALESCE(SUM(r.balance), 0)
      FROM public.receivables r
      JOIN public.sales s ON s.id = r.sale_id
      WHERE s.cash_session_id = p_session_id AND r.balance > 0
    )
  );
END;
$cash_summary$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY expense_categories_select ON public.expense_categories
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY expense_categories_insert ON public.expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_current_tenant_id()
    AND public.has_permission('settings.update')
  );

CREATE POLICY expense_categories_update ON public.expense_categories
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_current_tenant_id()
    AND public.has_permission('settings.update')
  )
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY expenses_select ON public.expenses
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_current_tenant_id()
    AND (
      public.has_permission('expenses.view')
      OR public.has_permission('expenses.create')
      OR public.has_permission('cash.view')
    )
  );

CREATE POLICY expense_audit_select ON public.expense_audit
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_current_tenant_id()
    AND (
      public.has_permission('expenses.view')
      OR public.has_permission('expenses.cancel')
    )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.expense_categories TO authenticated;
GRANT SELECT ON TABLE public.expenses TO authenticated;
GRANT SELECT ON TABLE public.expense_audit TO authenticated;
