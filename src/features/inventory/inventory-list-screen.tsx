import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { listInventoryBalances, listLotsForProduct } from '@/services/backend';
import type { InventoryBalanceRow, InventoryLot } from '@/types/catalog';
import { AppButton } from '@/components/ui/app-button';

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function InventoryListScreen() {
  const [rows, setRows] = useState<InventoryBalanceRow[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listInventoryBalances());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function openLots(row: InventoryBalanceRow) {
    setSelectedProductId(row.product_id);
    setSelectedName(row.products?.name ?? 'Producto');
    try {
      setLots(await listLotsForProduct(row.product_id, row.branch_id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los lotes.');
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Inventario</ThemedText>
        <ThemedText themeColor="textSecondary">
          Existencias por producto. Abre un ítem para ver lotes y costos (orden FIFO).
        </ThemedText>
      </View>

      {loading ? <ThemedText>Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {!loading && rows.length === 0 ? (
        <Card>
          <ThemedText>
            Sin existencias. Registra una compra recibida para crear el primer lote.
          </ThemedText>
        </Card>
      ) : null}

      {rows.map((row) => (
        <Card key={`${row.branch_id}-${row.product_id}`} style={styles.card}>
          <ThemedText type="section">{row.products?.name ?? 'Producto'}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {row.branches?.name ?? 'Sucursal'} · {row.open_lots} lote(s)
          </ThemedText>
          <ThemedText>Disponible: {row.qty_on_hand}</ThemedText>
          <AppButton title="Ver lotes / costos" variant="secondary" onPress={() => void openLots(row)} />
        </Card>
      ))}

      {selectedProductId ? (
        <Card style={styles.card}>
          <ThemedText type="section">Lotes · {selectedName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ordenados por fecha de compra (el primero sale primero en FIFO).
          </ThemedText>
          {lots.length === 0 ? (
            <ThemedText>Sin lotes abiertos.</ThemedText>
          ) : (
            lots.map((lot, index) => (
              <View key={lot.id} style={styles.lot}>
                <ThemedText type="smallBold">
                  #{index + 1} · {lot.qty_remaining} uds · {formatMoney(lot.unit_cost)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Comprado: {new Date(lot.purchased_at).toLocaleString('es-CO')}
                </ThemedText>
              </View>
            ))
          )}
          <AppButton
            title="Cerrar lotes"
            variant="ghost"
            onPress={() => {
              setSelectedProductId(null);
              setLots([]);
            }}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  card: { marginTop: Spacing.one },
  lot: { gap: Spacing.half, paddingVertical: Spacing.one },
});
