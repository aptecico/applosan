import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StatusBadgeProps = {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
};

/** Soft professional badge — tinted background, not solid loud colors. */
export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  const theme = useTheme();

  const palette = {
    neutral: {
      backgroundColor: theme.backgroundElement,
      color: theme.textSecondary,
      borderColor: theme.border,
    },
    success: {
      backgroundColor: withAlpha(theme.success, 0.12),
      color: theme.success,
      borderColor: withAlpha(theme.success, 0.25),
    },
    warning: {
      backgroundColor: withAlpha(theme.warning, 0.14),
      color: theme.warning,
      borderColor: withAlpha(theme.warning, 0.28),
    },
    danger: {
      backgroundColor: withAlpha(theme.destructive, 0.12),
      color: theme.destructive,
      borderColor: withAlpha(theme.destructive, 0.25),
    },
  }[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: palette.color }}>
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
