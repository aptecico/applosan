import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { listSuppliers } from '@/services/backend';
import type { Supplier } from '@/types/catalog';

export function SuppliersListScreen() {
  const { hasPermission } = useWorkspace();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const canCreate = hasPermission('purchases.create');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listSuppliers());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar proveedores.');
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
      <View style={styles.header}>
        <ThemedText type="heading">Proveedores</ThemedText>
        <ThemedText themeColor="textSecondary">
          Quién te vende mercancía. Cada compra queda ligada a un proveedor.
        </ThemedText>
      </View>

      {canCreate ? (
        <Link href={'/suppliers/new' as Href} asChild>
          <AppButton title="Nuevo proveedor" />
        </Link>
      ) : null}

      {loading ? <ThemedText>Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {!loading && rows.length === 0 ? (
        <Card>
          <ThemedText>No hay proveedores. Crea uno antes de registrar compras.</ThemedText>
        </Card>
      ) : null}

      {rows.map((supplier) => (
        <Card key={supplier.id} style={styles.card}>
          <View style={styles.row}>
            <ThemedText type="section">{supplier.name}</ThemedText>
            <StatusBadge
              label={supplier.status === 'active' ? 'Activo' : 'Inactivo'}
              tone={supplier.status === 'active' ? 'success' : 'neutral'}
            />
          </View>
          {supplier.phone ? <ThemedText themeColor="textSecondary">{supplier.phone}</ThemedText> : null}
          {supplier.email ? <ThemedText type="small">{supplier.email}</ThemedText> : null}
          {hasPermission('purchases.update') ? (
            <Link href={`/suppliers/${supplier.id}` as Href} asChild>
              <AppButton title="Editar" variant="secondary" />
            </Link>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  card: { marginTop: Spacing.one },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
