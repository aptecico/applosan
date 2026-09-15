import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { ThemedText } from '@/components/themed-text';
import { listBranches } from '@/services/backend';
import { Branch } from '@/types/saas';
import { Spacing } from '@/constants/theme';

export function BranchesListScreen() {
  const [rows, setRows] = useState<Branch[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listBranches());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las sucursales.');
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
      <ThemedText type="heading">Sucursales</ThemedText>
      <ThemedText themeColor="textSecondary">
        Preparadas para inventario, ventas, compras, caja y transferencias en fases posteriores.
      </ThemedText>
      {loading ? <ThemedText>Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}
      {rows.map((branch) => (
        <Card key={branch.id} style={styles.card}>
          <ThemedText type="section">{branch.name}</ThemedText>
          <ThemedText themeColor="textSecondary">Código {branch.code}</ThemedText>
          {branch.address ? <ThemedText type="small">{branch.address}</ThemedText> : null}
          <StatusBadge label={branch.status} tone={branch.status === 'active' ? 'success' : 'warning'} />
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
