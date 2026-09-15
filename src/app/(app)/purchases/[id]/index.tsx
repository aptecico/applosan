import { Redirect } from 'expo-router';

import { PurchaseDetailScreen } from '@/features/purchases/purchase-detail-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function PurchaseDetailRoute() {
  const { hasPermission, isLoading } = useWorkspace();
  if (isLoading) return null;
  if (!hasPermission('purchases.view')) return <Redirect href="/" />;
  return <PurchaseDetailScreen />;
}
