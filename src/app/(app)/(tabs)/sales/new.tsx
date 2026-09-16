import { Redirect } from 'expo-router';

import { SaleFormScreen } from '@/features/sales/sale-form-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function NewSaleRoute() {
  const { hasPermission, isLoading } = useWorkspace();

  if (isLoading) return null;
  if (!hasPermission('sales.create')) return <Redirect href="/" />;
  return <SaleFormScreen />;
}
