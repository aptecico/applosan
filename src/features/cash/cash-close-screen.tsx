import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import { formatMoneyCOP } from '@/features/purchases/purchase-format';
import { closeCashSession, getCashSessionSummary } from '@/services/backend';
import type { CashSessionSummary } from '@/types/commerce';

export function CashCloseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [summary, setSummary] = useState<CashSessionSummary | null>(null);
  const [counted, setCounted] = useState('');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const next = await getCashSessionSummary(id);
      setSummary(next);
      setCounted(String(next.expected_cash));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const countedNum = Number(counted.replace(',', '.')) || 0;
  const expected = summary?.expected_cash ?? 0;
  const diff = countedNum - expected;
  const diffLabel =
    diff === 0
      ? 'Caja cuadrada'
      : diff > 0
        ? `Sobrante ${formatMoneyCOP(diff)}`
        : `Faltante ${formatMoneyCOP(Math.abs(diff))}`;

  async function onConfirm() {
    if (!id) return;
    if (diff !== 0 && !reason.trim()) {
      setError('Indica el motivo de la diferencia.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await closeCashSession(id, countedNum, reason.trim() || undefined);
      setConfirmOpen(false);
      router.replace(`/cash/${id}` as Href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cerrar la caja.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !summary) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">{error || 'Cargando…'}</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Cierre de caja</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Cuenta solo el efectivo físico.
        </ThemedText>
      </View>

      <Card density="compact">
        <Row label="Efectivo inicial" value={formatMoneyCOP(summary.opening_cash)} />
        <Row label="Ventas efectivo" value={formatMoneyCOP(summary.sales_cash)} />
        <Row label="Abonos efectivo" value={formatMoneyCOP(summary.credit_payments_cash)} />
        <Row label="Ingresos" value={formatMoneyCOP(summary.cash_in)} />
        <Row label="Gastos" value={`-${formatMoneyCOP(summary.expenses_cash)}`} />
        <Row label="Retiros" value={`-${formatMoneyCOP(summary.cash_out)}`} />
        <Row label="Efectivo esperado" value={formatMoneyCOP(expected)} bold />
        <Row label="Transferencias (info)" value={formatMoneyCOP(summary.transfers_total)} />
        <Row label="Ventas a crédito" value={formatMoneyCOP(summary.sales_credit)} />
      </Card>

      <AppTextField
        label="Efectivo contado"
        keyboardType="decimal-pad"
        value={counted}
        onChangeText={setCounted}
      />

      <StatusBadge label={diffLabel} tone={diff === 0 ? 'success' : 'warning'} />

      {diff !== 0 ? (
        <AppTextField
          label="Motivo de la diferencia"
          value={reason}
          onChangeText={setReason}
          placeholder="Explica el faltante o sobrante"
        />
      ) : null}

      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      <AppButton title="Revisar y cerrar" onPress={() => setConfirmOpen(true)} />
      <AppButton title="Cancelar" variant="ghost" onPress={() => router.back()} />

      <ConfirmDialog
        visible={confirmOpen}
        title="Confirmar cierre"
        message={`Esperado ${formatMoneyCOP(expected)} · Contado ${formatMoneyCOP(countedNum)} · ${diffLabel}`}
        confirmLabel={saving ? 'Cerrando…' : 'Confirmar cierre'}
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
  header: { gap: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
