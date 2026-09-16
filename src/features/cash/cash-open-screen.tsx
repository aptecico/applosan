import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { openCashSession } from '@/services/backend';

export function CashOpenScreen() {
  const router = useRouter();
  const { branch, profile, hasPermission, settings } = useWorkspace();
  const [openingCash, setOpeningCash] = useState(
    String(settings?.default_opening_cash ?? 0),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOpeningCash(String(settings?.default_opening_cash ?? 0));
  }, [settings?.default_opening_cash]);

  if (!hasPermission('cash.open')) {
    return (
      <Screen>
        <ThemedText themeColor="destructive">No tienes permiso para abrir caja.</ThemedText>
      </Screen>
    );
  }

  async function onOpen() {
    if (!branch?.id) {
      setError('No hay sucursal activa.');
      return;
    }
    const amount = Number(openingCash.replace(',', '.'));
    if (Number.isNaN(amount) || amount < 0) {
      setError('Indica un efectivo inicial válido.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const session = await openCashSession(branch.id, amount);
      router.replace(`/cash/${session.id}` as Href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo abrir la caja.');
    } finally {
      setSaving(false);
    }
  }

  const now = new Date();

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Apertura de caja</ThemedText>
        <ThemedText themeColor="textSecondary">
          Indica el efectivo físico con el que inicias.
        </ThemedText>
      </View>

      <Card density="comfortable">
        <ThemedText type="small" themeColor="textMuted">
          Usuario
        </ThemedText>
        <ThemedText>{profile?.full_name ?? '—'}</ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          Sucursal
        </ThemedText>
        <ThemedText>{branch?.name ?? '—'}</ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          Fecha y hora
        </ThemedText>
        <ThemedText>{now.toLocaleString('es-CO')}</ThemedText>
        <AppTextField
          label="Efectivo inicial"
          keyboardType="decimal-pad"
          value={openingCash}
          onChangeText={setOpeningCash}
          placeholder="0"
        />
      </Card>

      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      <AppButton loading={saving} title="Abrir caja" icon="save" onPress={() => void onOpen()} />
      <AppButton title="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
});
