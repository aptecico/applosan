/**
 * Contrato de backend de Applosan.
 *
 * Las pantallas y features solo importan desde aquí.
 * Hoy el adaptador es Supabase (`services/supabase`). InsForge u otro
 * Postgres + Auth + RLS se conecta cambiando URL/clave y, si hace falta,
 * el adaptador — no las pantallas. El SQL en `supabase/migrations` es el contrato.
 */
export type { AuthSession, AuthUser } from '@/services/backend/types';
export { getBackendConfig } from '@/lib/env';
export { supabase as backend } from '@/services/supabase/client';
export {
  getAuthSession,
  getSessionContext,
  registerTenant,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  subscribeAuth,
  updateOwnProfile,
} from '@/services/supabase/auth';
export {
  listBranches,
  listPermissions,
  listRoles,
  getRole,
  replaceRolePermissions,
  listTenantUsers,
  type RoleWithPermissions,
  type TenantUserRow,
} from '@/services/supabase/admin';
export {
  listProductCategories,
  createProductCategory,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
} from '@/services/supabase/products';
export {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
} from '@/services/supabase/suppliers';
export {
  listPurchases,
  getPurchase,
  createPurchase,
  receivePurchase,
  syncPurchase,
  cancelPurchase,
  listPurchaseAudit,
  listInventoryBalances,
  listLotsForProduct,
} from '@/services/supabase/purchases';
export {
  listCustomers,
  createCustomer,
  type Customer,
  type CustomerInput,
} from '@/services/supabase/customers';
