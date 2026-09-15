import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-provider';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { updateOwnProfile } from '@/services/backend';
import { Spacing } from '@/constants/theme';

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, tenant, role, branch, refresh } = useWorkspace();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSave() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await updateOwnProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      });
      await refresh();
      setMessage('Perfil actualizado.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Perfil</ThemedText>
        <ThemedText themeColor="textSecondary">{user?.email}</ThemedText>
      </View>

      <Card>
        <ThemedText type="section">{tenant?.name}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {role?.name} · {branch?.name}
        </ThemedText>
      </Card>

      <AppTextField label="Nombre" onChangeText={setFullName} value={fullName} />
      <AppTextField
        keyboardType="phone-pad"
        label="Teléfono"
        onChangeText={setPhone}
        textContentType="telephoneNumber"
        value={phone}
      />

      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}
      {message ? <ThemedText themeColor="success">{message}</ThemedText> : null}

      <AppButton loading={loading} onPress={() => void onSave()} title="Guardar cambios" />
      <AppButton title="Cerrar sesión" variant="danger" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
});
