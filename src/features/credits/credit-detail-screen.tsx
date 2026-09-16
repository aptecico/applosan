import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import { CashClosedGate, CashStatusBanner } from '@/features/cash/cash-status-banner';
import { useOpenCashSession } from '@/features/cash/use-open-cash-session';
import {
  formatMoneyCOP,
  formatPurchaseDateTime,
} from '@/features/purchases/purchase-format';
import {
  paymentMethodLabel,
  receivableStatusLabel,
  receivableStatusTone,
  saleCode,
} from '@/features/sales/sale-format';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import {
  getReceivable,
  listCreditPayments,
  registerCreditPayment,
} from '@/services/backend';
import type { CreditPayment, Receivable } from '@/types/commerce';

export function CreditDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings, hasPermission } = useWorkspace();
  const { session, isOpen, loading: cashLoading, refresh } = useOpenCashSession();
  const [receivable, setReceivable] = useState<Receivable | null>(null);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash');
  const [transferRef, setTransferRef] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allowPartial = settings?.allow_partial_payments !== false;
  const canPay = hasPermission('credits.payments');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      await refresh();
      const next = await getReceivable(id);
      setReceivable(next);
      setPayments(await listCreditPayments(id));
      setAmount(String(next.balance));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar el crédito.');
    } finally {
      setLoading(false);
    }
  }, [id, refresh]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const amountNum = Number(amount.replace(',', '.')) || 0;

  function validate(): string | null {
    if (!receivable) return 'Crédito no encontrado.';
    if (!isOpen) return 'Debes abrir una caja para registrar abonos.';
    if (receivable.balance <= 0) return 'Esta cuenta ya está pagada.';
    if (amountNum <= 0) return 'Indica un monto válido.';
    if (amountNum > receivable.balance) return 'El abono no puede superar el saldo.';
    if (!allowPartial && amountNum < receivable.balance) {
      return 'Los pagos parciales no están habilitados. Debes pagar el saldo completo.';
    }
    if (method === 'transfer' && !transferRef.trim()) {
      return 'Ingresa la referencia de la transferencia.';
    }
    return null;
  }

  async function onConfirm() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      await registerCreditPayment(
        id,
        amountNum,
        method,
        method === 'transfer' ? transferRef.trim() : undefined,
        notes.trim() || undefined,
      );
      setConfirmOpen(false);
      setNotes('');
      setTransferRef('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo registrar el abono.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || cashLoading) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </Screen>
    );
  }

  if (!receivable) {
    return (
      <Screen>
        <ThemedText themeColor="destructive">{error || 'Crédito no encontrado.'}</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">{receivable.customers?.full_name ?? 'Crédito'}</ThemedText>
        <StatusBadge
          label={receivableStatusLabel(receivable.status)}
          tone={receivableStatusTone(receivable.status)}
        />
      </View>

      <CashStatusBanner session={session} compact />

      <Card density="compact">
        <Row label="Venta" value={`#${saleCode(receivable.sale_id)}`} />
        <Row label="Total" value={formatMoneyCOP(receivable.total)} />
        <Row label="Pagado" value={formatMoneyCOP(receivable.paid)} />
        <Row label="Saldo" value={formatMoneyCOP(receivable.balance)} bold />
        {receivable.due_at ? (
          <Row label="Vence" value={formatPurchaseDateTime(receivable.due_at)} />
        ) : null}
      </Card>

      {canPay && receivable.balance > 0 ? (
        !isOpen ? (
          <CashClosedGate
            canOpen={hasPermission('cash.open')}
            message="Abre la caja para registrar abonos de crédito."
          />
        ) : (
          <Card density="compact">
            <ThemedText type="smallBold">Registrar abono</ThemedText>
            <AppTextField
              label="Monto"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <View style={styles.methods}>
              <AppButton
                title="Efectivo"
                variant={method === 'cash' ? 'primary' : 'secondary'}
                onPress={() => setMethod('cash')}
                style={styles.methodBtn}
              />
              <AppButton
                title="Transferencia"
                variant={method === 'transfer' ? 'primary' : 'secondary'}
                onPress={() => setMethod('transfer')}
                style={styles.methodBtn}
              />
            </View>
            {method === 'transfer' ? (
              <AppTextField
                label="Referencia"
                value={transferRef}
                onChangeText={setTransferRef}
              />
            ) : null}
            <AppTextField label="Notas (opcional)" value={notes} onChangeText={setNotes} />
            {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}
            <AppButton
              title="Registrar abono"
              onPress={() => {
                const validationError = validate();
                if (validationError) {
                  setError(validationError);
                  return;
                }
                setConfirmOpen(true);
              }}
            />
          </Card>
        )
      ) : null}

      <ThemedText type="smallBold">Historial de abonos</ThemedText>
      {payments.length === 0 ? (
        <ThemedText themeColor="textMuted" type="small">
          Aún no hay abonos.
        </ThemedText>
      ) : null}
      {payments.map((payment) => (
        <ListRow
          key={payment.id}
          density="compact"
          trailing={<ThemedText type="smallBold">{formatMoneyCOP(payment.amount)}</ThemedText>}>
          <ThemedText type="smallBold">{paymentMethodLabel(payment.payment_method)}</ThemedText>
          <ThemedText type="small" themeColor="textMuted">
            {formatPurchaseDateTime(payment.created_at)}
            {payment.profiles?.full_name ? ` · ${payment.profiles.full_name}` : ''}
          </ThemedText>
          {payment.transfer_reference ? (
            <ThemedText type="small" themeColor="textMuted">
              Ref. {payment.transfer_reference}
            </ThemedText>
          ) : null}
        </ListRow>
      ))}

      <ConfirmDialog
        visible={confirmOpen}
        title="Confirmar abono"
        message={`${paymentMethodLabel(method)} · ${formatMoneyCOP(amountNum)}`}
        confirmLabel={saving ? 'Guardando…' : 'Confirmar'}
        loading={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void onConfirm()}
      />
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textMuted">
        {label}
      </ThemedText>
      <ThemedText type={bold ? 'smallBold' : 'small'}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  methods: { flexDirection: 'row', gap: Spacing.one },
  methodBtn: { flex: 1 },
});
