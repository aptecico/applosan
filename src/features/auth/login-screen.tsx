import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-provider';
import { Spacing } from '@/constants/theme';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    const nextEmailError = email.trim() ? '' : 'Ingresa tu correo.';
    const nextPasswordError = password ? '' : 'Ingresa tu contraseña.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError('');

    if (nextEmailError || nextPasswordError) {
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Applosan</ThemedText>
        <ThemedText themeColor="textSecondary">
          Inicia sesión para entrar a tu almacén.
        </ThemedText>
      </View>

      <AppTextField
        autoComplete="email"
        error={emailError}
        keyboardType="email-address"
        label="Correo"
        onChangeText={(value) => {
          setEmail(value);
          setEmailError('');
        }}
        placeholder="tu@correo.com"
        textContentType="username"
        value={email}
      />
      <AppTextField
        autoComplete="password"
        error={passwordError}
        isPassword
        label="Contraseña"
        onChangeText={(value) => {
          setPassword(value);
          setPasswordError('');
        }}
        onSubmitEditing={() => void onSubmit()}
        textContentType="password"
        value={password}
      />

      {formError ? (
        <ThemedText themeColor="destructive" accessibilityLiveRegion="polite">
          {formError}
        </ThemedText>
      ) : null}

      <AppButton loading={loading} onPress={() => void onSubmit()} title="Entrar" />

      <Link href="/register" asChild>
        <AppButton title="Crear empresa" variant="ghost" />
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
});
