import { supabase } from '@/services/supabase/client';
import type { Supplier, SupplierInput } from '@/types/catalog';
import { getAuthErrorMessage } from '@/utils/auth-errors';

function requireTenantId(tenantId: string | null | undefined): string {
  if (!tenantId) {
    throw new Error('No hay empresa activa.');
  }
  return tenantId;
}

export async function listSuppliers() {
  const { data, error } = await supabase
    .from('suppliers')
    .select(
      'id, tenant_id, name, document_number, email, phone, address, notes, status, created_at, updated_at',
    )
    .order('name', { ascending: true });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return (data ?? []) as Supplier[];
}

export async function getSupplier(supplierId: string) {
  const { data, error } = await supabase
    .from('suppliers')
    .select(
      'id, tenant_id, name, document_number, email, phone, address, notes, status, created_at, updated_at',
    )
    .eq('id', supplierId)
    .maybeSingle();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }
  if (!data) {
    throw new Error('Proveedor no encontrado.');
  }

  return data as Supplier;
}

export async function createSupplier(tenantId: string, input: SupplierInput) {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      tenant_id: requireTenantId(tenantId),
      name: input.name.trim(),
      document_number: input.document_number?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      status: input.status ?? 'active',
    })
    .select(
      'id, tenant_id, name, document_number, email, phone, address, notes, status, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return data as Supplier;
}

export async function updateSupplier(supplierId: string, input: SupplierInput) {
  const { data, error } = await supabase
    .from('suppliers')
    .update({
      name: input.name.trim(),
      document_number: input.document_number?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      status: input.status ?? 'active',
    })
    .eq('id', supplierId)
    .select(
      'id, tenant_id, name, document_number, email, phone, address, notes, status, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return data as Supplier;
}
