import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { StockBadge } from '@/components/ui/stock-badge';
import { Density, MinTouchTarget, Radii, Spacing } from '@/constants/theme';
import { formatMoneyCOP } from '@/features/purchases/purchase-format';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import {
  listInventoryBalances,
  listInventoryMovements,
  listLotsForProduct,
} from '@/services/backend';
import type { InventoryBalanceRow, InventoryLot } from '@/types/catalog';
import type { InventoryMovement } from '@/types/commerce';
import { resolveMinStock } from '@/utils/stock';

export function InventoryListScreen() {
  const theme = useTheme();
  const { settings } = useWorkspace();
  const [rows, setRows] = useState<InventoryBalanceRow[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'stock' | 'moves'>('stock');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = `${row.products?.name ?? ''} ${row.products?.sku ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [balances, moves] = await Promise.all([
        listInventoryBalances(),
        listInventoryMovements().catch(() => [] as InventoryMovement[]),
      ]);
      setRows(balances);
      setMovements(moves as InventoryMovement[]);
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
        <ThemedText themeColor="textSecondary" type="small">
          Existencias y movimientos. Los costos viven en lotes FIFO.
        </ThemedText>
      </View>

      <View style={styles.tabs}>
        <TabChip active={tab === 'stock'} label="Existencias" onPress={() => setTab('stock')} />
        <TabChip active={tab === 'moves'} label="Movimientos" onPress={() => setTab('moves')} />
      </View>

      {tab === 'stock' ? (
        <View
          style={[
            styles.search,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}>
          <AppIcon name="search" size={16} themeColor="textMuted" />
          <TextInput
            accessibilityLabel="Buscar en inventario"
            placeholder="Nombre o SKU"
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
      ) : null}

      {loading ? <ThemedText themeColor="textSecondary">Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {!loading && tab === 'stock' && filtered.length === 0 ? (
        <EmptyState
          icon="package"
          title="Sin existencias"
          description="Registra una compra recibida para crear el primer lote."
        />
      ) : null}

      {tab === 'stock'
        ? filtered.map((row) => (
            <Pressable
              key={`${row.branch_id}-${row.product_id}`}
              onPress={() => void openLots(row)}
              style={({ pressed }) => [
                styles.rowCard,
                {
                  borderColor: theme.border,
                  backgroundColor: pressed ? theme.backgroundSelected : theme.surface,
                },
              ]}>
              <View style={styles.rowTop}>
                <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
                  {row.products?.name ?? 'Producto'}
                </ThemedText>
                <StockBadge
                  quantity={row.qty_on_hand}
                  minStock={resolveMinStock(
                    row.products?.min_stock,
                    settings?.default_min_stock,
                  )}
                />
              </View>
              <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
                {[row.products?.sku, row.branches?.name].filter(Boolean).join(' · ') || '—'}
              </ThemedText>
              <View style={styles.rowBottom}>
                <ThemedText type="small" themeColor="textSecondary">
                  {row.open_lots} {row.open_lots === 1 ? 'lote' : 'lotes'}
                </ThemedText>
                <ThemedText type="smallBold">
                  {formatMoneyCOP(row.products?.sale_price ?? 0)}
                </ThemedText>
              </View>
            </Pressable>
          ))
        : null}

      {tab === 'moves' && !loading && movements.length === 0 ? (
        <EmptyState
          icon="history"
          title="Sin movimientos"
          description="Las compras y ventas aparecerán aquí."
        />
      ) : null}

      {tab === 'moves'
        ? movements.map((move) => (
            <ListRow
              key={move.id}
              density="compact"
              trailing={
                <ThemedText
                  type="smallBold"
                  themeColor={move.quantity < 0 ? 'destructive' : 'success'}>
                  {move.quantity > 0 ? '+' : ''}
                  {move.quantity}
                </ThemedText>
              }>
              <ThemedText type="smallBold" numberOfLines={1}>
                {move.products?.name ?? 'Producto'}
              </ThemedText>
              <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
                {move.summary} · {new Date(move.created_at).toLocaleString('es-CO')}
              </ThemedText>
            </ListRow>
          ))
        : null}

      {selectedProductId ? (
        <Card density="compact">
          <View style={styles.lotsHeader}>
            <ThemedText type="smallBold">Lotes · {selectedName}</ThemedText>
            <Pressable onPress={() => setSelectedProductId(null)}>
              <ThemedText type="small" themeColor="accent">
                Cerrar
              </ThemedText>
            </Pressable>
          </View>
          {lots.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Sin lotes abiertos.
            </ThemedText>
          ) : (
            lots.map((lot) => (
              <View key={lot.id} style={styles.lotRow}>
                <ThemedText type="small">
                  {lot.qty_remaining} uds · {formatMoneyCOP(lot.unit_cost)}
                </ThemedText>
                <ThemedText type="small" themeColor="textMuted">
                  {new Date(lot.purchased_at).toLocaleDateString('es-CO')}
                </ThemedText>
              </View>
            ))
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

function TabChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  tabs: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    minHeight: MinTouchTarget - 4,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  search: {
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: Spacing.two },
  rowCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    paddingHorizontal: Density.compact.rowPaddingX,
    paddingVertical: Density.compact.rowPaddingY,
    gap: 2,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  flex: { flex: 1 },
  lotsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
});
