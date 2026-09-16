import { Redirect } from 'expo-router';

import { CashOpenScreen } from '@/features/cash/cash-open-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function CashOpenRoute() {
  const { hasPermission } = useWorkspace();
  if (!hasPermission('cash.open')) return <Redirect href="/" />;
  return <CashOpenScreen />;
}
