import { supabase } from '@/services/supabase/client';
import type {
  CreateExpenseInput,
  Expense,
  ExpenseCategory,
} from '@/types/commerce';
import { getAuthErrorMessage } from '@/utils/auth-errors';

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapExpense(row: Record<string, unknown>): Expense {
  return {
    ...(row as object),
    amount: Number(row.amount),
    expense_categories: firstRelation(row.expense_categories as never),
    profiles: firstRelation(row.profiles as never),
    branches: firstRelation(row.branches as never),
  } as Expense;
}

const expenseSelect =
  'id, tenant_id, branch_id, category_id, cash_session_id, concept, amount, payment_method, money_source, transfer_reference, notes, status, cancelled_at, cancelled_by, cancel_reason, created_by, created_at, updated_at, expense_categories(id, name), profiles:created_by(id, full_name), branches(id, name, code)';

export async function listExpenseCategories(includeInactive = false) {
  let query = supabase
    .from('expense_categories')
    .select('id, tenant_id, name, status, created_at, updated_at')
    .order('name', { ascending: true });
  if (!includeInactive) query = query.eq('status', 'active');
  const { data, error } = await query;
  if (error) throw new Error(getAuthErrorMessage(error));
  return (data ?? []) as ExpenseCategory[];
}

export async function createExpenseCategory(tenantId: string, name: string) {
  if (!tenantId) throw new Error('No hay empresa activa.');
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ tenant_id: tenantId, name: name.trim(), status: 'active' })
    .select('id, tenant_id, name, status, created_at, updated_at')
    .single();
  if (error) throw new Error(getAuthErrorMessage(error));
  return data as ExpenseCategory;
}

export async function updateExpenseCategory(
  id: string,
  patch: { name?: string; status?: 'active' | 'inactive' },
) {
  const { data, error } = await supabase
    .from('expense_categories')
    .update(patch)
    .eq('id', id)
    .select('id, tenant_id, name, status, created_at, updated_at')
    .single();
  if (error) throw new Error(getAuthErrorMessage(error));
  return data as ExpenseCategory;
}

export async function listExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select(expenseSelect)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(getAuthErrorMessage(error));
  return (data ?? []).map((row) => mapExpense(row as never));
}

export async function getExpense(id: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select(expenseSelect)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(getAuthErrorMessage(error));
  if (!data) throw new Error('Gasto no encontrado.');
  return mapExpense(data as never);
}

export async function createExpense(input: CreateExpenseInput) {
  const { data, error } = await supabase.rpc('create_expense', {
    p_branch_id: input.branch_id,
    p_concept: input.concept,
    p_amount: input.amount,
    p_payment_method: input.payment_method,
    p_category_id: input.category_id ?? null,
    p_money_source: input.money_source ?? 'cash_drawer',
    p_transfer_reference: input.transfer_reference ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  return getExpense(String(data));
}

export async function cancelExpense(id: string, reason: string) {
  const { data, error } = await supabase.rpc('cancel_expense', {
    p_expense_id: id,
    p_reason: reason,
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  return mapExpense(data as never);
}

export async function updateTenantCashSettings(tenantId: string, defaultOpeningCash: number) {
  if (!tenantId) throw new Error('No hay empresa activa.');
  if (Number.isNaN(defaultOpeningCash) || defaultOpeningCash < 0) {
    throw new Error('Indica un efectivo inicial válido (>= 0).');
  }
  const { data, error } = await supabase
    .from('tenant_settings')
    .update({ default_opening_cash: defaultOpeningCash })
    .eq('tenant_id', tenantId)
    .select(
      'tenant_id, currency, timezone, default_min_stock, allow_credit_sales, allow_partial_payments, default_opening_cash, business_name, invoice_name, extra, created_at, updated_at',
    )
    .single();
  if (error) throw new Error(getAuthErrorMessage(error));
  return {
    ...data,
    default_min_stock: Number(data.default_min_stock),
    default_opening_cash: Number(data.default_opening_cash ?? 0),
    extra: (data.extra as Record<string, unknown>) ?? {},
  };
}
