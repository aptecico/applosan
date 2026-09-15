import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MinTouchTarget, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AppTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
  keyboardType?: KeyboardTypeOptions;
};

export function AppTextField({
  label,
  error,
  helperText,
  isPassword = false,
  keyboardType,
  editable = true,
  ...rest
}: AppTextFieldProps) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const inputId = label;

  return (
    <View style={styles.wrapper}>
      <ThemedText type="smallBold" nativeID={`${inputId}-label`}>
        {label}
      </ThemedText>
      <ThemedView
        type="surface"
        style={[
          styles.field,
          { borderColor: error ? theme.destructive : theme.border },
          !editable && styles.readonly,
        ]}>
        <TextInput
          {...rest}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${inputId}-label`}
          accessibilityState={{ disabled: !editable }}
          autoCapitalize={
            isPassword || keyboardType === 'email-address' ? 'none' : rest.autoCapitalize
          }
          autoCorrect={!isPassword}
          editable={editable}
          keyboardType={keyboardType}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={isPassword && !visible}
          style={[styles.input, { color: theme.text }]}
        />
        {isPassword ? (
          <Pressable
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setVisible((value) => !value)}
            style={styles.toggle}>
            <ThemedText type="smallBold" themeColor="accent">
              {visible ? 'Ocultar' : 'Ver'}
            </ThemedText>
          </Pressable>
        ) : null}
      </ThemedView>
      {error ? (
        <ThemedText type="small" themeColor="destructive" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : helperText ? (
        <ThemedText type="small" themeColor="textSecondary">
          {helperText}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
  },
  field: {
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
  },
  readonly: {
    opacity: 0.7,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: Spacing.two,
  },
  toggle: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingLeft: Spacing.two,
  },
});
