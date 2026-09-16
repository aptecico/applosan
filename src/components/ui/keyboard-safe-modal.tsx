import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset';
import { useTheme } from '@/hooks/use-theme';

type Placement = 'bottom' | 'center';

type KeyboardSafeModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** bottom = sheet (default); center = dialog */
  placement?: Placement;
  /** Fraction of window height when keyboard is closed. */
  maxHeightRatio?: number;
  /** Extra gap between sheet and keyboard / screen edge. */
  edgeGap?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Close when pressing the dimmed backdrop. Default true. */
  closeOnBackdrop?: boolean;
};

/**
 * System-wide modal that stays usable with the virtual keyboard.
 *
 * - Pins content above the keyboard using measured overlap (no double-shift).
 * - Sheet height shrinks so header/search stay visible; list area absorbs space loss.
 */
export function KeyboardSafeModal({
  visible,
  onClose,
  children,
  placement = 'bottom',
  maxHeightRatio = 0.9,
  edgeGap = Spacing.two,
  contentStyle,
  closeOnBackdrop = true,
}: KeyboardSafeModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width } = useWindowDimensions();
  const keyboardInset = useKeyboardBottomInset(visible);
  const isDesktop = width >= 768;

  const topGuard = Math.max(insets.top, Spacing.three);
  const bottomSafe = Math.max(insets.bottom, edgeGap);

  // Only lift by real overlap — 0 when the window already resized for the keyboard.
  const lift = keyboardInset;

  const maxSheetHeight = Math.max(
    240,
    Math.min(
      windowHeight * maxHeightRatio,
      windowHeight - topGuard - lift - bottomSafe,
    ),
  );

  const isBottom = placement === 'bottom' && !isDesktop;

  return (
    <Modal
      animationType={isBottom ? 'slide' : 'fade'}
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: theme.overlay,
            justifyContent: isBottom ? 'flex-end' : 'center',
            // Lift the sheet above the keyboard once — do not also subtract lift twice.
            paddingBottom: isBottom ? lift + bottomSafe : lift > 0 ? lift + edgeGap : Spacing.four,
            paddingTop: isBottom ? topGuard : Spacing.four,
            paddingHorizontal: isBottom ? 0 : Spacing.four,
          },
        ]}>
        {closeOnBackdrop ? (
          <Pressable
            accessibilityLabel="Cerrar"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        <View
          style={[
            isBottom ? styles.sheet : styles.dialog,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              maxHeight: maxSheetHeight,
              // Fill available space when bottom sheet so FlatList can flex.
              height: isBottom ? maxSheetHeight : undefined,
              width: isDesktop ? Math.min(520, width - Spacing.four * 2) : '100%',
              alignSelf: 'center',
            },
            contentStyle,
          ]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 2,
  },
  dialog: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 2,
    maxWidth: 520,
  },
});
