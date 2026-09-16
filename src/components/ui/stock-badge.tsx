import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { computeStockLevel, type StockLevel } from '@/utils/stock';

export type { StockLevel };

type StockBadgeProps = {
  quantity?: number | null;
  /** Prefer product.min_stock (via resolveMinStock). */
  minStock?: number | null;
  /**
   * @deprecated Use minStock. Kept for call-site migration.
   */
  lowThreshold?: number;
};

export function stockLevelFromQty(
  quantity?: number | null,
  minStockOrThreshold: number | null | undefined = 0,
): StockLevel {
  return computeStockLevel(quantity, minStockOrThreshold);
}

/** Discrete stock chip — readable in light and dark without loud fills. */
export function StockBadge({ quantity, minStock, lowThreshold }: StockBadgeProps) {
  const theme = useTheme();
  const threshold = minStock ?? lowThreshold ?? 0;
  const level = computeStockLevel(quantity, threshold);

  if (level === 'unknown') {
    return (
      <ThemedText type="small" themeColor="textMuted">
        —
      </ThemedText>
    );
  }

  const label =
    level === 'out' ? 'Sin stock' : level === 'low' ? 'Stock bajo' : `${quantity} uds`;
  const color =
    level === 'ok' ? theme.success : level === 'low' ? theme.warning : theme.destructive;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: withAlpha(color, 0.12),
          borderColor: withAlpha(color, 0.22),
        },
      ]}>
      <ThemedText type="smallBold" style={{ color, fontSize: 12, lineHeight: 16 }}>
        {label}
      </ThemedText>
    </View>
  );
}

function withAlpha(hex: string, alpha: number) {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderWidth: 1,
  },
});
