import { SplashScreen } from 'expo-router';

import { useAuth } from '@/features/auth/auth-provider';
import { useWorkspace } from '@/features/tenants/workspace-provider';

SplashScreen.preventAutoHideAsync();

export function SplashScreenController() {
  const { isLoading: authLoading, session } = useAuth();
  const { isLoading: workspaceLoading } = useWorkspace();
  const ready = !authLoading && (!session || !workspaceLoading);

  if (ready) {
    void SplashScreen.hideAsync();
  }

  return null;
}
