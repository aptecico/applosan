import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-provider';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { registerTenant } from '@/services/backend';
import { Spacing } from '@/constants/theme';

export function RegisterScreen() {
  const { signUp } = useAuth();
  const { refresh } = useWorkspace();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [branchName, setBranchName] = useState('Principal');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = 'Ingresa tu nombre.';
    if (!email.trim()) next.email = 'Ingresa un correo.';
    if (password.length < 8) next.password = 'Mínimo 8 caracteres.';
    if (!tenantName.trim()) next.tenantName = 'Ingresa el nombre de la empresa.';
    if (!branchName.trim()) next.branchName = 'Ingresa la sucursal principal.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit() {
    setFormError('');
    setInfo('');
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(email, password, fullName);
      if (result.needsEmailConfirmation) {
        setInfo('Cuenta creada. Confirma tu correo y luego inicia sesión para terminar el alta de la empresa.');
        return;
      }

      await registerTenant({
        name: tenantName,
        commercialName: tenantName,
        email,
        branchName,
      });
      await refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Registrar empresa</ThemedText>
        <ThemedText themeColor="textSecondary">
          Crea tu cuenta y el almacén. Quedarás como administrador en el plan Gratis.
        </ThemedText>
      </View>

      <AppTextField
        autoComplete="name"
        error={errors.fullName}
        label="Nombre completo"
        onChangeText={setFullName}
        textContentType="name"
        value={fullName}
      />
      <AppTextField
        autoComplete="email"
        error={errors.email}
        keyboardType="email-address"
        label="Correo"
        onChangeText={setEmail}
        textContentType="username"
        value={email}
      />
      <AppTextField
        autoComplete="new-password"
        error={errors.password}
        helperText="Mínimo 8 caracteres."
        isPassword
        label="Contraseña"
        onChangeText={setPassword}
        textContentType="newPassword"
        value={password}
      />
      <AppTextField
        error={errors.tenantName}
        label="Nombre de la empresa"
        onChangeText={setTenantName}
        value={tenantName}
      />
      <AppTextField
        error={errors.branchName}
        label="Sucursal principal"
        onChangeText={setBranchName}
        value={branchName}
      />

      {formError ? (
        <ThemedText themeColor="destructive" accessibilityLiveRegion="polite">
          {formError}
        </ThemedText>
      ) : null}
      {info ? (
        <ThemedText themeColor="success" accessibilityLiveRegion="polite">
          {info}
        </ThemedText>
      ) : null}

      <AppButton loading={loading} onPress={() => void onSubmit()} title="Crear cuenta" />
      <Link href="/" asChild>
        <AppButton title="Ya tengo cuenta" variant="ghost" />
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
