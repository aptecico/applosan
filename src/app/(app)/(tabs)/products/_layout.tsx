import { Stack } from 'expo-router';

export default function ProductsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Productos', headerShown: true }} />
      <Stack.Screen name="new" options={{ title: 'Nuevo producto', headerShown: true }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar producto', headerShown: true }} />
    </Stack>
  );
}
