import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { createCustomer, listCustomers, type Customer } from '@/services/supabase/customers';

export function CustomersListScreen() {
  const { tenant, hasPermission } = useWorkspace();
  const [rows, setRows] = useState<Customer[]>([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listCustomers());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onCreate() {
    if (!tenant?.id) {
      setError('No hay empresa activa.');
      return;
    }
    if (!fullName.trim()) {
      setError('Ingresa el nombre del cliente.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createCustomer(tenant.id, { full_name: fullName, phone });
      setFullName('');
      setPhone('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear el cliente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Clientes</ThemedText>
        <ThemedText themeColor="textSecondary">
          Directorio básico. Luego se usará en ventas a crédito.
        </ThemedText>
      </View>

      {hasPermission('customers.create') ? (
        <Card>
          <ThemedText type="section">Nuevo cliente</ThemedText>
          <AppTextField label="Nombre" onChangeText={setFullName} value={fullName} />
          <AppTextField
            keyboardType="phone-pad"
            label="Teléfono"
            onChangeText={setPhone}
            value={phone}
          />
          <AppButton loading={saving} onPress={() => void onCreate()} title="Guardar cliente" />
        </Card>
      ) : null}

      {loading ? <ThemedText>Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {!loading && rows.length === 0 ? (
        <Card>
          <ThemedText>Aún no hay clientes.</ThemedText>
        </Card>
      ) : null}

      {rows.map((customer) => (
        <Card key={customer.id} style={styles.card}>
          <ThemedText type="section">{customer.full_name}</ThemedText>
          {customer.phone ? (
            <ThemedText themeColor="textSecondary">{customer.phone}</ThemedText>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two },
  card: { marginTop: Spacing.one },
});
