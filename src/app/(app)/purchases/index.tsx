import { Redirect } from 'expo-router';

import { PurchasesListScreen } from '@/features/purchases/purchases-list-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function PurchasesIndexRoute() {
  const { hasPermission, isLoading } = useWorkspace();
  if (isLoading) return null;
  if (!hasPermission('purchases.view')) return <Redirect href="/" />;
  return <PurchasesListScreen />;
}
