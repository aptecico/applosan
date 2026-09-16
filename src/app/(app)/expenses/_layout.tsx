import { Stack } from 'expo-router';

export default function ExpensesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Gastos', headerShown: true }} />
      <Stack.Screen name="new" options={{ title: 'Nuevo gasto', headerShown: true }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle gasto', headerShown: true }} />
    </Stack>
  );
}
