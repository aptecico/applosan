import { supabase } from '@/services/supabase/client';
import type {
  CashMovement,
  CashSession,
  CashSessionSummary,
} from '@/types/commerce';
import { getAuthErrorMessage } from '@/utils/auth-errors';

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapSession(row: Record<string, unknown>): CashSession {
  return {
    ...(row as object),
    opening_cash: Number(row.opening_cash),
    expected_cash: row.expected_cash == null ? null : Number(row.expected_cash),
    counted_cash: row.counted_cash == null ? null : Number(row.counted_cash),
    difference: row.difference == null ? null : Number(row.difference),
    profiles: firstRelation(row.profiles as never),
    branches: firstRelation(row.branches as never),
  } as CashSession;
}

export async function getOpenCashSession(branchId?: string | null) {
  const { data, error } = await supabase.rpc('get_open_cash_session', {
    p_branch_id: branchId ?? null,
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  if (!data) return null;
  return mapSession(data as never);
}

export async function openCashSession(
  branchId: string,
  openingCash: number,
  notes?: string,
) {
  const { data, error } = await supabase.rpc('open_cash_session', {
    p_branch_id: branchId,
    p_opening_cash: openingCash,
    p_notes: notes ?? null,
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  return mapSession(data as never);
}

export async function closeCashSession(
  sessionId: string,
  countedCash: number,
  differenceReason?: string,
) {
  const { data, error } = await supabase.rpc('close_cash_session', {
    p_session_id: sessionId,
    p_counted_cash: countedCash,
    p_difference_reason: differenceReason ?? null,
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  return mapSession(data as never);
}

export async function listCashSessions() {
  const { data, error } = await supabase
    .from('cash_sessions')
    .select(
      'id, tenant_id, branch_id, opened_by, closed_by, status, opening_cash, expected_cash, counted_cash, difference, difference_reason, notes, opened_at, closed_at, created_at, updated_at, profiles:opened_by(id, full_name), branches(id, name, code)',
    )
    .order('opened_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(getAuthErrorMessage(error));
  return (data ?? []).map((row) => mapSession(row as never));
}

export async function getCashSession(sessionId: string) {
  const { data, error } = await supabase
    .from('cash_sessions')
    .select(
      'id, tenant_id, branch_id, opened_by, closed_by, status, opening_cash, expected_cash, counted_cash, difference, difference_reason, notes, opened_at, closed_at, created_at, updated_at, profiles:opened_by(id, full_name), branches(id, name, code)',
    )
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw new Error(getAuthErrorMessage(error));
  if (!data) throw new Error('Caja no encontrada.');
  return mapSession(data as never);
}

export async function getCashSessionSummary(sessionId: string) {
  const { data, error } = await supabase.rpc('cash_session_summary', {
    p_session_id: sessionId,
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  const row = data as Record<string, unknown>;
  return {
    session_id: String(row.session_id),
    status: row.status as CashSessionSummary['status'],
    opening_cash: Number(row.opening_cash),
    sales_cash: Number(row.sales_cash),
    sales_transfer: Number(row.sales_transfer),
    sales_credit: Number(row.sales_credit),
    credit_payments_cash: Number(row.credit_payments_cash),
    credit_payments_transfer: Number(row.credit_payments_transfer),
    cash_in: Number(row.cash_in),
    cash_out: Number(row.cash_out),
    expenses_cash: Number(row.expenses_cash ?? 0),
    expenses_transfer: Number(row.expenses_transfer ?? 0),
    expected_cash: Number(row.expected_cash),
    counted_cash: row.counted_cash == null ? null : Number(row.counted_cash),
    difference: row.difference == null ? null : Number(row.difference),
    transfers_total: Number(row.transfers_total),
    credit_balance_open: Number(row.credit_balance_open),
  } satisfies CashSessionSummary;
}

export async function listCashMovements(sessionId: string) {
  const { data, error } = await supabase
    .from('cash_movements')
    .select(
      'id, tenant_id, branch_id, cash_session_id, type, payment_method, amount, affects_cash, reference_type, reference_id, summary, meta, created_by, created_at, profiles:created_by(id, full_name)',
    )
    .eq('cash_session_id', sessionId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(getAuthErrorMessage(error));
  return (data ?? []).map(
    (row) =>
      ({
        ...row,
        amount: Number(row.amount),
        meta: (row.meta as Record<string, unknown>) ?? {},
        profiles: firstRelation(row.profiles as never),
      }) as CashMovement,
  );
}

export async function registerCashMovement(
  type: 'cash_in' | 'cash_out' | 'expense',
  amount: number,
  summary: string,
  branchId?: string,
  reference?: string,
) {
  const { data, error } = await supabase.rpc('register_cash_movement', {
    p_type: type,
    p_amount: amount,
    p_summary: summary,
    p_branch_id: branchId ?? null,
    p_reference: reference ?? null,
  });
  if (error) throw new Error(getAuthErrorMessage(error));
  return data as CashMovement;
}
