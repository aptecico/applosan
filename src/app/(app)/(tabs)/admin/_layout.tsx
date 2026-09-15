import { Stack } from 'expo-router';

import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function AdminLayout() {
  const { canAccessAdmin } = useWorkspace();

  return (
    <Stack>
      <Stack.Protected guard={canAccessAdmin}>
        <Stack.Screen name="index" options={{ title: 'Administración' }} />
        <Stack.Screen name="users" options={{ title: 'Usuarios' }} />
        <Stack.Screen name="roles/index" options={{ title: 'Roles' }} />
        <Stack.Screen name="roles/[id]" options={{ title: 'Permisos del rol' }} />
        <Stack.Screen name="permissions" options={{ title: 'Permisos' }} />
        <Stack.Screen name="branches" options={{ title: 'Sucursales' }} />
      </Stack.Protected>
    </Stack>
  );
}
