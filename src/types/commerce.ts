import type { Product } from '@/types/catalog';

export type CashSessionStatus = 'open' | 'closed';
export type PaymentMethod = 'cash' | 'transfer' | 'credit';
export type SaleStatus = 'completed' | 'cancelled';
export type ReceivableStatus = 'pending' | 'partial' | 'paid' | 'overdue';

export type CashSession = {
  id: string;
  tenant_id: string;
  branch_id: string;
  opened_by: string;
  closed_by: string | null;
  status: CashSessionStatus;
  opening_cash: number;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  difference_reason: string | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { id: string; full_name: string } | null;
  branches?: { id: string; name: string; code: string } | null;
};

export type CashMovement = {
  id: string;
  tenant_id: string;
  branch_id: string;
  cash_session_id: string;
  type: string;
  payment_method: PaymentMethod;
  amount: number;
  affects_cash: boolean;
  reference_type: string | null;
  reference_id: string | null;
  summary: string;
  meta: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  profiles?: { id: string; full_name: string } | null;
};

export type CashSessionSummary = {
  session_id: string;
  status: CashSessionStatus;
  opening_cash: number;
  sales_cash: number;
  sales_transfer: number;
  sales_credit: number;
  credit_payments_cash: number;
  credit_payments_transfer: number;
  cash_in: number;
  cash_out: number;
  expenses_cash: number;
  expenses_transfer: number;
  expected_cash: number;
  counted_cash: number | null;
  difference: number | null;
  transfers_total: number;
  credit_balance_open: number;
};

export type Sale = {
  id: string;
  tenant_id: string;
  branch_id: string;
  cash_session_id: string;
  customer_id: string | null;
  sold_at: string;
  status: SaleStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  amount_received: number | null;
  change_given: number | null;
  transfer_reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaleItem = {
  id: string;
  tenant_id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  unit_cost: number;
  created_at: string;
  products?: Pick<Product, 'id' | 'name' | 'sku' | 'brand' | 'color' | 'size'> | null;
};

export type SaleWithRelations = Sale & {
  customers: { id: string; full_name: string } | null;
  branches: { id: string; name: string; code: string } | null;
  sale_items: SaleItem[];
  receivables?: Receivable | null;
};

export type SaleLineInput = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

export type CreateSaleInput = {
  branch_id: string;
  payment_method: PaymentMethod;
  lines: SaleLineInput[];
  customer_id?: string | null;
  amount_received?: number | null;
  transfer_reference?: string | null;
  discount_total?: number;
  tax_total?: number;
  notes?: string | null;
};

export type Receivable = {
  id: string;
  tenant_id: string;
  branch_id: string;
  sale_id: string;
  customer_id: string;
  total: number;
  paid: number;
  balance: number;
  status: ReceivableStatus;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  customers?: { id: string; full_name: string } | null;
  sales?: Pick<Sale, 'id' | 'sold_at' | 'total' | 'payment_method'> | null;
};

export type CreditPayment = {
  id: string;
  tenant_id: string;
  receivable_id: string;
  cash_session_id: string;
  amount: number;
  payment_method: 'cash' | 'transfer';
  transfer_reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  profiles?: { id: string; full_name: string } | null;
};

export type InventoryMovement = {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  unit_cost: number | null;
  reference_type: string | null;
  reference_id: string | null;
  summary: string;
  created_by: string | null;
  created_at: string;
  products?: Pick<Product, 'id' | 'name' | 'sku'> | null;
  branches?: { id: string; name: string } | null;
};

export type ExpenseMoneySource = 'cash_drawer' | 'bank' | 'other';
export type ExpenseStatus = 'posted' | 'cancelled';

export type ExpenseCategory = {
  id: string;
  tenant_id: string;
  name: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  tenant_id: string;
  branch_id: string;
  category_id: string | null;
  cash_session_id: string | null;
  concept: string;
  amount: number;
  payment_method: 'cash' | 'transfer';
  money_source: ExpenseMoneySource;
  transfer_reference: string | null;
  notes: string | null;
  status: ExpenseStatus;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  expense_categories?: Pick<ExpenseCategory, 'id' | 'name'> | null;
  profiles?: { id: string; full_name: string } | null;
  branches?: { id: string; name: string; code: string } | null;
};

export type CreateExpenseInput = {
  branch_id: string;
  concept: string;
  amount: number;
  payment_method: 'cash' | 'transfer';
  category_id?: string | null;
  money_source?: ExpenseMoneySource;
  transfer_reference?: string | null;
  notes?: string | null;
};
