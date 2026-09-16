import { Redirect } from 'expo-router';

import { CreditsListScreen } from '@/features/credits/credits-list-screen';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function CreditsIndexRoute() {
  const { hasPermission } = useWorkspace();
  if (!hasPermission('credits.view') && !hasPermission('credits.payments')) {
    return <Redirect href="/" />;
  }
  return <CreditsListScreen />;
}
