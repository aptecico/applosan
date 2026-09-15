import { supabase } from '@/services/supabase/client';
import { getAuthErrorMessage } from '@/utils/auth-errors';

export type Customer = {
  id: string;
  tenant_id: string;
  full_name: string;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type CustomerInput = {
  full_name: string;
  document_number?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: 'active' | 'inactive';
};

export async function listCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select(
      'id, tenant_id, full_name, document_number, phone, email, address, notes, status, created_at, updated_at',
    )
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return (data ?? []) as Customer[];
}

export async function createCustomer(tenantId: string, input: CustomerInput) {
  if (!tenantId) throw new Error('No hay empresa activa.');
  const { data, error } = await supabase
    .from('customers')
    .insert({
      tenant_id: tenantId,
      full_name: input.full_name.trim(),
      document_number: input.document_number?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      status: input.status ?? 'active',
    })
    .select(
      'id, tenant_id, full_name, document_number, phone, email, address, notes, status, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return data as Customer;
}
