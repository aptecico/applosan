import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function TabsWebLayout() {
  const { canAccessAdmin, hasPermission, hasFeature } = useWorkspace();
  const showSales = hasPermission('sales.view') || hasPermission('sales.create');
  const showProducts = hasPermission('products.view') && hasFeature('products');

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Inicio</TabButton>
          </TabTrigger>
          {showSales ? (
            <TabTrigger name="sales" href={'/sales' as Href} asChild>
              <TabButton>Ventas</TabButton>
            </TabTrigger>
          ) : null}
          {showProducts ? (
            <TabTrigger name="products" href={'/products' as Href} asChild>
              <TabButton>Productos</TabButton>
            </TabTrigger>
          ) : null}
          {canAccessAdmin ? (
            <TabTrigger name="admin" href={'/admin' as Href} asChild>
              <TabButton>Admin</TabButton>
            </TabTrigger>
          ) : null}
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>Perfil</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View {...props} style={[styles.tabListContainer, { borderTopColor: colors.border }]}>
      <ThemedView type="surface" style={styles.innerContainer}>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    bottom: 0,
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    minHeight: 44,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    justifyContent: 'center',
  },
});
