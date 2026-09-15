import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppTextField } from '@/components/ui/app-text-field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spacing } from '@/constants/theme';
import {
  formatMoneyCOP,
  formatPurchaseDate,
  purchaseTitle,
} from '@/features/purchases/purchase-format';

type CancelPurchaseDialogProps = {
  visible: boolean;
  loading?: boolean;
  purchaseId: string;
  reference?: string | null;
  supplierName?: string | null;
  purchasedAt: string;
  total: number;
  productCount: number;
  reason: string;
  onChangeReason: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  error?: string;
};

export function CancelPurchaseDialog({
  visible,
  loading = false,
  purchaseId,
  reference,
  supplierName,
  purchasedAt,
  total,
  productCount,
  reason,
  onChangeReason,
  onCancel,
  onConfirm,
  error,
}: CancelPurchaseDialogProps) {
  return (
    <ConfirmDialog
      visible={visible}
      title="Anular compra"
      message="¿Está seguro de que desea anular esta compra?"
      destructive
      loading={loading}
      confirmLabel={loading ? 'Anulando…' : 'Confirmar anulación'}
      cancelLabel="Cancelar"
      onCancel={onCancel}
      onConfirm={onConfirm}>
      <View style={styles.summary}>
        <ThemedText type="smallBold">{purchaseTitle(purchaseId, reference)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Proveedor: {supplierName ?? 'Sin proveedor'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Fecha: {formatPurchaseDate(purchasedAt)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Total: {formatMoneyCOP(total)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Productos: {productCount}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Esta acción puede afectar los movimientos de inventario asociados a la compra.
        </ThemedText>
      </View>

      <AppTextField
        label="Motivo de la anulación"
        onChangeText={onChangeReason}
        placeholder="Describe por qué se anula"
        value={reason}
      />

      {error ? (
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      ) : null}
    </ConfirmDialog>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: Spacing.one,
  },
});
