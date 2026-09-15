import { Redirect } from 'expo-router';

import { ModulePlaceholder } from '@/features/shared/module-placeholder';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function NewSaleRoute() {
  const { hasPermission, isLoading } = useWorkspace();

  if (isLoading) {
    return null;
  }

  if (!hasPermission('sales.create')) {
    return <Redirect href="/" />;
  }

  return (
    <ModulePlaceholder
      description="Punto de venta rápido. Aquí podrás cobrar con pocos toques."
      permission="sales.create"
      title="Nueva venta"
    />
  );
}
