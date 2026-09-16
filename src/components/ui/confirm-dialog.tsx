import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { KeyboardSafeModal } from '@/components/ui/keyboard-safe-modal';
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

  return (
    <KeyboardSafeModal
      visible={visible}
      onClose={loading ? () => undefined : onCancel}
      placement="center"
      maxHeightRatio={0.9}
      closeOnBackdrop={!loading}
      contentStyle={styles.dialogReset}>
      <Pressable
        style={[styles.card, { backgroundColor: theme.surfaceElevated }]}
        onPress={(event) => event.stopPropagation()}>
        <ThemedText type="section">{title}</ThemedText>
        {message ? <ThemedText themeColor="textSecondary">{message}</ThemedText> : null}
        {children ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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
    </KeyboardSafeModal>
  );
}

const styles = StyleSheet.create({
  dialogReset: {
    // KeyboardSafeModal already paints surface; keep inner padding only.
    backgroundColor: 'transparent',
    borderWidth: 0,
    overflow: 'visible',
  },
  card: {
    borderRadius: Radii.lg,
    padding: Spacing.four,
    gap: Spacing.three,
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
