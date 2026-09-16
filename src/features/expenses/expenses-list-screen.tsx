import { useCallback, useMemo, useState } from 'react';
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
  expenseCode,
  expenseStatusLabel,
  expenseStatusTone,
  moneySourceLabel,
} from '@/features/expenses/expense-format';
import {
  formatMoneyCOP,
  formatPurchaseDateTime,
} from '@/features/purchases/purchase-format';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { listExpenses } from '@/services/backend';
import type { Expense } from '@/types/commerce';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function ExpensesListScreen() {
  const router = useRouter();
  const { hasPermission } = useWorkspace();
  const { session, loading: cashLoading } = useOpenCashSession();
  const [rows, setRows] = useState<Expense[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'all'>('today');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listExpenses());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los gastos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const todayStart = startOfDay(new Date());
  const visible = useMemo(() => {
    const base = filter === 'today'
      ? rows.filter((r) => new Date(r.created_at).getTime() >= todayStart)
      : rows;
    return base;
  }, [rows, filter, todayStart]);

  const todayTotal = useMemo(
    () =>
      rows
        .filter((r) => r.status === 'posted' && new Date(r.created_at).getTime() >= todayStart)
        .reduce((sum, r) => sum + r.amount, 0),
    [rows, todayStart],
  );

  const todayCount = useMemo(
    () =>
      rows.filter((r) => r.status === 'posted' && new Date(r.created_at).getTime() >= todayStart)
        .length,
    [rows, todayStart],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Gastos</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Salidas de dinero con categoría y origen.
        </ThemedText>
      </View>

      <CashStatusBanner session={session} loading={cashLoading} compact />

      <View style={styles.summary}>
        <ThemedText type="small" themeColor="textMuted">
          Gastos de hoy
        </ThemedText>
        <ThemedText type="section">{formatMoneyCOP(todayTotal)}</ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          {todayCount} {todayCount === 1 ? 'registro' : 'registros'}
        </ThemedText>
      </View>

      {hasPermission('expenses.create') ? (
        <AppButton
          title="Nuevo gasto"
          icon="plus"
          onPress={() => router.push('/expenses/new' as Href)}
        />
      ) : null}

      <View style={styles.filters}>
        <AppButton
          title="Hoy"
          variant={filter === 'today' ? 'primary' : 'secondary'}
          onPress={() => setFilter('today')}
          style={styles.filterBtn}
        />
        <AppButton
          title="Todos"
          variant={filter === 'all' ? 'primary' : 'secondary'}
          onPress={() => setFilter('all')}
          style={styles.filterBtn}
        />
      </View>

      {loading ? <ThemedText themeColor="textSecondary">Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {!loading && visible.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="Sin gastos"
          description="Registra el primer gasto del día."
        />
      ) : null}

      {visible.map((item) => (
        <Pressable key={item.id} onPress={() => router.push(`/expenses/${item.id}` as Href)}>
          <ListRow
            density="compact"
            trailing={
              <View style={styles.trailing}>
                <ThemedText type="smallBold">-{formatMoneyCOP(item.amount)}</ThemedText>
                <StatusBadge
                  label={expenseStatusLabel(item.status)}
                  tone={expenseStatusTone(item.status)}
                />
              </View>
            }>
            <ThemedText type="smallBold">
              {item.expense_categories?.name ?? 'Sin categoría'}
            </ThemedText>
            <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
              {item.concept} · #{expenseCode(item.id)}
            </ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              {formatPurchaseDateTime(item.created_at)} · {moneySourceLabel(item.money_source)}
            </ThemedText>
          </ListRow>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  summary: { gap: 2 },
  filters: { flexDirection: 'row', gap: Spacing.one },
  filterBtn: { minWidth: 80 },
  trailing: { alignItems: 'flex-end', gap: 4 },
});
