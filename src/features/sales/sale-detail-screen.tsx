import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import {
  formatMoneyCOP,
  formatPurchaseDateTime,
  productMetaLine,
} from '@/features/purchases/purchase-format';
import {
  paymentMethodLabel,
  receivableStatusLabel,
  receivableStatusTone,
  saleStatusLabel,
  saleStatusTone,
  saleTitle,
} from '@/features/sales/sale-format';
import { getSale } from '@/services/backend';
import type { SaleWithRelations } from '@/types/commerce';

export function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sale, setSale] = useState<SaleWithRelations | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setSale(await getSale(id));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar la venta.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </Screen>
    );
  }

  if (!sale) {
    return (
      <Screen>
        <ThemedText themeColor="destructive">{error || 'Venta no encontrada.'}</ThemedText>
      </Screen>
    );
  }

  const receivable = sale.receivables;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">{saleTitle(sale.id)}</ThemedText>
        <StatusBadge label={saleStatusLabel(sale.status)} tone={saleStatusTone(sale.status)} />
      </View>

      <Card density="compact">
        <Row label="Fecha" value={formatPurchaseDateTime(sale.sold_at)} />
        <Row label="Método" value={paymentMethodLabel(sale.payment_method)} />
        <Row label="Cliente" value={sale.customers?.full_name ?? '—'} />
        <Row label="Sucursal" value={sale.branches?.name ?? '—'} />
        <Row label="Subtotal" value={formatMoneyCOP(sale.subtotal)} />
        <Row label="Total" value={formatMoneyCOP(sale.total)} bold />
        {sale.payment_method === 'cash' ? (
          <>
            <Row label="Recibido" value={formatMoneyCOP(sale.amount_received ?? 0)} />
            <Row label="Cambio" value={formatMoneyCOP(sale.change_given ?? 0)} />
          </>
        ) : null}
        {sale.payment_method === 'transfer' && sale.transfer_reference ? (
          <Row label="Referencia" value={sale.transfer_reference} />
        ) : null}
        {sale.notes ? <Row label="Notas" value={sale.notes} /> : null}
      </Card>

      <ThemedText type="smallBold">Productos</ThemedText>
      {sale.sale_items.map((item) => (
        <ListRow
          key={item.id}
          density="compact"
          trailing={<ThemedText type="smallBold">{formatMoneyCOP(item.line_total)}</ThemedText>}>
          <ThemedText type="smallBold">{item.products?.name ?? 'Producto'}</ThemedText>
          <ThemedText type="small" themeColor="textMuted">
            {item.quantity} × {formatMoneyCOP(item.unit_price)}
            {item.products
              ? ` · ${productMetaLine(item.products)}`
              : ''}
          </ThemedText>
        </ListRow>
      ))}

      {receivable ? (
        <Card density="compact">
          <ThemedText type="smallBold">Cuenta por cobrar</ThemedText>
          <StatusBadge
            label={receivableStatusLabel(receivable.status)}
            tone={receivableStatusTone(receivable.status)}
          />
          <Row label="Total" value={formatMoneyCOP(receivable.total)} />
          <Row label="Pagado" value={formatMoneyCOP(receivable.paid)} />
          <Row label="Saldo" value={formatMoneyCOP(receivable.balance)} bold />
          {receivable.balance > 0 ? (
            <AppButton
              title="Registrar abono"
              onPress={() => router.push(`/credits/${receivable.id}` as Href)}
            />
          ) : (
            <AppButton
              title="Ver crédito"
              variant="secondary"
              onPress={() => router.push(`/credits/${receivable.id}` as Href)}
            />
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textMuted">
        {label}
      </ThemedText>
      <ThemedText type={bold ? 'smallBold' : 'small'} style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  value: { flexShrink: 1, textAlign: 'right' },
});
