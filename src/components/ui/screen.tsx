import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { KeyboardSafeScrollView } from '@/components/ui/keyboard-safe-scroll-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Keep focused inputs reachable without over-shifting the whole screen. Default true. */
  keyboardAware?: boolean;
}>;

/**
 * App screen shell.
 *
 * Keyboard strategy (global):
 * - Never use KeyboardAvoidingView padding (it lifts the entire form too far).
 * - Scroll screens use KeyboardSafeScrollView (iOS insets / Android resize).
 * - Modals/sheets use KeyboardSafeModal (overlap-based lift).
 */
export function Screen({
  children,
  scroll = true,
  contentStyle,
  keyboardAware = true,
}: ScreenProps) {
  const body = (
    <View style={[styles.inner, !scroll && styles.innerFill, contentStyle]}>{children}</View>
  );

  const content = scroll ? (
    <KeyboardSafeScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardAware={keyboardAware}
      bottomPadding={BottomTabInset + Spacing.three}>
      {body}
    </KeyboardSafeScrollView>
  ) : (
    <View style={styles.fill}>{body}</View>
  );

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {content}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  fill: {
    flex: 1,
    alignItems: 'center',
  },
  scrollContent: {
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  innerFill: {
    flex: 1,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
