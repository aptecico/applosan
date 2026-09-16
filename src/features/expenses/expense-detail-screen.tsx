import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
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
import { paymentMethodLabel } from '@/features/sales/sale-format';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { cancelExpense, getExpense } from '@/services/backend';
import type { Expense } from '@/types/commerce';

export function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hasPermission } = useWorkspace();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setExpense(await getExpense(id));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar el gasto.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onCancel() {
    if (!id) return;
    if (!reason.trim()) {
      setError('Indica el motivo de anulación.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      setExpense(await cancelExpense(id, reason.trim()));
      setCancelOpen(false);
      setReason('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo anular el gasto.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </Screen>
    );
  }

  if (!expense) {
    return (
      <Screen>
        <ThemedText themeColor="destructive">{error || 'Gasto no encontrado.'}</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Gasto #{expenseCode(expense.id)}</ThemedText>
        <StatusBadge
          label={expenseStatusLabel(expense.status)}
          tone={expenseStatusTone(expense.status)}
        />
      </View>

      <Card density="compact">
        <ThemedText type="section">
          {expense.expense_categories?.name ?? 'Sin categoría'}
        </ThemedText>
        <ThemedText>{expense.concept}</ThemedText>
        <ThemedText type="heading">-{formatMoneyCOP(expense.amount)}</ThemedText>
        <Row label="Origen" value={moneySourceLabel(expense.money_source)} />
        <Row label="Método" value={paymentMethodLabel(expense.payment_method)} />
        {expense.transfer_reference ? (
          <Row label="Referencia" value={expense.transfer_reference} />
        ) : null}
        <Row label="Registrado por" value={expense.profiles?.full_name ?? '—'} />
        <Row label="Fecha" value={formatPurchaseDateTime(expense.created_at)} />
        {expense.notes ? <Row label="Observación" value={expense.notes} /> : null}
        {expense.status === 'cancelled' && expense.cancel_reason ? (
          <Row label="Motivo anulación" value={expense.cancel_reason} />
        ) : null}
      </Card>

      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {expense.status === 'posted' && hasPermission('expenses.cancel') ? (
        <AppButton title="Anular gasto" variant="danger" onPress={() => setCancelOpen(true)} />
      ) : null}

      <ConfirmDialog
        visible={cancelOpen}
        title="Anular gasto"
        message="No se elimina el historial. Se registra una anulación con motivo."
        destructive
        confirmLabel={saving ? 'Anulando…' : 'Confirmar anulación'}
        loading={saving}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => void onCancel()}>
        <AppTextField
          label="Motivo"
          value={reason}
          onChangeText={setReason}
          placeholder="Explica por qué se anula"
        />
      </ConfirmDialog>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textMuted">
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  value: { flexShrink: 1, textAlign: 'right' },
});
