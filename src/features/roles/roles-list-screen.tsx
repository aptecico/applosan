import { Link, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import { getModuleLabel } from '@/navigation/modules';
import { listRoles, type RoleWithPermissions } from '@/services/backend';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export function RolesListScreen() {
  const { hasPermission } = useWorkspace();
  const [rows, setRows] = useState<RoleWithPermissions[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const canUpdate = hasPermission('roles.update');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listRoles());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los roles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <ThemedText type="heading">Roles</ThemedText>
      <ThemedText themeColor="textSecondary">
        Los roles definen qué puede hacer cada persona. Los de sistema son de solo lectura.
      </ThemedText>
      {loading ? <ThemedText>Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}
      {rows.map((role) => (
        <RoleCard canUpdate={canUpdate} key={role.id} role={role} />
      ))}
    </Screen>
  );
}

function RoleCard({ role, canUpdate }: { role: RoleWithPermissions; canUpdate: boolean }) {
  const permissionNames = useMemo(() => {
    return (role.role_permissions ?? [])
      .map((item) => item.permissions?.name)
      .filter(Boolean) as string[];
  }, [role.role_permissions]);

  const byModule = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of role.role_permissions ?? []) {
      const perm = item.permissions;
      if (!perm) continue;
      const label = getModuleLabel(perm.module);
      map.set(label, [...(map.get(label) ?? []), perm.name]);
    }
    return [...map.entries()];
  }, [role.role_permissions]);

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <ThemedText type="section">{role.name}</ThemedText>
        <StatusBadge label={role.is_system ? 'Sistema' : 'Personalizado'} />
      </View>
      <ThemedText themeColor="textSecondary">{role.description}</ThemedText>
      <ThemedText type="small">{permissionNames.length} permisos</ThemedText>
      {byModule.slice(0, 3).map(([moduleName, names]) => (
        <ThemedText key={moduleName} type="small" themeColor="textSecondary">
          {moduleName}: {names.slice(0, 3).join(', ')}
          {names.length > 3 ? '…' : ''}
        </ThemedText>
      ))}
      {canUpdate && !role.is_system ? (
        <Link href={`/admin/roles/${role.id}` as Href} asChild>
          <AppButton title="Editar permisos" variant="secondary" />
        </Link>
      ) : role.is_system ? (
        <ThemedText type="small" themeColor="textSecondary">
          Solo lectura. Para personalizar, crea un rol nuevo.
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
