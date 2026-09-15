import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { ThemedText } from '@/components/themed-text';
import { listTenantUsers, type TenantUserRow } from '@/services/backend';
import { Spacing } from '@/constants/theme';

export function UsersListScreen() {
  const [rows, setRows] = useState<TenantUserRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listTenantUsers());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los usuarios.');
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
      <ThemedText type="heading">Usuarios</ThemedText>
      <ThemedText themeColor="textSecondary">
        {loading ? 'Cargando…' : `${rows.length} miembros visibles con tu rol.`}
      </ThemedText>
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}
      {!loading && rows.length === 0 ? (
        <ThemedText themeColor="textSecondary">No hay usuarios visibles.</ThemedText>
      ) : null}
      {rows.map((row) => (
        <Card key={row.id} style={styles.card}>
          <ThemedText type="section">{row.profiles?.full_name || 'Sin nombre'}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {row.roles?.name ?? 'Sin rol'} · {row.branches?.name ?? 'Sin sucursal'}
          </ThemedText>
          <StatusBadge label={row.status} tone={row.status === 'active' ? 'success' : 'warning'} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: Spacing.one,
  },
});
