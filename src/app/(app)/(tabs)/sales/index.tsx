import { Redirect } from 'expo-router';

import { ModulePlaceholder } from '@/features/shared/module-placeholder';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function SalesRoute() {
  const { hasPermission, isLoading } = useWorkspace();

  if (isLoading) {
    return null;
  }

  if (!hasPermission('sales.view') && !hasPermission('sales.create')) {
    return <Redirect href="/" />;
  }

  return (
    <ModulePlaceholder
      description="Historial de ventas del día y consultas."
      permission="sales.view"
      title="Ventas"
    />
  );
}
