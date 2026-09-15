import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Density, Spacing } from '@/constants/theme';
import { CancelPurchaseDialog } from '@/features/purchases/cancel-purchase-dialog';
import { PurchaseLineItem } from '@/features/purchases/purchase-line-item';
import {
  formatMoneyCOP,
  formatPurchaseDateTime,
  purchaseStatusLabel,
  purchaseStatusTone,
  purchaseTitle,
} from '@/features/purchases/purchase-format';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { cancelPurchase, getPurchase, listPurchaseAudit } from '@/services/backend';
import type { PurchaseAuditEvent, PurchaseWithRelations } from '@/types/catalog';

export function PurchaseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hasPermission } = useWorkspace();
  const [purchase, setPurchase] = useState<PurchaseWithRelations | null>(null);
  const [audit, setAudit] = useState<PurchaseAuditEvent[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [nextPurchase, nextAudit] = await Promise.all([
        getPurchase(id),
        listPurchaseAudit(id).catch(() => [] as PurchaseAuditEvent[]),
      ]);
      setPurchase(nextPurchase);
      setAudit(nextAudit);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar la compra.');
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
    if (!cancelReason.trim()) {
      setCancelError('Indica el motivo de anulación.');
      return;
    }
    setCancelling(true);
    setCancelError('');
    try {
      setPurchase(await cancelPurchase(id, cancelReason.trim()));
      setMessage('Compra anulada correctamente.');
      setCancelOpen(false);
      setCancelReason('');
      setAudit(await listPurchaseAudit(id).catch(() => []));
    } catch (caught) {
      setCancelError(caught instanceof Error ? caught.message : 'No se pudo anular.');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </Screen>
    );
  }

  if (!purchase) {
    return (
      <Screen>
        <EmptyState
          title="Compra no encontrada"
          description={error || 'No pudimos cargar este registro.'}
          icon="package"
          action={<AppButton title="Volver" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const canEdit =
    hasPermission('purchases.update') && purchase.status !== 'cancelled';
  const canCancel =
    (hasPermission('purchases.delete') || hasPermission('purchases.update')) &&
    purchase.status !== 'cancelled';

  const menuItems: ActionMenuItem[] = [
    ...(canEdit
      ? [
          {
            key: 'edit',
            label: 'Editar compra',
            icon: 'pencil' as const,
            onSelect: () => router.push(`/purchases/${purchase.id}/edit` as Href),
          },
        ]
      : []),
    ...(canCancel
      ? [
          {
            key: 'cancel',
            label: 'Anular compra',
            icon: 'ban' as const,
            destructive: true,
            onSelect: () => {
              setCancelOpen(true);
              setCancelReason('');
              setCancelError('');
            },
          },
        ]
      : []),
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <ThemedText type="heading" style={styles.title}>
              {purchaseTitle(purchase.id, purchase.reference)}
            </ThemedText>
            <StatusBadge
              label={purchaseStatusLabel(purchase.status)}
              tone={purchaseStatusTone(purchase.status)}
            />
          </View>
          {menuItems.length > 0 ? <ActionMenu items={menuItems} /> : null}
        </View>
      </View>

      <Card density="compact">
        <DetailRow label="Proveedor" value={purchase.suppliers?.name ?? 'Sin proveedor'} />
        <DetailRow
          label="Fecha"
          value={`${formatPurchaseDateTime(purchase.purchased_at)}${
            purchase.branches?.name ? ` · ${purchase.branches.name}` : ''
          }`}
        />
        {purchase.profiles?.full_name ? (
          <DetailRow label="Usuario" value={purchase.profiles.full_name} />
        ) : null}
        {purchase.reference ? <DetailRow label="Documento" value={purchase.reference} /> : null}
        {purchase.notes ? <DetailRow label="Notas" value={purchase.notes} /> : null}
        <View style={styles.totalBlock}>
          <ThemedText type="small" themeColor="textMuted">
            Total
          </ThemedText>
          <ThemedText type="section">{formatMoneyCOP(purchase.total)}</ThemedText>
        </View>
      </Card>

      {canEdit ? (
        <View style={styles.primaryActions}>
          <AppButton
            title="Editar compra"
            icon="pencil"
            style={styles.flex}
            onPress={() => router.push(`/purchases/${purchase.id}/edit` as Href)}
          />
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">Productos</ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          {purchase.purchase_items.length}
        </ThemedText>
      </View>
      <View style={styles.lines}>
        {purchase.purchase_items.map((item) => (
          <PurchaseLineItem
            key={item.id}
            name={item.products?.name ?? 'Producto'}
            sku={item.products?.sku}
            brand={item.products?.brand}
            color={item.products?.color}
            size={item.products?.size}
            quantity={item.quantity}
            unitCost={item.unit_cost}
          />
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">Historial</ThemedText>
      </View>
      {audit.length === 0 ? (
        <Card density="compact">
          <ThemedText type="small" themeColor="textSecondary">
            Sin eventos de auditoría todavía.
          </ThemedText>
        </Card>
      ) : (
        <View style={styles.auditList}>
          {audit.map((event) => (
            <Card key={event.id} density="compact">
              <View style={styles.auditTop}>
                <ThemedText type="smallBold" style={styles.flex} numberOfLines={2}>
                  {event.summary}
                </ThemedText>
                <ThemedText type="small" themeColor="textMuted">
                  {formatPurchaseDateTime(event.created_at)}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {event.profiles?.full_name ?? 'Usuario'}
              </ThemedText>
              {event.reason ? (
                <ThemedText type="small" themeColor="textMuted">
                  Motivo: {event.reason}
                </ThemedText>
              ) : null}
            </Card>
          ))}
        </View>
      )}

      {message ? <ThemedText themeColor="success">{message}</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      <AppButton title="Volver" variant="ghost" onPress={() => router.back()} />

      <CancelPurchaseDialog
        visible={cancelOpen}
        loading={cancelling}
        purchaseId={purchase.id}
        reference={purchase.reference}
        supplierName={purchase.suppliers?.name}
        purchasedAt={purchase.purchased_at}
        total={purchase.total}
        productCount={purchase.purchase_items.length}
        reason={cancelReason}
        onChangeReason={setCancelReason}
        error={cancelError}
        onCancel={() => {
          setCancelOpen(false);
          setCancelReason('');
          setCancelError('');
        }}
        onConfirm={() => void onCancel()}
      />
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="small" themeColor="textMuted">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Density.compact.headerGap },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: Spacing.two,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  totalBlock: {
    marginTop: Spacing.one,
    gap: 2,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  lines: {
    gap: Spacing.two,
  },
  auditList: {
    gap: Spacing.two,
  },
  auditTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  detailRow: {
    gap: 2,
  },
});
