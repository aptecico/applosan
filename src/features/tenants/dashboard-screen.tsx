import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';

/**
 * Panel administrativo / resumen.
 * Solo debe abrirse con permiso dashboard.view (la bienvenida no lo exige).
 */
export function DashboardScreen() {
  const { tenant, role, branch, plan, features, permissions, hasFeature, canAccessAdmin, error } =
    useWorkspace();

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Dashboard</ThemedText>
        <ThemedText themeColor="textSecondary">
          Resumen del espacio de trabajo. No es la puerta de entrada de la app.
        </ThemedText>
      </View>

      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      <Card>
        <ThemedText type="section">{tenant?.name ?? 'Negocio'}</ThemedText>
        <ThemedText>Rol: {role?.name ?? '—'}</ThemedText>
        <ThemedText>Sucursal: {branch?.name ?? '—'}</ThemedText>
        <ThemedText>
          Plan: {plan?.name ?? '—'}
        </ThemedText>
        <StatusBadge
          label={role?.code === 'admin' ? 'Administrador' : role?.name ?? 'Usuario'}
          tone={role?.code === 'admin' ? 'success' : 'neutral'}
        />
      </Card>

      <Card>
        <ThemedText type="section">Plan activo</ThemedText>
        <ThemedText themeColor="textSecondary">
          {features.length
            ? `${features.length} funciones incluidas`
            : 'Sin funciones en el plan'}
        </ThemedText>
        <ThemedText type="small">
          Multi-sucursal: {hasFeature('multi_branch') ? 'incluida' : 'no incluida en Gratis'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {permissions.length} permisos en tu rol.
        </ThemedText>
      </Card>

      <View style={styles.actions}>
        <Link href="/" asChild>
          <AppButton title="Volver al inicio" variant="secondary" />
        </Link>
        {canAccessAdmin ? (
          <Link href="/admin" asChild>
            <AppButton title="Administración" />
          </Link>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
