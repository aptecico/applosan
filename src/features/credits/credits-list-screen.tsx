import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
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
  receivableStatusLabel,
  receivableStatusTone,
  saleCode,
} from '@/features/sales/sale-format';
import { listReceivables } from '@/services/backend';
import type { Receivable } from '@/types/commerce';

export function CreditsListScreen() {
  const router = useRouter();
  const { session, loading: cashLoading } = useOpenCashSession();
  const [rows, setRows] = useState<Receivable[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listReceivables());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los créditos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible =
    filter === 'all' ? rows : rows.filter((row) => row.status !== 'paid' && row.balance > 0);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Créditos</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Cuentas por cobrar y abonos.
        </ThemedText>
      </View>

      <CashStatusBanner session={session} loading={cashLoading} compact />

      <View style={styles.filters}>
        <Pressable onPress={() => setFilter('open')}>
          <StatusBadge label="Pendientes" tone={filter === 'open' ? 'warning' : 'neutral'} />
        </Pressable>
        <Pressable onPress={() => setFilter('all')}>
          <StatusBadge label="Todos" tone={filter === 'all' ? 'success' : 'neutral'} />
        </Pressable>
      </View>

      {loading ? <ThemedText themeColor="textSecondary">Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {!loading && visible.length === 0 ? (
        <EmptyState
          icon="package"
          title="Sin créditos"
          description="Las ventas a crédito aparecerán aquí."
        />
      ) : null}

      {visible.map((row) => (
        <Pressable key={row.id} onPress={() => router.push(`/credits/${row.id}` as Href)}>
          <ListRow
            density="compact"
            trailing={
              <View style={styles.trailing}>
                <ThemedText type="smallBold">{formatMoneyCOP(row.balance)}</ThemedText>
                <StatusBadge
                  label={receivableStatusLabel(row.status)}
                  tone={receivableStatusTone(row.status)}
                />
              </View>
            }>
            <ThemedText type="smallBold">{row.customers?.full_name ?? 'Cliente'}</ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              Venta #{saleCode(row.sale_id)} · {formatPurchaseDateTime(row.created_at)}
            </ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              Total {formatMoneyCOP(row.total)} · Pagado {formatMoneyCOP(row.paid)}
            </ThemedText>
          </ListRow>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  filters: { flexDirection: 'row', gap: Spacing.two },
  trailing: { alignItems: 'flex-end', gap: 4 },
});
