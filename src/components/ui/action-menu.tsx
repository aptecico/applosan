import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { IconButton } from '@/components/ui/icon-button';
import { MinTouchTarget, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ActionMenuItem = {
  key: string;
  label: string;
  icon?: AppIconName;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  /** Optional custom trigger; defaults to more-vertical icon button. */
  trigger?: ReactNode;
  label?: string;
};

export function ActionMenu({ items, trigger, label = 'Más acciones' }: ActionMenuProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const visibleItems = items.filter(Boolean);
  if (visibleItems.length === 0) return null;

  const normal = visibleItems.filter((item) => !item.destructive);
  const destructive = visibleItems.filter((item) => item.destructive);

  function run(item: ActionMenuItem) {
    setOpen(false);
    item.onSelect();
  }

  return (
    <>
      {trigger ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => setOpen(true)}
          {...({ title: label } as object)}>
          {trigger}
        </Pressable>
      ) : (
        <IconButton icon="moreVertical" label={label} onPress={() => setOpen(true)} />
      )}

      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.overlay }]}
          onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            ]}
            onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">{label}</ThemedText>
              <IconButton icon="close" label="Cerrar" onPress={() => setOpen(false)} />
            </View>

            {normal.map((item) => (
              <MenuRow key={item.key} item={item} onPress={() => run(item)} />
            ))}

            {destructive.length > 0 && normal.length > 0 ? (
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
            ) : null}

            {destructive.map((item) => (
              <MenuRow key={item.key} item={item} onPress={() => run(item)} />
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuRow({ item, onPress }: { item: ActionMenuItem; onPress: () => void }) {
  const theme = useTheme();
  const color = item.destructive ? theme.destructive : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ disabled: Boolean(item.disabled) }}
      disabled={item.disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
          opacity: item.disabled ? 0.45 : 1,
        },
      ]}>
      {item.icon ? <AppIcon name={item.icon} size={18} color={color} /> : null}
      <ThemedText
        type="small"
        style={{ color, flex: 1 }}
        themeColor={item.destructive ? 'destructive' : 'text'}>
        {item.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    borderWidth: 1,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.two,
    gap: Spacing.half,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
    marginHorizontal: Spacing.two,
  },
  row: {
    minHeight: MinTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.md,
  },
});
