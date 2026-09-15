import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Density, Radii, type DensityName } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** compact for list items; comfortable (default) for forms/detail; spacious for hero blocks */
  density?: DensityName;
  onPress?: never;
}>;

export function Card({ children, style, density = 'comfortable' }: CardProps) {
  const theme = useTheme();
  const tokens = Density[density];

  return (
    <ThemedView
      type="surface"
      style={[
        styles.card,
        {
          borderColor: theme.border,
          padding: tokens.cardPadding,
          borderRadius: density === 'compact' ? Radii.md : Radii.lg,
        },
        style,
      ]}>
      <View style={[styles.body, { gap: tokens.gap + (density === 'compact' ? 2 : 4) }]}>
        {children}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: {},
});
