import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { SplashScreenController } from '@/features/auth/splash-screen-controller';
import { WorkspaceProvider, useWorkspace } from '@/features/tenants/workspace-provider';
import { Spacing } from '@/constants/theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <WorkspaceProvider>
          <SplashScreenController />
          <RootNavigator />
        </WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, isLoading: authLoading, signOut } = useAuth();
  const { tenant, isLoading: workspaceLoading, error, refresh } = useWorkspace();

  if (authLoading || workspaceLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator />
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </View>
    );
  }

  // Sesión ok pero el RPC falló (p. ej. migrations no aplicadas): no quedarse en splash.
  if (session && error && !tenant) {
    return (
      <View style={styles.boot}>
        <ThemedText type="heading">No se pudo conectar</ThemedText>
        <ThemedText themeColor="textSecondary">{error}</ThemedText>
        <ThemedText
          themeColor="textSecondary"
          onPress={() => {
            void refresh();
          }}
        >
          Reintentar
        </ThemedText>
        <ThemedText
          themeColor="textSecondary"
          onPress={() => {
            void signOut();
          }}
        >
          Cerrar sesión
        </ThemedText>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && !!tenant}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !tenant}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
});
