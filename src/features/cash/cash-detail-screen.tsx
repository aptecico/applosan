import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import { CashClosedGate } from '@/features/cash/cash-status-banner';
import { CashMovementModal } from '@/features/cash/cash-movement-modal';
import { formatMoneyCOP, formatPurchaseDateTime } from '@/features/purchases/purchase-format';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import {
  getCashSession,
  getCashSessionSummary,
  listCashMovements,
} from '@/services/backend';
import type { CashMovement, CashSession, CashSessionSummary } from '@/types/commerce';

type MoveFilter = 'all' | 'in' | 'out' | 'sales' | 'payments' | 'expenses';

function movementIcon(type: string): AppIconName {
  if (type === 'cash_in') return 'arrowUp';
  if (type === 'cash_out') return 'arrowDown';
  if (type === 'expense') return 'receipt';
  if (type.startsWith('sale_')) return 'cart';
  if (type.startsWith('credit_payment')) return 'creditCard';
  return 'wallet';
}

function movementSign(type: string): string {
  if (type === 'cash_out' || type === 'expense' || type === 'refund') return '-';
  if (type === 'sale_credit') return '';
  return '+';
}

function movementReference(move: CashMovement): string | null {
  const meta = move.meta ?? {};
  const ref =
    (typeof meta.reference === 'string' && meta.reference) ||
    (typeof meta.transfer_reference === 'string' && meta.transfer_reference) ||
    null;
  return ref;
}

export function CashDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useWorkspace();
  const [session, setSession] = useState<CashSession | null>(null);
  const [summary, setSummary] = useState<CashSessionSummary | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [filter, setFilter] = useState<MoveFilter>('all');
  const [modalKind, setModalKind] = useState<'cash_in' | 'cash_out' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const canMove = hasPermission('cash.open') || hasPermission('cash.close');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [nextSession, nextSummary, nextMoves] = await Promise.all([
        getCashSession(id),
        getCashSessionSummary(id),
        listCashMovements(id),
      ]);
      setSession(nextSession);
      setSummary(nextSummary);
      setMovements(nextMoves);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar la caja.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return movements;
    if (filter === 'in') return movements.filter((m) => m.type === 'cash_in');
    if (filter === 'out') return movements.filter((m) => m.type === 'cash_out');
    if (filter === 'expenses') return movements.filter((m) => m.type === 'expense');
    if (filter === 'sales') return movements.filter((m) => m.type.startsWith('sale_'));
    return movements.filter((m) => m.type.startsWith('credit_payment'));
  }, [movements, filter]);

  if (loading) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </Screen>
    );
  }

  if (!session || !summary) {
    return (
      <Screen>
        <ThemedText themeColor="destructive">{error || 'Caja no encontrada.'}</ThemedText>
      </Screen>
    );
  }

  const open = session.status === 'open';

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">
          Caja #{session.id.replace(/-/g, '').slice(-6).toUpperCase()}
        </ThemedText>
        <StatusBadge
          label={open ? 'Abierta' : 'Cerrada'}
          tone={open ? 'success' : 'neutral'}
        />
      </View>

      <Card density="compact">
        <SummaryRow label="Efectivo inicial" value={formatMoneyCOP(summary.opening_cash)} />
        <SummaryRow label="Ventas efectivo" value={formatMoneyCOP(summary.sales_cash)} />
        <SummaryRow label="Abonos efectivo" value={formatMoneyCOP(summary.credit_payments_cash)} />
        <SummaryRow label="Ingresos" value={formatMoneyCOP(summary.cash_in)} />
        <SummaryRow label="Gastos" value={`-${formatMoneyCOP(summary.expenses_cash)}`} />
        <SummaryRow label="Retiros" value={`-${formatMoneyCOP(summary.cash_out)}`} />
        <SummaryRow label="Efectivo esperado" value={formatMoneyCOP(summary.expected_cash)} emphasize />
        <SummaryRow label="Transferencias" value={formatMoneyCOP(summary.transfers_total)} />
        <SummaryRow label="Ventas crédito" value={formatMoneyCOP(summary.sales_credit)} />
      </Card>

      {open && canMove ? (
        <View style={styles.actions}>
          <AppButton
            title="Ingreso"
            icon="plus"
            variant="secondary"
            onPress={() => setModalKind('cash_in')}
            style={styles.actionBtn}
          />
          <AppButton
            title="Retiro"
            icon="minus"
            variant="secondary"
            onPress={() => setModalKind('cash_out')}
            style={styles.actionBtn}
          />
        </View>
      ) : null}

      {open && hasPermission('expenses.create') ? (
        <AppButton
          title="Registrar gasto"
          icon="receipt"
          variant="secondary"
          onPress={() => router.push('/expenses/new' as Href)}
        />
      ) : null}

      {!open && canMove ? (
        <CashClosedGate
          canOpen={hasPermission('cash.open')}
          message="Debes abrir la caja para registrar ingresos o retiros."
        />
      ) : null}

      {open && hasPermission('cash.close') ? (
        <AppButton
          title="Cerrar caja"
          onPress={() => router.push(`/cash/${session.id}/close` as Href)}
        />
      ) : null}

      <ThemedText type="smallBold">Movimientos</ThemedText>
      <View style={styles.filters}>
        {(
          [
            ['all', 'Todos'],
            ['in', 'Ingresos'],
            ['out', 'Retiros'],
            ['expenses', 'Gastos'],
            ['sales', 'Ventas'],
            ['payments', 'Pagos'],
          ] as const
        ).map(([key, label]) => (
          <AppButton
            key={key}
            title={label}
            variant={filter === key ? 'primary' : 'secondary'}
            onPress={() => setFilter(key)}
            style={styles.filterBtn}
          />
        ))}
      </View>

      {filtered.map((move) => {
        const ref = movementReference(move);
        const sign = movementSign(move.type);
        return (
          <ListRow
            key={move.id}
            density="compact"
            leading={<AppIcon name={movementIcon(move.type)} size={16} themeColor="textSecondary" />}
            trailing={
              <ThemedText type="smallBold">
                {sign}
                {formatMoneyCOP(move.amount)}
              </ThemedText>
            }>
            <ThemedText type="smallBold">{move.summary}</ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              {formatPurchaseDateTime(move.created_at)}
              {move.profiles?.full_name ? ` · ${move.profiles.full_name}` : ''}
            </ThemedText>
            {ref ? (
              <ThemedText type="small" themeColor="textMuted">
                Ref. {ref}
              </ThemedText>
            ) : null}
          </ListRow>
        );
      })}

      <CashMovementModal
        visible={modalKind != null}
        kind={modalKind ?? 'cash_in'}
        availableCash={summary.expected_cash}
        onClose={() => setModalKind(null)}
        onSaved={() => void load()}
      />
    </Screen>
  );
}

function SummaryRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText type="small" themeColor="textMuted">
        {label}
      </ThemedText>
      <ThemedText type={emphasize ? 'smallBold' : 'small'}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: { flexDirection: 'row', gap: Spacing.two },
  actionBtn: { flex: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  filterBtn: { minWidth: 72, paddingHorizontal: Spacing.two },
});
