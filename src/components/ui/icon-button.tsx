import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { MinTouchTarget, Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ThemeColor } from '@/constants/theme';

type IconButtonProps = Omit<PressableProps, 'children'> & {
  icon: AppIconName;
  /** Visible label for screen readers and web tooltip (`title`). */
  label: string;
  size?: number;
  tone?: ThemeColor;
  variant?: 'ghost' | 'soft' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  label,
  size = 20,
  tone,
  variant = 'ghost',
  disabled,
  style,
  ...rest
}: IconButtonProps) {
  const theme = useTheme();
  const iconColor =
    tone ??
    (variant === 'danger' ? 'destructive' : 'text');

  const backgroundColor =
    variant === 'soft'
      ? theme.backgroundElement
      : variant === 'danger'
        ? 'transparent'
        : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      // Web tooltip
      {...({ title: label } as object)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: variant === 'soft' ? theme.border : 'transparent',
          borderWidth: variant === 'soft' ? 1 : 0,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
        style,
      ]}
      {...rest}>
      <AppIcon name={icon} size={size} themeColor={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
