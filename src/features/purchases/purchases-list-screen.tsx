import { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { MinTouchTarget, Radii, Spacing } from '@/constants/theme';
import { CancelPurchaseDialog } from '@/features/purchases/cancel-purchase-dialog';
import {
  formatMoneyCOP,
  formatPurchaseDate,
  purchaseStatusLabel,
  purchaseStatusTone,
  purchaseTitle,
} from '@/features/purchases/purchase-format';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { cancelPurchase, listPurchases } from '@/services/backend';
import type { PurchaseWithRelations } from '@/types/catalog';

const DESKTOP_BREAKPOINT = 900;

export function PurchasesListScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { hasPermission } = useWorkspace();
  const [rows, setRows] = useState<PurchaseWithRelations[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<PurchaseWithRelations | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listPurchases());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar compras.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function confirmCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelError('Indica el motivo de anulación.');
      return;
    }
    setCancelling(true);
    setCancelError('');
    setError('');
    try {
      await cancelPurchase(cancelTarget.id, cancelReason.trim());
      setMessage('Compra anulada correctamente.');
      setCancelTarget(null);
      setCancelReason('');
      await load();
    } catch (caught) {
      setCancelError(caught instanceof Error ? caught.message : 'No se pudo anular.');
    } finally {
      setCancelling(false);
    }
  }

  function openPurchase(id: string) {
    router.push(`/purchases/${id}` as Href);
  }

  function editPurchase(id: string) {
    router.push(`/purchases/${id}/edit` as Href);
  }

  function menuItems(purchase: PurchaseWithRelations): ActionMenuItem[] {
    const items: ActionMenuItem[] = [
      {
        key: 'view',
        label: 'Ver detalle',
        icon: 'eye',
        onSelect: () => openPurchase(purchase.id),
      },
    ];

    if (hasPermission('purchases.update') && purchase.status !== 'cancelled') {
      items.push({
        key: 'edit',
        label: 'Editar compra',
        icon: 'pencil',
        onSelect: () => editPurchase(purchase.id),
      });
    }

    items.push({
      key: 'history',
      label: 'Ver historial',
      icon: 'history',
      onSelect: () => openPurchase(purchase.id),
    });

    if (
      (hasPermission('purchases.delete') || hasPermission('purchases.update')) &&
      purchase.status !== 'cancelled'
    ) {
      items.push({
        key: 'cancel',
        label: 'Anular compra',
        icon: 'ban',
        destructive: true,
        onSelect: () => {
          setCancelTarget(purchase);
          setCancelReason('');
          setCancelError('');
        },
      });
    }

    return items;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="heading">Compras</ThemedText>
          <ThemedText themeColor="textSecondary">
            Registra costos por lote y mantén el inventario al día.
          </ThemedText>
        </View>
        {hasPermission('purchases.create') ? (
          <AppButton
            title="Nueva compra"
            icon="plus"
            onPress={() => router.push('/purchases/new' as Href)}
            style={isDesktop ? styles.headerCta : undefined}
          />
        ) : null}
      </View>

      {loading ? <ThemedText themeColor="textSecondary">Cargando compras…</ThemedText> : null}
      {message ? <ThemedText themeColor="success">{message}</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon="package"
          title="Todavía no hay compras"
          description="Registra la primera compra para crear lotes de inventario."
          action={
            hasPermission('purchases.create') ? (
              <AppButton
                title="Nueva compra"
                icon="plus"
                onPress={() => router.push('/purchases/new' as Href)}
              />
            ) : undefined
          }
        />
      ) : null}

      {!loading && rows.length > 0 && isDesktop ? (
        <Card style={styles.tableCard}>
          <View style={[styles.tableHeader, { borderBottomColor: theme.border }]}>
            <ThemedText type="smallBold" style={styles.colCode}>
              Número
            </ThemedText>
            <ThemedText type="smallBold" style={styles.colSupplier}>
              Proveedor
            </ThemedText>
            <ThemedText type="smallBold" style={styles.colDate}>
              Fecha
            </ThemedText>
            <ThemedText type="smallBold" style={styles.colQty}>
              Productos
            </ThemedText>
            <ThemedText type="smallBold" style={styles.colTotal}>
              Total
            </ThemedText>
            <ThemedText type="smallBold" style={styles.colStatus}>
              Estado
            </ThemedText>
            <ThemedText type="smallBold" style={styles.colUser}>
              Usuario
            </ThemedText>
            <ThemedText type="smallBold" style={styles.colActions}>
              Acciones
            </ThemedText>
          </View>
          {rows.map((purchase) => (
            <DesktopRow
              key={purchase.id}
              purchase={purchase}
              borderColor={theme.border}
              onView={() => openPurchase(purchase.id)}
              onEdit={
                hasPermission('purchases.update') && purchase.status !== 'cancelled'
                  ? () => editPurchase(purchase.id)
                  : undefined
              }
              menuItems={menuItems(purchase)}
            />
          ))}
        </Card>
      ) : null}

      {!loading && !isDesktop
        ? rows.map((purchase) => (
            <PurchaseMobileCard
              key={purchase.id}
              purchase={purchase}
              onView={() => openPurchase(purchase.id)}
              menuItems={menuItems(purchase)}
            />
          ))
        : null}

      {cancelTarget ? (
        <CancelPurchaseDialog
          visible
          loading={cancelling}
          purchaseId={cancelTarget.id}
          reference={cancelTarget.reference}
          supplierName={cancelTarget.suppliers?.name}
          purchasedAt={cancelTarget.purchased_at}
          total={cancelTarget.total}
          productCount={cancelTarget.purchase_items.length}
          reason={cancelReason}
          onChangeReason={setCancelReason}
          error={cancelError}
          onCancel={() => {
            setCancelTarget(null);
            setCancelReason('');
            setCancelError('');
          }}
          onConfirm={() => void confirmCancel()}
        />
      ) : null}
    </Screen>
  );
}

function PurchaseMobileCard({
  purchase,
  onView,
  menuItems,
}: {
  purchase: PurchaseWithRelations;
  onView: () => void;
  menuItems: ActionMenuItem[];
}) {
  const theme = useTheme();
  const cancelled = purchase.status === 'cancelled';
  const units = purchase.purchase_items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver ${purchaseTitle(purchase.id, purchase.reference)}`}
      onPress={onView}
      style={({ pressed }) => [
        styles.mobilePress,
        {
          borderColor: theme.border,
          backgroundColor: pressed ? theme.backgroundSelected : theme.surface,
          opacity: cancelled ? 0.72 : 1,
        },
      ]}>
      <View style={styles.mobileTop}>
        <ThemedText
          type="smallBold"
          style={[styles.flex, cancelled && styles.strike]}
          numberOfLines={1}>
          {purchaseTitle(purchase.id, purchase.reference)}
        </ThemedText>
        <ActionMenu items={menuItems} />
      </View>

      <ThemedText type="smallBold" numberOfLines={1}>
        {purchase.suppliers?.name ?? 'Sin proveedor'}
      </ThemedText>

      <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
        {formatPurchaseDate(purchase.purchased_at)} · {purchase.purchase_items.length}{' '}
        {purchase.purchase_items.length === 1 ? 'producto' : 'productos'}
        {units > 0 ? ` · ${units} uds` : ''}
      </ThemedText>

      <View style={styles.mobileBottom}>
        <ThemedText type="smallBold" style={cancelled ? styles.strike : undefined}>
          {formatMoneyCOP(purchase.total)}
        </ThemedText>
        <StatusBadge
          label={purchaseStatusLabel(purchase.status)}
          tone={purchaseStatusTone(purchase.status)}
        />
      </View>
    </Pressable>
  );
}

function DesktopRow({
  purchase,
  borderColor,
  onView,
  onEdit,
  menuItems,
}: {
  purchase: PurchaseWithRelations;
  borderColor: string;
  onView: () => void;
  onEdit?: () => void;
  menuItems: ActionMenuItem[];
}) {
  const theme = useTheme();

  return (
    <View style={[styles.tableRow, { borderBottomColor: borderColor }]}>
      <ThemedText type="small" style={styles.colCode}>
        #{purchase.reference?.trim() || purchase.id.replace(/-/g, '').slice(-6).toUpperCase()}
      </ThemedText>
      <ThemedText type="small" style={styles.colSupplier} numberOfLines={1}>
        {purchase.suppliers?.name ?? 'Sin proveedor'}
      </ThemedText>
      <ThemedText type="small" style={styles.colDate}>
        {formatPurchaseDate(purchase.purchased_at)}
      </ThemedText>
      <ThemedText type="small" style={styles.colQty}>
        {purchase.purchase_items.length}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.colTotal}>
        {formatMoneyCOP(purchase.total)}
      </ThemedText>
      <View style={styles.colStatus}>
        <StatusBadge
          label={purchaseStatusLabel(purchase.status)}
          tone={purchaseStatusTone(purchase.status)}
        />
      </View>
      <ThemedText type="small" style={styles.colUser} numberOfLines={1}>
        {purchase.profiles?.full_name ?? '—'}
      </ThemedText>
      <View style={styles.colActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver compra"
          onPress={onView}
          style={({ pressed }) => [
            styles.inlineAction,
            {
              backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
          {...({ title: 'Ver compra' } as object)}>
          <ThemedText type="smallBold">Ver</ThemedText>
        </Pressable>
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Editar compra"
            onPress={onEdit}
            style={({ pressed }) => [
              styles.inlineAction,
              {
                backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}
            {...({ title: 'Editar compra' } as object)}>
            <ThemedText type="smallBold">Editar</ThemedText>
          </Pressable>
        ) : null}
        <ActionMenu items={menuItems} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  headerText: {
    gap: Spacing.one,
  },
  headerCta: {
    alignSelf: 'flex-start',
    minWidth: 160,
  },
  mobilePress: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: 4,
  },
  mobileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  mobileBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: 2,
  },
  flex: { flex: 1 },
  strike: {
    textDecorationLine: 'line-through',
  },
  tableCard: {
    padding: 0,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    minHeight: MinTouchTarget,
  },
  colCode: { width: 88 },
  colSupplier: { flex: 1.4, minWidth: 120 },
  colDate: { width: 100 },
  colQty: { width: 72, textAlign: 'center' },
  colTotal: { width: 110 },
  colStatus: { width: 110 },
  colUser: { width: 120 },
  colActions: {
    width: 168,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  inlineAction: {
    minHeight: 36,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
