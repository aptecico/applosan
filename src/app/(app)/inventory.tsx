import { Redirect } from 'expo-router';

import { InventoryListScreen } from '@/features/inventory/inventory-list-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function InventoryRoute() {
  const { hasPermission, isLoading } = useWorkspace();
  if (isLoading) return null;
  if (!hasPermission('inventory.view')) return <Redirect href="/" />;
  return <InventoryListScreen />;
}
