import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type StockLevel = 'ok' | 'low' | 'out' | 'unknown';

type StockBadgeProps = {
  quantity?: number | null;
  /** Units at or below this count as low stock. */
  lowThreshold?: number;
};

export function stockLevelFromQty(
  quantity?: number | null,
  lowThreshold = 5,
): StockLevel {
  if (quantity == null || Number.isNaN(quantity)) return 'unknown';
  if (quantity <= 0) return 'out';
  if (quantity <= lowThreshold) return 'low';
  return 'ok';
}

/** Discrete stock chip — readable in light and dark without loud fills. */
export function StockBadge({ quantity, lowThreshold = 5 }: StockBadgeProps) {
  const theme = useTheme();
  const level = stockLevelFromQty(quantity, lowThreshold);

  if (level === 'unknown') {
    return (
      <ThemedText type="small" themeColor="textMuted">
        —
      </ThemedText>
    );
  }

  const label = level === 'out' ? 'Sin stock' : `${quantity} uds`;
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
