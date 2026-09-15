import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ProductPickerModal } from '@/components/ui/product-picker-modal';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Screen } from '@/components/ui/screen';
import { BottomTabInset, MinTouchTarget, Radii, Spacing } from '@/constants/theme';
import { PurchaseLineItem } from '@/features/purchases/purchase-line-item';
import {
  formatMoneyCOP,
  productLabel,
  purchaseCode,
} from '@/features/purchases/purchase-format';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import {
  createPurchase,
  getPurchase,
  listBranches,
  listInventoryBalances,
  listProducts,
  listSuppliers,
  syncPurchase,
} from '@/services/backend';
import type { Product, Supplier } from '@/types/catalog';
import type { Branch } from '@/types/saas';

type DraftLine = {
  key: string;
  product_id: string;
  quantity: number;
  unit_cost: string;
};

export function PurchaseFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { tenant, branch, profile, hasPermission } = useWorkspace();

  const [products, setProducts] = useState<Product[]>([]);
  const [stockByProductId, setStockByProductId] = useState<Record<string, number>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(branch?.id ?? null);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [pendingLine, setPendingLine] = useState<{
    product: Product;
    quantity: number;
    unit_cost: string;
  } | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<Product | null>(null);
  const [removeLine, setRemoveLine] = useState<DraftLine | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'draft' | 'received' | 'cancelled'>('draft');
  const [baseline, setBaseline] = useState('');
  const allowLeaveRef = useRef(false);

  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item])), [products]);

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const cost = Number(line.unit_cost.replace(',', '.')) || 0;
        return sum + line.quantity * cost;
      }, 0),
    [lines],
  );

  const units = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        supplierId,
        branchId,
        reference,
        notes,
        lines: lines.map((line) => ({
          product_id: line.product_id,
          quantity: line.quantity,
          unit_cost: line.unit_cost,
        })),
      }),
    [supplierId, branchId, reference, notes, lines],
  );

  const isDirty = Boolean(baseline) && snapshot !== baseline && !saving;

  const pendingSubtotal = useMemo(() => {
    if (!pendingLine) return 0;
    const cost = Number(pendingLine.unit_cost.replace(',', '.')) || 0;
    return pendingLine.quantity * cost;
  }, [pendingLine]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProducts, nextSuppliers, nextBranches, inventory] = await Promise.all([
        listProducts(),
        listSuppliers(),
        listBranches(),
        listInventoryBalances().catch(() => []),
      ]);
      setProducts(nextProducts.filter((item) => item.status === 'active'));
      setSuppliers(nextSuppliers.filter((item) => item.status === 'active'));
      setBranches(nextBranches);

      let nextSupplierId: string | null = null;
      let nextBranchId = branch?.id ?? nextBranches[0]?.id ?? null;
      let nextReference = '';
      let nextNotes = '';
      let nextLines: DraftLine[] = [];

      if (id) {
        const purchase = await getPurchase(id);
        if (purchase.status === 'cancelled') {
          throw new Error('No se puede editar una compra anulada.');
        }
        setStatus(purchase.status);
        nextSupplierId = purchase.supplier_id;
        nextBranchId = purchase.branch_id;
        nextReference = purchase.reference ?? '';
        nextNotes = purchase.notes ?? '';
        nextLines = purchase.purchase_items.map((item) => ({
          key: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: String(item.unit_cost),
        }));
      }

      const stockMap: Record<string, number> = {};
      for (const row of inventory) {
        if (nextBranchId && row.branch_id !== nextBranchId) continue;
        stockMap[row.product_id] = (stockMap[row.product_id] ?? 0) + row.qty_on_hand;
      }
      setStockByProductId(stockMap);

      setSupplierId(nextSupplierId);
      setBranchId(nextBranchId);
      setReference(nextReference);
      setNotes(nextNotes);
      setLines(nextLines);
      setBaseline(
        JSON.stringify({
          supplierId: nextSupplierId,
          branchId: nextBranchId,
          reference: nextReference,
          notes: nextNotes,
          lines: nextLines.map((line) => ({
            product_id: line.product_id,
            quantity: line.quantity,
            unit_cost: line.unit_cost,
          })),
        }),
      );
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }, [id, branch?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || !isDirty) return;
      event.preventDefault();
      setDiscardOpen(true);
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  function openAddProduct() {
    setEditingLineKey(null);
    setPickerOpen(true);
  }

  function onProductPicked(product: Product) {
    const existing = lines.find((line) => line.product_id === product.id);
    if (existing && !editingLineKey) {
      setDuplicatePrompt(product);
      return;
    }
    setPendingLine({ product, quantity: 1, unit_cost: '' });
  }

  function confirmPendingLine() {
    if (!pendingLine) return;
    const cost = Number(pendingLine.unit_cost.replace(',', '.'));
    if (!pendingLine.unit_cost.trim() || Number.isNaN(cost) || cost < 0) {
      setError('Ingresa un precio de compra válido (>= 0).');
      return;
    }
    if (pendingLine.quantity <= 0) {
      setError('La cantidad debe ser mayor que 0.');
      return;
    }

    if (editingLineKey) {
      setLines((prev) =>
        prev.map((line) =>
          line.key === editingLineKey
            ? {
                ...line,
                product_id: pendingLine.product.id,
                quantity: pendingLine.quantity,
                unit_cost: pendingLine.unit_cost,
              }
            : line,
        ),
      );
      setMessage('Producto actualizado.');
    } else {
      setLines((prev) => [
        ...prev,
        {
          key: String(Date.now()),
          product_id: pendingLine.product.id,
          quantity: pendingLine.quantity,
          unit_cost: pendingLine.unit_cost,
        },
      ]);
      setMessage('Producto agregado.');
    }
    setPendingLine(null);
    setEditingLineKey(null);
    setError('');
  }

  function increaseDuplicate() {
    if (!duplicatePrompt) return;
    setLines((prev) =>
      prev.map((line) =>
        line.product_id === duplicatePrompt.id
          ? { ...line, quantity: line.quantity + 1 }
          : line,
      ),
    );
    setDuplicatePrompt(null);
    setMessage('Se aumentó la cantidad del producto ya agregado.');
  }

  function addDuplicateAsSeparateLot() {
    if (!duplicatePrompt) return;
    setPendingLine({ product: duplicatePrompt, quantity: 1, unit_cost: '' });
    setDuplicatePrompt(null);
  }

  function requestLeave() {
    if (!isDirty) {
      router.back();
      return;
    }
    setDiscardOpen(true);
  }

  function confirmDiscard() {
    allowLeaveRef.current = true;
    setDiscardOpen(false);
    router.back();
  }

  async function onSave() {
    if (!tenant?.id || !branchId) {
      setError('Falta empresa o sucursal.');
      return;
    }
    if (!lines.length) {
      setError('Agrega al menos un producto antes de guardar.');
      return;
    }
    if (isEdit && !hasPermission('purchases.update')) {
      setError('No tienes permiso para editar compras.');
      return;
    }
    if (!isEdit && !hasPermission('purchases.create')) {
      setError('No tienes permiso para registrar compras.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payloadLines = lines.map((line) => ({
        product_id: line.product_id,
        quantity: line.quantity,
        unit_cost: Number(line.unit_cost.replace(',', '.')),
      }));

      allowLeaveRef.current = true;

      if (isEdit && id) {
        await syncPurchase(id, {
          supplier_id: supplierId,
          reference,
          notes,
          lines: payloadLines,
        });
        setMessage('Compra actualizada correctamente.');
        router.replace(`/purchases/${id}` as Href);
      } else {
        const purchase = await createPurchase(tenant.id, profile?.id ?? null, {
          branch_id: branchId,
          supplier_id: supplierId,
          reference,
          notes,
          lines: payloadLines,
          receive: true,
        });
        setMessage('Compra registrada correctamente.');
        router.replace(`/purchases/${purchase.id}` as Href);
      }
    } catch (caught) {
      allowLeaveRef.current = false;
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la compra.');
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

  return (
    <Screen scroll={false} contentStyle={styles.flex}>
      <View style={styles.layout}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          style={styles.flex}>
          <View style={styles.header}>
            <ThemedText type="heading">
              {isEdit ? `Editando compra #${purchaseCode(String(id))}` : 'Nueva compra'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {isEdit
                ? status === 'received'
                  ? 'Modifica productos, cantidades o precios y guarda los cambios.'
                  : 'Continúa editando esta compra.'
                : 'Proveedor → productos → cantidad y precio → guardar.'}
            </ThemedText>
          </View>

          <Card density="comfortable">
            <ThemedText type="section">Proveedor</ThemedText>
            {!isEdit ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Sucursal
                </ThemedText>
                <View style={styles.chips}>
                  {branches.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: branchId === item.id }}
                      onPress={() => setBranchId(item.id)}
                      style={[
                        styles.chip,
                        {
                          borderColor: theme.border,
                          backgroundColor:
                            branchId === item.id
                              ? theme.backgroundSelected
                              : theme.backgroundElement,
                        },
                      ]}>
                      <ThemedText type="small">{item.name}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <ThemedText type="small" themeColor="textSecondary">
              Proveedor
            </ThemedText>
            <View style={styles.chips}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: !supplierId }}
                onPress={() => setSupplierId(null)}
                style={[
                  styles.chip,
                  {
                    borderColor: theme.border,
                    backgroundColor: !supplierId
                      ? theme.backgroundSelected
                      : theme.backgroundElement,
                  },
                ]}>
                <ThemedText type="small">Sin proveedor</ThemedText>
              </Pressable>
              {suppliers.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: supplierId === item.id }}
                  onPress={() => setSupplierId(item.id)}
                  style={[
                    styles.chip,
                    {
                      borderColor: theme.border,
                      backgroundColor:
                        supplierId === item.id
                          ? theme.backgroundSelected
                          : theme.backgroundElement,
                    },
                  ]}>
                  <ThemedText type="small">{item.name}</ThemedText>
                </Pressable>
              ))}
            </View>

            <AppTextField
              label="Documento / factura (opcional)"
              onChangeText={setReference}
              value={reference}
            />
            <AppTextField
              label="Observaciones (opcional)"
              onChangeText={setNotes}
              value={notes}
            />
          </Card>

          <Card density="comfortable">
            <View style={styles.rowBetween}>
              <ThemedText type="section">Productos</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {lines.length} {lines.length === 1 ? 'producto' : 'productos'}
              </ThemedText>
            </View>

            {lines.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                Aún no hay productos. Agrega el primero para continuar.
              </ThemedText>
            ) : (
              <View style={styles.lines}>
                {lines.map((line) => {
                  const product = productMap.get(line.product_id);
                  const cost = Number(line.unit_cost.replace(',', '.')) || 0;
                  return (
                    <PurchaseLineItem
                      key={line.key}
                      name={product?.name ?? 'Producto'}
                      sku={product?.sku}
                      brand={product?.brand}
                      color={product?.color}
                      size={product?.size}
                      quantity={line.quantity}
                      unitCost={cost}
                      onEdit={() => {
                        if (!product) return;
                        setEditingLineKey(line.key);
                        setPendingLine({
                          product,
                          quantity: line.quantity,
                          unit_cost: line.unit_cost,
                        });
                      }}
                      onRemove={() => setRemoveLine(line)}
                    />
                  );
                })}
              </View>
            )}

            <AppButton
              title="Agregar producto"
              icon="plus"
              variant="secondary"
              onPress={openAddProduct}
            />
          </Card>

          <Card density="compact">
            <ThemedText type="smallBold">Resumen</ThemedText>
            <View style={styles.summaryRow}>
              <ThemedText themeColor="textSecondary">Productos</ThemedText>
              <ThemedText>{lines.length}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText themeColor="textSecondary">Unidades</ThemedText>
              <ThemedText>{units}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText themeColor="textSecondary">Subtotal</ThemedText>
              <ThemedText>{formatMoneyCOP(total)}</ThemedText>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <ThemedText type="section">Total</ThemedText>
              <ThemedText type="section">{formatMoneyCOP(total)}</ThemedText>
            </View>
          </Card>

          {message ? <ThemedText themeColor="success">{message}</ThemedText> : null}
          {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

          <AppButton title="Cancelar" variant="ghost" onPress={requestLeave} />
        </ScrollView>

        <View
          style={[
            styles.stickyBar,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: Spacing.three,
            },
          ]}>
          <View style={styles.stickyText}>
            <ThemedText type="smallBold">
              {lines.length} {lines.length === 1 ? 'producto' : 'productos'} ·{' '}
              {formatMoneyCOP(total)}
            </ThemedText>
          </View>
          <AppButton
            loading={saving}
            icon={saving ? undefined : 'save'}
            title={
              saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar compra'
            }
            onPress={() => void onSave()}
            style={styles.stickyCta}
          />
        </View>
      </View>

      <ProductPickerModal
        visible={pickerOpen}
        products={products}
        stockByProductId={stockByProductId}
        onClose={() => setPickerOpen(false)}
        onSelect={onProductPicked}
        onProductCreated={(product) => {
          setProducts((prev) => {
            if (prev.some((item) => item.id === product.id)) return prev;
            return [product, ...prev];
          });
          setStockByProductId((prev) => ({ ...prev, [product.id]: prev[product.id] ?? 0 }));
          setMessage('Producto creado. Continúa con cantidad y precio.');
        }}
      />

      <ConfirmDialog
        visible={Boolean(duplicatePrompt)}
        title="Producto ya agregado"
        message="Este producto ya está en la compra. ¿Qué deseas hacer?"
        confirmLabel="Aumentar cantidad"
        cancelLabel="Cerrar"
        onCancel={() => setDuplicatePrompt(null)}
        onConfirm={increaseDuplicate}>
        <AppButton
          title="Agregar como otro costo/lote"
          variant="secondary"
          onPress={addDuplicateAsSeparateLot}
        />
      </ConfirmDialog>

      <ConfirmDialog
        visible={Boolean(removeLine)}
        title="Eliminar producto"
        message="Se quitará de esta compra. Puedes volver a agregarlo después."
        destructive
        confirmLabel="Eliminar"
        onCancel={() => setRemoveLine(null)}
        onConfirm={() => {
          if (!removeLine) return;
          setLines((prev) => prev.filter((line) => line.key !== removeLine.key));
          setRemoveLine(null);
          setMessage('Producto eliminado.');
        }}>
        {removeLine ? (
          <View style={styles.confirmBody}>
            <ThemedText>
              {productMap.get(removeLine.product_id)?.name ?? 'Producto'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Cantidad: {removeLine.quantity}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Precio: {formatMoneyCOP(Number(removeLine.unit_cost.replace(',', '.')) || 0)}
            </ThemedText>
          </View>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        visible={discardOpen}
        title="Cambios sin guardar"
        message="Tienes cambios sin guardar. ¿Deseas salir sin guardar?"
        confirmLabel="Salir sin guardar"
        cancelLabel="Continuar editando"
        destructive
        onCancel={() => setDiscardOpen(false)}
        onConfirm={confirmDiscard}
      />

      <ConfirmDialog
        visible={Boolean(pendingLine)}
        title={editingLineKey ? 'Editar producto' : 'Cantidad y precio'}
        confirmLabel={editingLineKey ? 'Guardar' : 'Agregar a la compra'}
        onCancel={() => {
          setPendingLine(null);
          setEditingLineKey(null);
        }}
        onConfirm={confirmPendingLine}>
        {pendingLine ? (
          <View style={styles.confirmBody}>
            <ThemedText type="smallBold">{productLabel(pendingLine.product)}</ThemedText>
            {pendingLine.product.sku ? (
              <ThemedText type="small" themeColor="textSecondary">
                {pendingLine.product.sku}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              Cantidad
            </ThemedText>
            <QuantityStepper
              value={pendingLine.quantity}
              onChange={(quantity) => setPendingLine({ ...pendingLine, quantity })}
            />
            <AppTextField
              keyboardType="decimal-pad"
              label="Precio de compra"
              helperText="Costo de este lote. No promedia compras anteriores."
              onChangeText={(unit_cost) => setPendingLine({ ...pendingLine, unit_cost })}
              value={pendingLine.unit_cost}
            />
            <View style={styles.pendingSubtotal}>
              <ThemedText type="small" themeColor="textSecondary">
                Subtotal
              </ThemedText>
              <ThemedText type="section">{formatMoneyCOP(pendingSubtotal)}</ThemedText>
            </View>
          </View>
        ) : null}
      </ConfirmDialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  layout: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  header: { gap: Spacing.two },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lines: {
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTotal: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
  },
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    marginHorizontal: -Spacing.four,
    paddingHorizontal: Spacing.four,
    marginBottom: -Spacing.four + BottomTabInset * 0,
  },
  stickyText: {
    flex: 1,
  },
  stickyCta: {
    minWidth: 148,
  },
  confirmBody: { gap: Spacing.two },
  pendingSubtotal: {
    gap: Spacing.half,
    marginTop: Spacing.one,
  },
});
