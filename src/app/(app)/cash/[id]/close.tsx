import { Redirect } from 'expo-router';

import { CashCloseScreen } from '@/features/cash/cash-close-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function CashCloseRoute() {
  const { hasPermission } = useWorkspace();
  if (!hasPermission('cash.close')) return <Redirect href="/" />;
  return <CashCloseScreen />;
}
