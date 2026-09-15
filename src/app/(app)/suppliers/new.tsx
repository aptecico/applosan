import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';

import { SupplierFormScreen } from '@/features/suppliers/supplier-form-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function SupplierNewRoute() {
  const { hasPermission, isLoading } = useWorkspace();
  if (isLoading) return null;
  if (!hasPermission('purchases.create')) return <Redirect href={'/suppliers' as Href} />;
  return <SupplierFormScreen />;
}
