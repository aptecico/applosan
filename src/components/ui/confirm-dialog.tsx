import { useEffect, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const theme = useTheme();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <Pressable
        style={[
          styles.backdrop,
          {
            backgroundColor: theme.overlay,
            paddingBottom: Platform.OS === 'ios' ? keyboardHeight + Spacing.three : Spacing.four,
            justifyContent: keyboardHeight > 0 ? 'flex-end' : 'center',
          },
        ]}
        onPress={loading ? undefined : onCancel}>
        <Pressable
          style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          onPress={(event) => event.stopPropagation()}>
          <ThemedText type="section">{title}</ThemedText>
          {message ? <ThemedText themeColor="textSecondary">{message}</ThemedText> : null}
          {children ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.childrenScroll}
              contentContainerStyle={styles.childrenContent}>
              {children}
            </ScrollView>
          ) : null}
          <View style={styles.actions}>
            <AppButton
              title={cancelLabel}
              variant="ghost"
              disabled={loading}
              onPress={onCancel}
              style={styles.flex}
            />
            <AppButton
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              loading={loading}
              onPress={onConfirm}
              style={styles.flex}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    padding: Spacing.four,
  },
  card: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    maxHeight: '92%',
  },
  childrenScroll: {
    maxHeight: 320,
  },
  childrenContent: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
