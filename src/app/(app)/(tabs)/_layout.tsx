import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';

export default function TabsLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { canAccessAdmin, hasPermission, hasFeature } = useWorkspace();

  const showSales = hasPermission('sales.view') || hasPermission('sales.create');
  const showProducts = hasPermission('products.view') && hasFeature('products');

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{ selected: { color: colors.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="home" sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger hidden={!showSales} name="sales">
        <NativeTabs.Trigger.Label>Ventas</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="point_of_sale"
          sf={{ default: 'cart', selected: 'cart.fill' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger hidden={!showProducts} name="products">
        <NativeTabs.Trigger.Label>Productos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="checkroom"
          sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger hidden={!canAccessAdmin} name="admin">
        <NativeTabs.Trigger.Label>Admin</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          md="settings"
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="person" sf={{ default: 'person', selected: 'person.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
