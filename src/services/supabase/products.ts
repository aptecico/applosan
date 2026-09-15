import { supabase } from '@/services/supabase/client';
import type { Product, ProductCategory, ProductInput } from '@/types/catalog';
import { getAuthErrorMessage } from '@/utils/auth-errors';

function requireTenantId(tenantId: string | null | undefined): string {
  if (!tenantId) {
    throw new Error('No hay empresa activa.');
  }
  return tenantId;
}

export async function listProductCategories() {
  const { data, error } = await supabase
    .from('product_categories')
    .select('id, tenant_id, name, parent_id, status, created_at, updated_at')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return (data ?? []) as ProductCategory[];
}

export async function createProductCategory(tenantId: string, name: string) {
  const { data, error } = await supabase
    .from('product_categories')
    .insert({
      tenant_id: requireTenantId(tenantId),
      name: name.trim(),
      status: 'active',
    })
    .select('id, tenant_id, name, parent_id, status, created_at, updated_at')
    .single();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return data as ProductCategory;
}

export async function listProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, tenant_id, category_id, name, sku, barcode, description, brand, color, size, unit, sale_price, min_stock, track_inventory, status, created_at, updated_at, product_categories(id, name)',
    )
    .order('name', { ascending: true });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return (data ?? []).map((row) => ({
    ...row,
    sale_price: Number(row.sale_price),
    min_stock: Number(row.min_stock),
    product_categories: Array.isArray(row.product_categories)
      ? (row.product_categories[0] ?? null)
      : (row.product_categories ?? null),
  })) as (Product & {
    product_categories: Pick<ProductCategory, 'id' | 'name'> | null;
  })[];
}

export async function getProduct(productId: string) {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, tenant_id, category_id, name, sku, barcode, description, brand, color, size, unit, sale_price, min_stock, track_inventory, status, created_at, updated_at',
    )
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }
  if (!data) {
    throw new Error('Producto no encontrado.');
  }

  return {
    ...data,
    sale_price: Number(data.sale_price),
    min_stock: Number(data.min_stock),
  } as Product;
}

export async function createProduct(tenantId: string, input: ProductInput) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      tenant_id: requireTenantId(tenantId),
      name: input.name.trim(),
      category_id: input.category_id ?? null,
      sku: input.sku?.trim() || null,
      barcode: input.barcode?.trim() || null,
      description: input.description?.trim() || null,
      brand: input.brand?.trim() || null,
      color: input.color?.trim() || null,
      size: input.size?.trim() || null,
      unit: input.unit?.trim() || 'unit',
      sale_price: input.sale_price ?? 0,
      min_stock: input.min_stock ?? 0,
      track_inventory: input.track_inventory ?? true,
      status: input.status ?? 'active',
    })
    .select(
      'id, tenant_id, category_id, name, sku, barcode, description, brand, color, size, unit, sale_price, min_stock, track_inventory, status, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return {
    ...data,
    sale_price: Number(data.sale_price),
    min_stock: Number(data.min_stock),
  } as Product;
}

export async function updateProduct(productId: string, input: ProductInput) {
  const { data, error } = await supabase
    .from('products')
    .update({
      name: input.name.trim(),
      category_id: input.category_id ?? null,
      sku: input.sku?.trim() || null,
      barcode: input.barcode?.trim() || null,
      description: input.description?.trim() || null,
      brand: input.brand?.trim() || null,
      color: input.color?.trim() || null,
      size: input.size?.trim() || null,
      unit: input.unit?.trim() || 'unit',
      sale_price: input.sale_price ?? 0,
      min_stock: input.min_stock ?? 0,
      track_inventory: input.track_inventory ?? true,
      status: input.status ?? 'active',
    })
    .eq('id', productId)
    .select(
      'id, tenant_id, category_id, name, sku, barcode, description, brand, color, size, unit, sale_price, min_stock, track_inventory, status, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return {
    ...data,
    sale_price: Number(data.sale_price),
    min_stock: Number(data.min_stock),
  } as Product;
}
