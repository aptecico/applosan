import { Redirect } from 'expo-router';

import { CustomersListScreen } from '@/features/customers/customers-list-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function CustomersRoute() {
  const { hasPermission, isLoading } = useWorkspace();
  if (isLoading) return null;
  if (!hasPermission('customers.view')) return <Redirect href="/" />;
  return <CustomersListScreen />;
}
