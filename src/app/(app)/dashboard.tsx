import { Redirect } from 'expo-router';

import { DashboardScreen } from '@/features/tenants/dashboard-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function DashboardRoute() {
  const { hasPermission, isLoading } = useWorkspace();

  if (isLoading) {
    return null;
  }

  if (!hasPermission('dashboard.view')) {
    return <Redirect href="/" />;
  }

  return <DashboardScreen />;
}
