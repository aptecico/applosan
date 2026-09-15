import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { createSupplier, getSupplier, updateSupplier } from '@/services/backend';

export function SupplierFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { tenant, hasPermission } = useWorkspace();

  const [name, setName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const canSave = isEdit
    ? hasPermission('purchases.update')
    : hasPermission('purchases.create');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const supplier = await getSupplier(id);
      setName(supplier.name);
      setDocumentNumber(supplier.document_number ?? '');
      setPhone(supplier.phone ?? '');
      setEmail(supplier.email ?? '');
      setAddress(supplier.address ?? '');
      setNotes(supplier.notes ?? '');
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    if (!tenant?.id) {
      setError('No hay empresa activa.');
      return;
    }
    if (!name.trim()) {
      setError('Ingresa el nombre del proveedor.');
      return;
    }
    if (!canSave) {
      setError('No tienes permiso.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name,
        document_number: documentNumber,
        phone,
        email,
        address,
        notes,
      };
      if (isEdit && id) {
        await updateSupplier(id, payload);
      } else {
        await createSupplier(tenant.id, payload);
      }
      router.replace('/suppliers' as Href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ThemedText>Cargando…</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">{isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}</ThemedText>
      </View>
      <AppTextField label="Nombre" onChangeText={setName} value={name} />
      <AppTextField label="Documento" onChangeText={setDocumentNumber} value={documentNumber} />
      <AppTextField keyboardType="phone-pad" label="Teléfono" onChangeText={setPhone} value={phone} />
      <AppTextField
        autoCapitalize="none"
        keyboardType="email-address"
        label="Correo"
        onChangeText={setEmail}
        value={email}
      />
      <AppTextField label="Dirección" onChangeText={setAddress} value={address} />
      <AppTextField label="Notas" onChangeText={setNotes} value={notes} />
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}
      <AppButton loading={saving} onPress={() => void onSave()} title="Guardar" />
      <AppButton title="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
});
