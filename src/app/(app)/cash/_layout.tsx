import { Stack } from 'expo-router';

export default function CashLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Caja', headerShown: true }} />
      <Stack.Screen name="open" options={{ title: 'Abrir caja', headerShown: true }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Detalle caja', headerShown: true }} />
      <Stack.Screen name="[id]/close" options={{ title: 'Cerrar caja', headerShown: true }} />
    </Stack>
  );
}
