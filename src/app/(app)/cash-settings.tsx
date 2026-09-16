import { Redirect } from 'expo-router';

import { CashSettingsScreen } from '@/features/expenses/cash-settings-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function CashSettingsRoute() {
  const { hasPermission } = useWorkspace();
  if (!hasPermission('settings.view') && !hasPermission('settings.update')) {
    return <Redirect href="/" />;
  }
  return <CashSettingsScreen />;
}
