import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Density, MinTouchTarget, type DensityName } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListRowProps = {
  density?: DensityName;
  onPress?: () => void;
  disabled?: boolean;
  leading?: ReactNode;
  /** Primary content (title + secondary lines). */
  children: ReactNode;
  /** Trailing meta / actions (price, badge, button). */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  bordered?: boolean;
};

/**
 * Compact scan-friendly list row for catalogs and transaction lists.
 * Default density is compact (~56px) to show more rows on mobile.
 */
export function ListRow({
  density = 'compact',
  onPress,
  disabled,
  leading,
  children,
  trailing,
  style,
  accessibilityLabel,
  bordered = true,
}: ListRowProps) {
  const theme = useTheme();
  const tokens = Density[density];

  const content = (
    <View
      style={[
        styles.row,
        {
          minHeight: Math.max(tokens.listItemMinHeight, onPress ? MinTouchTarget : tokens.listItemMinHeight),
          paddingVertical: tokens.rowPaddingY,
          paddingHorizontal: tokens.rowPaddingX,
          gap: tokens.gap + 4,
          borderBottomColor: bordered ? theme.border : 'transparent',
          borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0,
          backgroundColor: 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>{children}</View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  leading: {
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trailing: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
});
