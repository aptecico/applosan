import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import { canAccessAdmin } from '@/navigation/access';
import { getSessionContext } from '@/services/backend';
import {
  Branch,
  Plan,
  Profile,
  Role,
  SessionContext,
  Subscription,
  Tenant,
  TenantSettings,
} from '@/types/saas';

type WorkspaceContextValue = {
  isLoading: boolean;
  error: string | null;
  profile: Profile | null;
  tenant: Tenant | null;
  branch: Branch | null;
  role: Role | null;
  permissions: string[];
  features: string[];
  plan: Plan | null;
  subscription: Subscription | null;
  settings: TenantSettings | null;
  hasPermission: (code: string) => boolean;
  hasFeature: (code: string) => boolean;
  canAccessAdmin: boolean;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const emptyWorkspace: Omit<
  WorkspaceContextValue,
  'isLoading' | 'error' | 'hasPermission' | 'hasFeature' | 'canAccessAdmin' | 'refresh'
> = {
  profile: null,
  tenant: null,
  branch: null,
  role: null,
  permissions: [],
  features: [],
  plan: null,
  subscription: null,
  settings: null,
};

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { session, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // undefined = aún no se consultó; null = consultado sin datos de tenant
  const [context, setContext] = useState<SessionContext | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!session) {
      setContext(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await getSessionContext();
      setContext(data);
      setError(null);
    } catch (caught) {
      // Dejamos context en null para no bloquear el splash; el usuario puede ir a onboarding/login.
      setContext(null);
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar el espacio de trabajo');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    void refresh();
  }, [authLoading, refresh]);

  // Solo pendiente mientras no haya terminado la primera carga con sesión.
  // Antes: sessionUserId !== contextUserId dejaba el splash eterno si no había perfil/tenant.
  const workspacePending = !!session && context === undefined;

  const permissions = context?.permissions ?? [];
  const features = context?.features ?? [];

  const hasPermission = useCallback(
    (code: string) => permissions.includes(code),
    [permissions],
  );
  const hasFeature = useCallback((code: string) => features.includes(code), [features]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      isLoading: authLoading || isLoading || workspacePending,
      error,
      profile: context?.profile ?? emptyWorkspace.profile,
      tenant: context?.tenant ?? emptyWorkspace.tenant,
      branch: context?.branch ?? emptyWorkspace.branch,
      role: context?.role ?? emptyWorkspace.role,
      permissions,
      features,
      plan: context?.plan ?? emptyWorkspace.plan,
      subscription: context?.subscription ?? emptyWorkspace.subscription,
      settings: context?.settings ?? emptyWorkspace.settings,
      hasPermission,
      hasFeature,
      canAccessAdmin: canAccessAdmin(permissions),
      refresh,
    }),
    [
      authLoading,
      isLoading,
      workspacePending,
      error,
      context,
      permissions,
      features,
      hasPermission,
      hasFeature,
      refresh,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return value;
}
