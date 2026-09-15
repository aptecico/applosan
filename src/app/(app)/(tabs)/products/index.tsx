import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';

import { ProductsListScreen } from '@/features/products/products-list-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function ProductsIndexRoute() {
  const { hasPermission, isLoading } = useWorkspace();
  if (isLoading) return null;
  if (!hasPermission('products.view')) return <Redirect href="/" />;
  return <ProductsListScreen />;
}
