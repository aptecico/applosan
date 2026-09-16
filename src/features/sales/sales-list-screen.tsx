import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import { CashStatusBanner } from '@/features/cash/cash-status-banner';
import { useOpenCashSession } from '@/features/cash/use-open-cash-session';
import {
  formatMoneyCOP,
  formatPurchaseDateTime,
} from '@/features/purchases/purchase-format';
import {
  paymentMethodLabel,
  saleStatusLabel,
  saleStatusTone,
  saleTitle,
} from '@/features/sales/sale-format';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { listSales } from '@/services/backend';
import type { SaleWithRelations } from '@/types/commerce';

export function SalesListScreen() {
  const router = useRouter();
  const { hasPermission } = useWorkspace();
  const { session, loading: cashLoading } = useOpenCashSession();
  const [rows, setRows] = useState<SaleWithRelations[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listSales());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las ventas.');
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
        <ThemedText type="heading">Ventas</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Historial reciente de ventas.
        </ThemedText>
      </View>

      <CashStatusBanner session={session} loading={cashLoading} compact />

      {hasPermission('sales.create') ? (
        <AppButton
          title="Nueva venta"
          icon="plus"
          onPress={() => router.push('/sales/new' as Href)}
        />
      ) : null}

      {loading ? <ThemedText themeColor="textSecondary">Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon="package"
          title="Sin ventas"
          description="Registra la primera venta del día."
        />
      ) : null}

      {rows.map((sale) => (
        <Pressable key={sale.id} onPress={() => router.push(`/sales/${sale.id}` as Href)}>
          <ListRow
            density="compact"
            trailing={
              <View style={styles.trailing}>
                <ThemedText type="smallBold">{formatMoneyCOP(sale.total)}</ThemedText>
                <StatusBadge
                  label={saleStatusLabel(sale.status)}
                  tone={saleStatusTone(sale.status)}
                />
              </View>
            }>
            <ThemedText type="smallBold">{saleTitle(sale.id)}</ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              {formatPurchaseDateTime(sale.sold_at)} · {paymentMethodLabel(sale.payment_method)}
              {sale.customers?.full_name ? ` · ${sale.customers.full_name}` : ''}
            </ThemedText>
          </ListRow>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  trailing: { alignItems: 'flex-end', gap: 4 },
});
