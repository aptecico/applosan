import { Stack } from 'expo-router';

export default function SalesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Ventas', headerShown: true }} />
      <Stack.Screen name="new" options={{ title: 'Nueva venta', headerShown: true }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle venta', headerShown: true }} />
    </Stack>
  );
}
