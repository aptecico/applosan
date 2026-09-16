import { Stack } from 'expo-router';

export default function CreditsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Créditos', headerShown: true }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle crédito', headerShown: true }} />
    </Stack>
  );
}
