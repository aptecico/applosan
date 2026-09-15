import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { MinTouchTarget, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  step?: number;
  max?: number;
};

/**
 * Quantity control: − / editable number / +
 * Direct typing for large values; steppers for fine adjustments.
 */
export function QuantityStepper({ value, onChange, min = 1, step = 1, max }: Props) {
  const theme = useTheme();
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const canDecrease = value > min;

  useEffect(() => {
    if (!focused) {
      setText(String(value));
    }
  }, [value, focused]);

  function clamp(next: number) {
    let n = next;
    if (Number.isNaN(n)) n = min;
    n = Math.max(min, Math.floor(n));
    if (max != null) n = Math.min(max, n);
    return n;
  }

  function commitText(raw: string) {
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) {
      setText(String(min));
      onChange(min);
      return;
    }
    const next = clamp(Number(digits));
    setText(String(next));
    onChange(next);
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="Disminuir cantidad"
        accessibilityRole="button"
        disabled={!canDecrease}
        onPress={() => {
          const next = clamp(value - step);
          onChange(next);
          setText(String(next));
        }}
        style={({ pressed }) => [
          styles.btn,
          {
            borderColor: theme.border,
            backgroundColor: theme.backgroundElement,
            opacity: !canDecrease ? 0.4 : pressed ? 0.75 : 1,
          },
        ]}>
        <View style={styles.minusWrap}>
          <View style={[styles.minusBar, { backgroundColor: theme.text }]} />
        </View>
      </Pressable>

      <Pressable
        accessibilityLabel={`Cantidad ${value}. Toca para editar`}
        onPress={() => inputRef.current?.focus()}
        style={[
          styles.valueBox,
          {
            borderColor: focused ? theme.accent : theme.border,
            backgroundColor: theme.surface,
          },
        ]}>
        <TextInput
          ref={inputRef}
          accessibilityLabel="Cantidad editable"
          keyboardType="number-pad"
          selectTextOnFocus
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commitText(text);
          }}
          onChangeText={(raw) => {
            const digits = raw.replace(/[^\d]/g, '');
            setText(digits);
            if (digits) {
              const parsed = Number(digits);
              if (!Number.isNaN(parsed) && parsed >= min) {
                onChange(clamp(parsed));
              }
            }
          }}
          onSubmitEditing={() => {
            commitText(text);
            inputRef.current?.blur();
          }}
          style={[styles.input, { color: theme.text }]}
          returnKeyType="done"
        />
      </Pressable>

      <Pressable
        accessibilityLabel="Aumentar cantidad"
        accessibilityRole="button"
        onPress={() => {
          const next = clamp(value + step);
          onChange(next);
          setText(String(next));
        }}
        style={({ pressed }) => [
          styles.btn,
          {
            borderColor: theme.border,
            backgroundColor: theme.backgroundElement,
            opacity: pressed ? 0.75 : 1,
          },
        ]}>
        <AppIcon name="plus" size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  btn: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBox: {
    minWidth: 88,
    minHeight: MinTouchTarget,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  input: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: Spacing.one,
    minWidth: 64,
  },
  minusWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusBar: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
});
