import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';

import { ProductFormScreen } from '@/features/products/product-form-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function ProductNewRoute() {
  const { hasPermission, isLoading } = useWorkspace();
  if (isLoading) return null;
  if (!hasPermission('products.create')) return <Redirect href={'/products' as Href} />;
  return <ProductFormScreen />;
}
