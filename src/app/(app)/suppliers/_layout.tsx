import { Stack } from 'expo-router';

export default function SuppliersLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Proveedores', headerShown: true }} />
      <Stack.Screen name="new" options={{ title: 'Nuevo proveedor', headerShown: true }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar proveedor', headerShown: true }} />
    </Stack>
  );
}
