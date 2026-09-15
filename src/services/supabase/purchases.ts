import { supabase } from '@/services/supabase/client';
import type {
  CreatePurchaseInput,
  InventoryBalanceRow,
  InventoryLot,
  PurchaseAuditEvent,
  PurchaseWithRelations,
  SyncPurchaseInput,
} from '@/types/catalog';
import { getAuthErrorMessage } from '@/utils/auth-errors';

function requireTenantId(tenantId: string | null | undefined): string {
  if (!tenantId) {
    throw new Error('No hay empresa activa.');
  }
  return tenantId;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapPurchaseRow(row: Record<string, unknown>): PurchaseWithRelations {
  const purchaseItems = (row.purchase_items as Record<string, unknown>[] | null) ?? [];
  return {
    ...(row as object),
    subtotal: Number(row.subtotal),
    tax_total: Number(row.tax_total),
    total: Number(row.total),
    suppliers: firstRelation(row.suppliers as never),
    branches: firstRelation(row.branches as never),
    profiles: firstRelation(row.profiles as never),
    purchase_items: purchaseItems.map((item) => ({
      ...(item as object),
      quantity: Number(item.quantity),
      unit_cost: Number(item.unit_cost),
      line_total: Number(item.line_total),
      products: firstRelation(item.products as never),
    })),
  } as PurchaseWithRelations;
}

const purchaseSelect =
  'id, tenant_id, branch_id, supplier_id, purchased_at, reference, notes, status, subtotal, tax_total, total, created_by, created_at, updated_at, suppliers(id, name), branches(id, name, code), profiles:created_by(id, full_name), purchase_items(id, tenant_id, purchase_id, product_id, quantity, unit_cost, line_total, created_at, products(id, name, sku, brand, color, size))';

export async function listPurchases() {
  const { data, error } = await supabase
    .from('purchases')
    .select(purchaseSelect)
    .order('purchased_at', { ascending: false });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return (data ?? []).map((row) => mapPurchaseRow(row as never));
}

export async function getPurchase(purchaseId: string) {
  const { data, error } = await supabase
    .from('purchases')
    .select(purchaseSelect)
    .eq('id', purchaseId)
    .maybeSingle();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }
  if (!data) {
    throw new Error('Compra no encontrada.');
  }

  return mapPurchaseRow(data as never);
}

export async function createPurchase(
  tenantId: string,
  createdBy: string | null,
  input: CreatePurchaseInput,
) {
  const tid = requireTenantId(tenantId);
  if (!input.lines.length) {
    throw new Error('Agrega al menos un producto a la compra.');
  }

  const lines = input.lines.map((line) => {
    const quantity = Number(line.quantity);
    const unitCost = Number(line.unit_cost);
    if (!line.product_id || quantity <= 0 || unitCost < 0) {
      throw new Error('Cada línea necesita producto, cantidad y costo válidos.');
    }
    return {
      product_id: line.product_id,
      quantity,
      unit_cost: unitCost,
      line_total: Number((quantity * unitCost).toFixed(2)),
    };
  });

  const subtotal = Number(lines.reduce((sum, line) => sum + line.line_total, 0).toFixed(2));

  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .insert({
      tenant_id: tid,
      branch_id: input.branch_id,
      supplier_id: input.supplier_id ?? null,
      purchased_at: input.purchased_at ?? new Date().toISOString(),
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      status: 'draft',
      subtotal,
      tax_total: 0,
      total: subtotal,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (purchaseError || !purchase) {
    throw new Error(getAuthErrorMessage(purchaseError ?? new Error('No se pudo crear la compra.')));
  }

  const { error: itemsError } = await supabase.from('purchase_items').insert(
    lines.map((line) => ({
      tenant_id: tid,
      purchase_id: purchase.id,
      product_id: line.product_id,
      quantity: line.quantity,
      unit_cost: line.unit_cost,
      line_total: line.line_total,
    })),
  );

  if (itemsError) {
    throw new Error(getAuthErrorMessage(itemsError));
  }

  if (input.receive !== false) {
    await receivePurchase(purchase.id);
  }

  return getPurchase(purchase.id);
}

export async function receivePurchase(purchaseId: string) {
  const { error } = await supabase.rpc('receive_purchase', { p_purchase_id: purchaseId });
  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }
  return getPurchase(purchaseId);
}

export async function syncPurchase(purchaseId: string, input: SyncPurchaseInput) {
  if (!input.lines.length) {
    throw new Error('La compra debe tener al menos un producto.');
  }

  const { error } = await supabase.rpc('sync_purchase', {
    p_purchase_id: purchaseId,
    p_supplier_id: input.supplier_id ?? null,
    p_purchased_at: input.purchased_at ?? null,
    p_reference: input.reference ?? null,
    p_notes: input.notes ?? null,
    p_lines: input.lines,
  });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return getPurchase(purchaseId);
}

export async function cancelPurchase(purchaseId: string, reason: string) {
  const { error } = await supabase.rpc('cancel_purchase', {
    p_purchase_id: purchaseId,
    p_reason: reason,
  });
  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }
  return getPurchase(purchaseId);
}

export async function listPurchaseAudit(purchaseId: string) {
  const { data, error } = await supabase
    .from('purchase_audit_events')
    .select(
      'id, tenant_id, purchase_id, actor_id, action, summary, reason, before_data, after_data, created_at, profiles(id, full_name)',
    )
    .eq('purchase_id', purchaseId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return (data ?? []).map((row) => ({
    ...row,
    profiles: firstRelation(row.profiles),
  })) as PurchaseAuditEvent[];
}

export async function listInventoryBalances() {
  const [
    { data: balances, error: balancesError },
    { data: products, error: productsError },
    { data: branches, error: branchesError },
  ] = await Promise.all([
    supabase.from('inventory_balances').select('tenant_id, branch_id, product_id, qty_on_hand, open_lots'),
    supabase.from('products').select('id, name, sku, sale_price'),
    supabase.from('branches').select('id, name, code'),
  ]);

  if (balancesError) throw new Error(getAuthErrorMessage(balancesError));
  if (productsError) throw new Error(getAuthErrorMessage(productsError));
  if (branchesError) throw new Error(getAuthErrorMessage(branchesError));

  const productMap = new Map((products ?? []).map((item) => [item.id, item]));
  const branchMap = new Map((branches ?? []).map((item) => [item.id, item]));

  return (balances ?? [])
    .map((row) => {
      const product = productMap.get(row.product_id) ?? null;
      return {
        tenant_id: row.tenant_id,
        branch_id: row.branch_id,
        product_id: row.product_id,
        qty_on_hand: Number(row.qty_on_hand),
        open_lots: Number(row.open_lots),
        products: product
          ? {
              id: product.id,
              name: product.name,
              sku: product.sku,
              sale_price: Number(product.sale_price),
            }
          : null,
        branches: branchMap.get(row.branch_id) ?? null,
      };
    })
    .sort((a, b) => b.qty_on_hand - a.qty_on_hand) as InventoryBalanceRow[];
}

export async function listLotsForProduct(productId: string, branchId?: string) {
  let query = supabase
    .from('inventory_lots')
    .select(
      'id, tenant_id, branch_id, product_id, purchase_item_id, purchased_at, qty_received, qty_remaining, unit_cost, status, created_at, updated_at',
    )
    .eq('product_id', productId)
    .eq('status', 'open')
    .gt('qty_remaining', 0)
    .order('purchased_at', { ascending: true });

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return (data ?? []).map((row) => ({
    ...row,
    qty_received: Number(row.qty_received),
    qty_remaining: Number(row.qty_remaining),
    unit_cost: Number(row.unit_cost),
  })) as InventoryLot[];
}
