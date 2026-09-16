import { Stack } from 'expo-router';

/**
 * Stack raíz del área autenticada.
 * Las pestañas viven en (tabs); proveedores/compras/inventario/etc. son pantallas push
 * para que los enlaces desde Bienvenida sí abran (NativeTabs ocultos no navegaban bien).
 */
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="dashboard"
        options={{ headerShown: true, title: 'Dashboard', presentation: 'card' }}
      />
      <Stack.Screen
        name="inventory"
        options={{ headerShown: true, title: 'Inventario', presentation: 'card' }}
      />
      <Stack.Screen
        name="customers"
        options={{ headerShown: true, title: 'Clientes', presentation: 'card' }}
      />
      <Stack.Screen
        name="reports"
        options={{ headerShown: true, title: 'Reportes', presentation: 'card' }}
      />
      <Stack.Screen name="suppliers" options={{ headerShown: false }} />
      <Stack.Screen name="purchases" options={{ headerShown: false }} />
      <Stack.Screen name="cash" options={{ headerShown: false }} />
      <Stack.Screen name="credits" options={{ headerShown: false }} />
      <Stack.Screen name="expenses" options={{ headerShown: false }} />
      <Stack.Screen
        name="cash-settings"
        options={{ headerShown: true, title: 'Config. caja', presentation: 'card' }}
      />
    </Stack>
  );
}
