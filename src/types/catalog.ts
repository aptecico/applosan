export type ProductStatus = 'active' | 'inactive' | 'discontinued';
export type SupplierStatus = 'active' | 'inactive';
export type PurchaseStatus = 'draft' | 'received' | 'cancelled';
export type InventoryLotStatus = 'open' | 'depleted' | 'void';

export type ProductCategory = {
  id: string;
  tenant_id: string;
  name: string;
  parent_id: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  unit: string;
  sale_price: number;
  min_stock: number;
  track_inventory: boolean;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
};

export type ProductInput = {
  name: string;
  category_id?: string | null;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
  unit?: string;
  sale_price?: number;
  min_stock?: number;
  track_inventory?: boolean;
  status?: ProductStatus;
};

export type Supplier = {
  id: string;
  tenant_id: string;
  name: string;
  document_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: SupplierStatus;
  created_at: string;
  updated_at: string;
};

export type SupplierInput = {
  name: string;
  document_number?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: SupplierStatus;
};

export type Purchase = {
  id: string;
  tenant_id: string;
  branch_id: string;
  supplier_id: string | null;
  purchased_at: string;
  reference: string | null;
  notes: string | null;
  status: PurchaseStatus;
  subtotal: number;
  tax_total: number;
  total: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseItem = {
  id: string;
  tenant_id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  created_at: string;
};

export type PurchaseWithRelations = Purchase & {
  suppliers: Pick<Supplier, 'id' | 'name'> | null;
  branches: { id: string; name: string; code: string } | null;
  profiles: { id: string; full_name: string } | null;
  purchase_items: (PurchaseItem & {
    products: Pick<
      Product,
      'id' | 'name' | 'sku' | 'brand' | 'color' | 'size'
    > | null;
  })[];
};

export type PurchaseLineInput = {
  product_id: string;
  quantity: number;
  unit_cost: number;
};

export type CreatePurchaseInput = {
  branch_id: string;
  supplier_id?: string | null;
  purchased_at?: string;
  reference?: string | null;
  notes?: string | null;
  lines: PurchaseLineInput[];
  receive?: boolean;
};

export type InventoryBalance = {
  tenant_id: string;
  branch_id: string;
  product_id: string;
  qty_on_hand: number;
  open_lots: number;
};

export type InventoryLot = {
  id: string;
  tenant_id: string;
  branch_id: string;
  product_id: string;
  purchase_item_id: string | null;
  purchased_at: string;
  qty_received: number;
  qty_remaining: number;
  unit_cost: number;
  status: InventoryLotStatus;
  created_at: string;
  updated_at: string;
};

export type InventoryBalanceRow = InventoryBalance & {
  products: Pick<Product, 'id' | 'name' | 'sku' | 'sale_price'> | null;
  branches: { id: string; name: string; code: string } | null;
};

export type PurchaseAuditEvent = {
  id: string;
  tenant_id: string;
  purchase_id: string;
  actor_id: string | null;
  action: string;
  summary: string;
  reason: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
  profiles?: { id: string; full_name: string } | null;
};

export type SyncPurchaseInput = {
  supplier_id?: string | null;
  purchased_at?: string;
  reference?: string | null;
  notes?: string | null;
  lines: PurchaseLineInput[];
};
