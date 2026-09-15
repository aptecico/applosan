import { Stack } from 'expo-router';

export default function PurchasesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Compras', headerShown: true }} />
      <Stack.Screen name="new" options={{ title: 'Nueva compra', headerShown: true }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Detalle', headerShown: true }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Editar compra', headerShown: true }} />
    </Stack>
  );
}
