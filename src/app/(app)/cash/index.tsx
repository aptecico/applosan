import { Redirect } from 'expo-router';

import { CashListScreen } from '@/features/cash/cash-list-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function CashIndexRoute() {
  const { hasPermission } = useWorkspace();
  if (!hasPermission('cash.view') && !hasPermission('cash.open')) {
    return <Redirect href="/" />;
  }
  return <CashListScreen />;
}
