import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { Density, Radii } from '@/constants/theme';
import { formatMoneyCOP, productMetaLine } from '@/features/purchases/purchase-format';
import { useTheme } from '@/hooks/use-theme';

type PurchaseLineItemProps = {
  name: string;
  sku?: string | null;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
  quantity: number;
  unitCost: number;
  onEdit?: () => void;
  onRemove?: () => void;
};

/** Compact purchase line — scannable in form and detail. */
export function PurchaseLineItem({
  name,
  sku,
  brand,
  color,
  size,
  quantity,
  unitCost,
  onEdit,
  onRemove,
}: PurchaseLineItemProps) {
  const theme = useTheme();
  const meta = productMetaLine({ sku, brand, color, size });
  const subtotal = quantity * unitCost;
  const d = Density.compact;

  const menuItems: ActionMenuItem[] = [
    ...(onEdit
      ? [{ key: 'edit', label: 'Editar', icon: 'pencil' as const, onSelect: onEdit }]
      : []),
    ...(onRemove
      ? [
          {
            key: 'remove',
            label: 'Eliminar',
            icon: 'trash' as const,
            destructive: true,
            onSelect: onRemove,
          },
        ]
      : []),
  ];

  return (
    <View
      style={[
        styles.row,
        {
          borderColor: theme.border,
          backgroundColor: theme.backgroundElement,
          paddingVertical: d.rowPaddingY,
          paddingHorizontal: d.rowPaddingX,
          gap: d.gap,
        },
      ]}>
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
            {name}
          </ThemedText>
          {menuItems.length > 0 ? <ActionMenu items={menuItems} label="Acciones del producto" /> : null}
        </View>
        {meta ? (
          <ThemedText type="small" themeColor="textMuted" numberOfLines={1} style={styles.meta}>
            {meta}
          </ThemedText>
        ) : null}
        <View style={styles.amounts}>
          <ThemedText type="small" themeColor="textSecondary">
            {quantity} × {formatMoneyCOP(unitCost)}
          </ThemedText>
          <ThemedText type="smallBold">{formatMoneyCOP(subtotal)}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.sm,
  },
  main: {
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flex: { flex: 1 },
  meta: {
    fontSize: 12,
    lineHeight: 16,
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
});
