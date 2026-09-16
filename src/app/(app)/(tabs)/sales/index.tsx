import { Redirect } from 'expo-router';

import { SalesListScreen } from '@/features/sales/sales-list-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function SalesRoute() {
  const { hasPermission, isLoading } = useWorkspace();

  if (isLoading) return null;
  if (!hasPermission('sales.view') && !hasPermission('sales.create')) {
    return <Redirect href="/" />;
  }
  return <SalesListScreen />;
}
