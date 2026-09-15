import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-provider';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { registerTenant } from '@/services/backend';
import { Spacing } from '@/constants/theme';

export function CreateTenantScreen() {
  const { user, signOut } = useAuth();
  const { refresh } = useWorkspace();
  const [tenantName, setTenantName] = useState('');
  const [branchName, setBranchName] = useState('Principal');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!tenantName.trim()) {
      setError('Ingresa el nombre de la empresa.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await registerTenant({
        name: tenantName,
        commercialName: tenantName,
        email: user?.email ?? undefined,
        branchName,
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la empresa.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Completa tu empresa</ThemedText>
        <ThemedText themeColor="textSecondary">
          Tu usuario ya existe. Crea el tenant, la sucursal principal y el plan Gratis.
        </ThemedText>
      </View>

      <AppTextField
        error={!tenantName.trim() && error ? error : undefined}
        label="Nombre de la empresa"
        onChangeText={setTenantName}
        value={tenantName}
      />
      <AppTextField label="Sucursal principal" onChangeText={setBranchName} value={branchName} />

      {error && tenantName.trim() ? (
        <ThemedText themeColor="destructive">{error}</ThemedText>
      ) : null}

      <AppButton loading={loading} onPress={() => void onSubmit()} title="Crear empresa" />
      <AppButton title="Cerrar sesión" variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
});
