import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { MinTouchTarget, Radii, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type AppButtonProps = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: ButtonVariant;
  icon?: AppIconName;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  title,
  loading = false,
  variant = 'primary',
  icon,
  disabled,
  style,
  ...rest
}: AppButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor = {
    primary: theme.accent,
    secondary: theme.backgroundElement,
    danger: theme.destructive,
    ghost: 'transparent',
  }[variant];

  const labelColors: Record<ButtonVariant, ThemeColor> = {
    primary: 'onAccent',
    secondary: 'text',
    danger: 'onDestructive',
    ghost: 'text',
  };
  const textColor = labelColors[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor: variant === 'ghost' ? theme.border : 'transparent' },
        variant === 'ghost' && styles.ghost,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={theme[textColor]} />
      ) : (
        <View style={styles.content}>
          {icon ? <AppIcon name={icon} size={18} themeColor={textColor} /> : null}
          <ThemedText type="smallBold" themeColor={textColor}>
            {title}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MinTouchTarget,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  ghost: {
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
