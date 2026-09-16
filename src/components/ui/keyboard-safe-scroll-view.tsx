import type { PropsWithChildren, Ref } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset';
import { BottomTabInset, Spacing } from '@/constants/theme';

type Props = PropsWithChildren<
  Omit<ScrollViewProps, 'contentContainerStyle'> & {
    contentContainerStyle?: StyleProp<ViewStyle>;
    /** Extra bottom padding beyond keyboard / tab inset. */
    bottomPadding?: number;
    /** When false, do not react to keyboard. Default true. */
    keyboardAware?: boolean;
    scrollRef?: Ref<ScrollView>;
  }
>;

/**
 * Global scroll pattern for forms and long screens.
 *
 * - Does NOT wrap the tree in KeyboardAvoidingView (that over-shifts the whole UI).
 * - iOS: `automaticallyAdjustKeyboardInsets` keeps the focused field visible.
 * - Android: window already resizes (`softwareKeyboardLayoutMode: "resize"`);
 *   we only add a small comfort inset when overlap is reported.
 * - Desktop/web: no keyboard inset.
 */
export function KeyboardSafeScrollView({
  children,
  contentContainerStyle,
  bottomPadding = BottomTabInset + Spacing.three,
  keyboardAware = true,
  scrollRef,
  keyboardShouldPersistTaps = 'handled',
  keyboardDismissMode = 'on-drag',
  ...rest
}: Props) {
  const keyboardInset = useKeyboardBottomInset(keyboardAware);
  // With Android resize, overlap is usually 0; keep a tiny comfort pad only if reported.
  const androidPad = Platform.OS === 'android' ? Math.min(keyboardInset, 24) : 0;
  const extraPad = Platform.OS === 'ios' ? 0 : androidPad;

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode}
      automaticallyAdjustKeyboardInsets={keyboardAware && Platform.OS === 'ios'}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomPadding + extraPad },
        contentContainerStyle,
      ]}
      {...rest}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
});
