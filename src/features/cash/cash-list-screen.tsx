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
import { formatMoneyCOP, formatPurchaseDateTime } from '@/features/purchases/purchase-format';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { listCashSessions } from '@/services/backend';
import type { CashSession } from '@/types/commerce';

export function CashListScreen() {
  const router = useRouter();
  const { hasPermission } = useWorkspace();
  const { session, loading: openLoading, refresh } = useOpenCashSession();
  const [rows, setRows] = useState<CashSession[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await refresh();
      setRows(await listCashSessions());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las cajas.');
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!hasPermission('cash.view') && !hasPermission('cash.open')) {
    return (
      <Screen>
        <ThemedText themeColor="destructive">No tienes permiso para ver caja.</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Caja</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Apertura, movimientos y cierre del día.
        </ThemedText>
      </View>

      <CashStatusBanner session={session} loading={openLoading} />

      {hasPermission('cash.open') && !session ? (
        <AppButton title="Abrir caja" icon="plus" onPress={() => router.push('/cash/open' as Href)} />
      ) : null}

      {session ? (
        <View style={styles.quick}>
          {(hasPermission('cash.open') || hasPermission('cash.close')) ? (
            <>
              <AppButton
                title="Ingreso"
                icon="plus"
                variant="secondary"
                onPress={() => router.push(`/cash/${session.id}` as Href)}
                style={styles.quickBtn}
              />
              <AppButton
                title="Retiro"
                icon="minus"
                variant="secondary"
                onPress={() => router.push(`/cash/${session.id}` as Href)}
                style={styles.quickBtn}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {loading ? <ThemedText themeColor="textSecondary">Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState icon="package" title="Sin historial de caja" description="Abre la primera caja del día." />
      ) : null}

      {rows.map((item) => (
        <Pressable key={item.id} onPress={() => router.push(`/cash/${item.id}` as Href)}>
          <ListRow
            density="compact"
            trailing={
              <StatusBadge
                label={item.status === 'open' ? 'Abierta' : 'Cerrada'}
                tone={item.status === 'open' ? 'success' : 'neutral'}
              />
            }>
            <ThemedText type="smallBold">
              Caja #{item.id.replace(/-/g, '').slice(-6).toUpperCase()}
            </ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              {formatPurchaseDateTime(item.opened_at)} · {formatMoneyCOP(item.opening_cash)}
            </ThemedText>
          </ListRow>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  quick: { flexDirection: 'row', gap: Spacing.two },
  quickBtn: { flex: 1 },
});
