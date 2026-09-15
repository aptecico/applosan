import { Redirect } from 'expo-router';

import { SuppliersListScreen } from '@/features/suppliers/suppliers-list-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function SuppliersIndexRoute() {
  const { hasPermission, isLoading } = useWorkspace();
  if (isLoading) return null;
  if (!hasPermission('purchases.view')) return <Redirect href="/" />;
  return <SuppliersListScreen />;
}
