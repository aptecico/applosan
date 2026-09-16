import { supabase } from '@/services/supabase/client';
import type {
  CreateSaleInput,
  CreditPayment,
  Receivable,
  SaleWithRelations,
} from '@/types/commerce';
import { getAuthErrorMessage } from '@/utils/auth-errors';

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapSale(row: Record<string, unknown>): SaleWithRelations {
  const items = (row.sale_items as Record<string, unknown>[] | null) ?? [];
  const receivable = firstRelation(row.receivables as never);
  return {
    ...(row as object),
    subtotal: Number(row.subtotal),
    discount_total: Number(row.discount_total),
    tax_total: Number(row.tax_total),
    total: Number(row.total),
    amount_received: row.amount_received == null ? null : Number(row.amount_received),
    change_given: row.change_given == null ? null : Number(row.change_given),
    customers: firstRelation(row.customers as never),
    branches: firstRelation(row.branches as never),
    receivables: receivable
      ? ({
          ...(receivable as object),
          total: Number((receivable as Receivable).total),
          paid: Number((receivable as Receivable).paid),
          balance: Number((receivable as Receivable).balance),
        } as Receivable)
      : null,
    sale_items: items.map((item) => ({
      ...(item as object),
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
      unit_cost: Number(item.unit_cost),
      products: firstRelation(item.products as never),
    })),
  } as SaleWithRelations;
}

const saleSelect =
  'id, tenant_id, branch_id, cash_session_id, customer_id, sold_at, status, payment_method, subtotal, discount_total, tax_total, total, amount_received, change_given, transfer_reference, notes, created_by, created_at, updated_at, customers(id, full_name), branches(id, name, code), sale_items(id, tenant_id, sale_id, product_id, quantity, unit_price, line_total, unit_cost, created_at, products(id, name, sku, brand, color, size)), receivables(id, tenant_id, branch_id, sale_id, customer_id, total, paid, balance, status, due_at, created_at, updated_at)';

export async function listSales() {
  const { data, error } = await supabase
    .from('sales')
    .select(saleSelect)
    .order('sold_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(getAuthErrorMessage(error));
  return (data ?? []).map((row) => mapSale(row as never));
}

export async function getSale(saleId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select(saleSelect)
    .eq('id', saleId)
    .maybeSingle();
  if (error) throw new Error(getAuthErrorMessage(error));
  if (!data) throw new Error('Venta no encontrada.');
  return mapSale(data as never);
}

export async function createSale(input: CreateSaleInput) {
  const { data, error } = await supabase.rpc('create_sale', {
    p_branch_id: input.branch_id,
    p_payment_method: input.payment_method,
    p_lines: input.lines,
    p_customer_id: input.customer_id ?? null,
    p_amount_received: input.amount_received ?? null,
    p_transfer_reference: input.transfer_reference ?? null,
    p_discount_total: input.discount_total ?? 0,
    p_tax_total: input.tax_total ?? 0,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  return getSale(String(data));
}

export async function listReceivables() {
  await supabase.rpc('sync_overdue_receivables');
  const { data, error } = await supabase
    .from('receivables')
    .select(
      'id, tenant_id, branch_id, sale_id, customer_id, total, paid, balance, status, due_at, created_at, updated_at, customers(id, full_name), sales(id, sold_at, total, payment_method)',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(getAuthErrorMessage(error));
  return (data ?? []).map((row) => {
    const customers = firstRelation(row.customers as never);
    const sales = firstRelation(row.sales as never);
    return {
      ...(row as object),
      total: Number(row.total),
      paid: Number(row.paid),
      balance: Number(row.balance),
      customers,
      sales: sales
        ? {
            ...(sales as object),
            total: Number((sales as { total: number }).total),
          }
        : null,
    } as Receivable;
  });
}

export async function getReceivable(id: string) {
  await supabase.rpc('sync_overdue_receivables');
  const { data, error } = await supabase
    .from('receivables')
    .select(
      'id, tenant_id, branch_id, sale_id, customer_id, total, paid, balance, status, due_at, created_at, updated_at, customers(id, full_name), sales(id, sold_at, total, payment_method)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(getAuthErrorMessage(error));
  if (!data) throw new Error('Cuenta por cobrar no encontrada.');
  const customers = firstRelation(data.customers as never);
  const sales = firstRelation(data.sales as never);
  return {
    ...(data as object),
    total: Number(data.total),
    paid: Number(data.paid),
    balance: Number(data.balance),
    customers,
    sales: sales
      ? { ...(sales as object), total: Number((sales as { total: number }).total) }
      : null,
  } as Receivable;
}

export async function listCreditPayments(receivableId: string) {
  const { data, error } = await supabase
    .from('credit_payments')
    .select(
      'id, tenant_id, receivable_id, cash_session_id, amount, payment_method, transfer_reference, notes, created_by, created_at, profiles:created_by(id, full_name)',
    )
    .eq('receivable_id', receivableId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(getAuthErrorMessage(error));
  return (data ?? []).map(
    (row) =>
      ({
        ...row,
        amount: Number(row.amount),
        profiles: firstRelation(row.profiles as never),
      }) as CreditPayment,
  );
}

export async function registerCreditPayment(
  receivableId: string,
  amount: number,
  paymentMethod: 'cash' | 'transfer',
  transferReference?: string,
  notes?: string,
) {
  const { data, error } = await supabase.rpc('register_credit_payment', {
    p_receivable_id: receivableId,
    p_amount: amount,
    p_payment_method: paymentMethod,
    p_transfer_reference: transferReference ?? null,
    p_notes: notes ?? null,
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  return String(data);
}
