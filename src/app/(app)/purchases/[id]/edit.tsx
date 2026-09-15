import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';

import { PurchaseFormScreen } from '@/features/purchases/purchase-form-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function PurchaseEditRoute() {
  const { hasPermission, isLoading } = useWorkspace();
  if (isLoading) return null;
  if (!hasPermission('purchases.update')) return <Redirect href={'/purchases' as Href} />;
  return <PurchaseFormScreen />;
}
