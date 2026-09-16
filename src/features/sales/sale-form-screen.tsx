import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ProductPickerModal } from '@/components/ui/product-picker-modal';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { CashClosedGate, CashStatusBanner } from '@/features/cash/cash-status-banner';
import { useOpenCashSession } from '@/features/cash/use-open-cash-session';
import { PurchaseLineItem } from '@/features/purchases/purchase-line-item';
import {
  formatMoneyCOP,
  productLabel,
} from '@/features/purchases/purchase-format';
import { CustomerPickerModal } from '@/features/sales/customer-picker-modal';
import { paymentMethodLabel } from '@/features/sales/sale-format';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import {
  createSale,
  listInventoryBalances,
  listProducts,
  type Customer,
} from '@/services/backend';
import type { Product } from '@/types/catalog';
import type { PaymentMethod } from '@/types/commerce';

type DraftLine = {
  key: string;
  product_id: string;
  quantity: number;
  unit_price: string;
};

export function SaleFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { branch, settings, hasPermission } = useWorkspace();
  const { session, isOpen, loading: cashLoading, refresh } = useOpenCashSession();

  const [products, setProducts] = useState<Product[]>([]);
  const [stockByProductId, setStockByProductId] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [pendingLine, setPendingLine] = useState<{
    product: Product;
    quantity: number;
    unit_price: string;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [transferRef, setTransferRef] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeLine, setRemoveLine] = useState<DraftLine | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allowCredit = settings?.allow_credit_sales !== false;
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const price = Number(line.unit_price.replace(',', '.')) || 0;
        return sum + line.quantity * price;
      }, 0),
    [lines],
  );

  const receivedNum = Number(amountReceived.replace(',', '.')) || 0;
  const change = paymentMethod === 'cash' ? Math.max(0, receivedNum - total) : 0;

  const pendingSubtotal = useMemo(() => {
    if (!pendingLine) return 0;
    const price = Number(pendingLine.unit_price.replace(',', '.')) || 0;
    return pendingLine.quantity * price;
  }, [pendingLine]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await refresh();
      const [nextProducts, inventory] = await Promise.all([
        listProducts(),
        listInventoryBalances().catch(() => []),
      ]);
      setProducts(nextProducts.filter((item) => item.status === 'active'));
      const stockMap: Record<string, number> = {};
      for (const row of inventory) {
        if (branch?.id && row.branch_id !== branch.id) continue;
        stockMap[row.product_id] = (stockMap[row.product_id] ?? 0) + row.qty_on_hand;
      }
      setStockByProductId(stockMap);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }, [branch?.id, refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  function onProductPicked(product: Product) {
    setPickerOpen(false);
    const existing = lines.find((line) => line.product_id === product.id);
    if (existing) {
      setEditingLineKey(existing.key);
      setPendingLine({
        product,
        quantity: existing.quantity,
        unit_price: existing.unit_price,
      });
      return;
    }
    setEditingLineKey(null);
    setPendingLine({
      product,
      quantity: 1,
      unit_price: String(product.sale_price ?? 0),
    });
  }

  function confirmPendingLine() {
    if (!pendingLine) return;
    const price = Number(pendingLine.unit_price.replace(',', '.'));
    if (!pendingLine.unit_price.trim() || Number.isNaN(price) || price < 0) {
      setError('Indica un precio válido.');
      return;
    }
    if (pendingLine.quantity <= 0) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }
    const stock = stockByProductId[pendingLine.product.id] ?? 0;
    if (pendingLine.product.track_inventory && pendingLine.quantity > stock) {
      setError(`Stock insuficiente. Disponible: ${stock}.`);
      return;
    }

    setError('');
    if (editingLineKey) {
      setLines((prev) =>
        prev.map((line) =>
          line.key === editingLineKey
            ? {
                ...line,
                quantity: pendingLine.quantity,
                unit_price: pendingLine.unit_price,
              }
            : line,
        ),
      );
    } else {
      setLines((prev) => [
        ...prev,
        {
          key: `${pendingLine.product.id}-${Date.now()}`,
          product_id: pendingLine.product.id,
          quantity: pendingLine.quantity,
          unit_price: pendingLine.unit_price,
        },
      ]);
    }
    setPendingLine(null);
    setEditingLineKey(null);
  }

  function validate(): string | null {
    if (!branch?.id) return 'No hay sucursal activa.';
    if (!isOpen) return 'Debes abrir una caja antes de vender.';
    if (lines.length === 0) return 'Agrega al menos un producto.';
    if (paymentMethod === 'credit') {
      if (!allowCredit) return 'Las ventas a crédito no están habilitadas.';
      if (!customer) return 'Selecciona un cliente para vender a crédito.';
    }
    if (paymentMethod === 'cash') {
      if (receivedNum < total) return 'El monto recibido es menor al total.';
    }
    if (paymentMethod === 'transfer' && !transferRef.trim()) {
      return 'Ingresa la referencia de la transferencia.';
    }
    for (const line of lines) {
      const product = productMap.get(line.product_id);
      const stock = stockByProductId[line.product_id] ?? 0;
      if (product?.track_inventory && line.quantity > stock) {
        return `Stock insuficiente para ${product.name}.`;
      }
    }
    return null;
  }

  async function onConfirm() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!branch?.id) return;

    setSaving(true);
    setError('');
    try {
      const sale = await createSale({
        branch_id: branch.id,
        payment_method: paymentMethod,
        customer_id: customer?.id ?? null,
        amount_received: paymentMethod === 'cash' ? receivedNum : null,
        transfer_reference: paymentMethod === 'transfer' ? transferRef.trim() : null,
        notes: notes.trim() || null,
        lines: lines.map((line) => ({
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: Number(line.unit_price.replace(',', '.')) || 0,
        })),
      });
      setConfirmOpen(false);
      router.replace(`/sales/${sale.id}` as Href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo registrar la venta.');
    } finally {
      setSaving(false);
    }
  }

  if (!hasPermission('sales.create')) {
    return (
      <Screen>
        <ThemedText themeColor="destructive">No tienes permiso para crear ventas.</ThemedText>
      </Screen>
    );
  }

  if (loading || cashLoading) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </Screen>
    );
  }

  if (!isOpen) {
    return (
      <Screen>
        <CashStatusBanner session={session} />
        <CashClosedGate
          canOpen={hasPermission('cash.open')}
          message="Abre la caja para registrar ventas (efectivo, transferencia o crédito)."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Nueva venta</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Cobro rápido con caja abierta.
        </ThemedText>
      </View>

      <CashStatusBanner session={session} compact />

      <Card density="compact">
        <ThemedText type="smallBold">Cliente</ThemedText>
        <Pressable
          onPress={() => setCustomerPickerOpen(true)}
          style={[styles.selector, { borderColor: theme.border }]}>
          <ThemedText>
            {customer?.full_name ?? (paymentMethod === 'credit' ? 'Obligatorio · Elegir…' : 'Opcional · Elegir…')}
          </ThemedText>
        </Pressable>
        {customer ? (
          <AppButton title="Quitar cliente" variant="ghost" onPress={() => setCustomer(null)} />
        ) : null}
      </Card>

      <View style={styles.sectionHead}>
        <ThemedText type="smallBold">Productos</ThemedText>
        <AppButton title="Agregar" icon="plus" variant="secondary" onPress={() => setPickerOpen(true)} />
      </View>

      {lines.map((line) => {
        const product = productMap.get(line.product_id);
        return (
          <PurchaseLineItem
            key={line.key}
            name={product?.name ?? 'Producto'}
            sku={product?.sku}
            brand={product?.brand}
            color={product?.color}
            size={product?.size}
            quantity={line.quantity}
            unitCost={Number(line.unit_price.replace(',', '.')) || 0}
            onEdit={() => {
              if (!product) return;
              setEditingLineKey(line.key);
              setPendingLine({
                product,
                quantity: line.quantity,
                unit_price: line.unit_price,
              });
            }}
            onRemove={() => setRemoveLine(line)}
          />
        );
      })}

      <Card density="compact">
        <ThemedText type="smallBold">Método de pago</ThemedText>
        <View style={styles.methods}>
          {(['cash', 'transfer', ...(allowCredit ? (['credit'] as const) : [])] as PaymentMethod[]).map(
            (method) => (
              <AppButton
                key={method}
                title={paymentMethodLabel(method)}
                variant={paymentMethod === method ? 'primary' : 'secondary'}
                onPress={() => setPaymentMethod(method)}
                style={styles.methodBtn}
              />
            ),
          )}
        </View>

        {paymentMethod === 'cash' ? (
          <>
            <AppTextField
              label="Recibido"
              keyboardType="decimal-pad"
              value={amountReceived}
              onChangeText={setAmountReceived}
              placeholder={String(total || 0)}
            />
            <ThemedText type="small" themeColor="textMuted">
              Cambio: {formatMoneyCOP(change)}
            </ThemedText>
          </>
        ) : null}

        {paymentMethod === 'transfer' ? (
          <AppTextField
            label="Referencia de transferencia"
            value={transferRef}
            onChangeText={setTransferRef}
            placeholder="Núm. de comprobante"
          />
        ) : null}

        {paymentMethod === 'credit' ? (
          <ThemedText type="small" themeColor="textMuted">
            Se crea una cuenta por cobrar. No mueve efectivo.
          </ThemedText>
        ) : null}

        <AppTextField label="Notas (opcional)" value={notes} onChangeText={setNotes} />
      </Card>

      <View style={styles.totalRow}>
        <ThemedText type="section">Total</ThemedText>
        <ThemedText type="heading">{formatMoneyCOP(total)}</ThemedText>
      </View>

      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      <AppButton
        title="Confirmar venta"
        icon="save"
        onPress={() => {
          const validationError = validate();
          if (validationError) {
            setError(validationError);
            return;
          }
          setConfirmOpen(true);
        }}
      />

      <ProductPickerModal
        visible={pickerOpen}
        products={products}
        stockByProductId={stockByProductId}
        onClose={() => setPickerOpen(false)}
        onSelect={onProductPicked}
      />

      <CustomerPickerModal
        visible={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={setCustomer}
      />

      <ConfirmDialog
        visible={Boolean(pendingLine)}
        title={editingLineKey ? 'Editar producto' : 'Cantidad y precio'}
        confirmLabel={editingLineKey ? 'Guardar' : 'Agregar'}
        onCancel={() => {
          setPendingLine(null);
          setEditingLineKey(null);
        }}
        onConfirm={confirmPendingLine}>
        {pendingLine ? (
          <View style={styles.confirmBody}>
            <ThemedText type="smallBold">{productLabel(pendingLine.product)}</ThemedText>
            <QuantityStepper
              value={pendingLine.quantity}
              onChange={(quantity) => setPendingLine({ ...pendingLine, quantity })}
            />
            <AppTextField
              keyboardType="decimal-pad"
              label="Precio de venta"
              value={pendingLine.unit_price}
              onChangeText={(unit_price) => setPendingLine({ ...pendingLine, unit_price })}
            />
            <ThemedText type="small" themeColor="textMuted">
              Subtotal {formatMoneyCOP(pendingSubtotal)}
            </ThemedText>
          </View>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        visible={Boolean(removeLine)}
        title="Quitar producto"
        message="Se eliminará de esta venta."
        destructive
        confirmLabel="Quitar"
        onCancel={() => setRemoveLine(null)}
        onConfirm={() => {
          if (!removeLine) return;
          setLines((prev) => prev.filter((line) => line.key !== removeLine.key));
          setRemoveLine(null);
        }}
      />

      <ConfirmDialog
        visible={confirmOpen}
        title="Confirmar venta"
        message={`${paymentMethodLabel(paymentMethod)} · ${formatMoneyCOP(total)}${
          customer ? ` · ${customer.full_name}` : ''
        }`}
        confirmLabel={saving ? 'Guardando…' : 'Confirmar'}
        loading={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void onConfirm()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  selector: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: Spacing.three,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  methodBtn: { minWidth: 100 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmBody: { gap: Spacing.two },
});
