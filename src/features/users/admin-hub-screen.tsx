import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { Spacing } from '@/constants/theme';

export function AdminHubScreen() {
  const { hasPermission } = useWorkspace();

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Administración</ThemedText>
        <ThemedText themeColor="textSecondary">
          Usuarios, roles, permisos y sucursales del negocio.
        </ThemedText>
      </View>

      {hasPermission('users.view') ? (
        <Card>
          <ThemedText type="section">Usuarios</ThemedText>
          <ThemedText themeColor="textSecondary">Miembros del tenant, rol y sucursal.</ThemedText>
          <Link href="/admin/users" asChild>
            <AppButton title="Ver usuarios" variant="secondary" />
          </Link>
        </Card>
      ) : null}

      {hasPermission('roles.view') ? (
        <Card>
          <ThemedText type="section">Roles</ThemedText>
          <ThemedText themeColor="textSecondary">Roles de sistema y permisos asignados.</ThemedText>
          <Link href={'/admin/roles' as Href} asChild>
            <AppButton title="Ver roles" variant="secondary" />
          </Link>
        </Card>
      ) : null}

      {hasPermission('roles.view') ? (
        <Card>
          <ThemedText type="section">Permisos</ThemedText>
          <ThemedText themeColor="textSecondary">
            Catálogo con nombres claros para asignar en roles.
          </ThemedText>
          <Link href="/admin/permissions" asChild>
            <AppButton title="Ver permisos" variant="secondary" />
          </Link>
        </Card>
      ) : null}

      {hasPermission('branches.view') ? (
        <Card>
          <ThemedText type="section">Sucursales</ThemedText>
          <ThemedText themeColor="textSecondary">Relación tenant → sucursales lista para inventario y ventas.</ThemedText>
          <Link href="/admin/branches" asChild>
            <AppButton title="Ver sucursales" variant="secondary" />
          </Link>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
});
