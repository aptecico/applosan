import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { IconButton } from '@/components/ui/icon-button';
import { KeyboardSafeModal } from '@/components/ui/keyboard-safe-modal';
import { ListRow } from '@/components/ui/list-row';
import { Density, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { createCustomer, listCustomers, type Customer } from '@/services/backend';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  title?: string;
};

export function CustomerPickerModal({
  visible,
  onClose,
  onSelect,
  title = 'Seleccionar cliente',
}: Props) {
  const theme = useTheme();
  const { tenant, hasPermission } = useWorkspace();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setCreating(false);
    setError('');
    void (async () => {
      setLoading(true);
      try {
        setCustomers(await listCustomers());
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No se pudieron cargar clientes.');
      } finally {
        setLoading(false);
      }
    })();
  }, [visible]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const hay = `${c.full_name} ${c.phone ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [customers, query]);

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
      const created = await createCustomer(tenant.id, { full_name: fullName.trim(), phone });
      setCustomers((prev) => [created, ...prev]);
      setCreating(false);
      setFullName('');
      setPhone('');
      onSelect(created);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear el cliente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardSafeModal visible={visible} onClose={onClose} maxHeightRatio={0.85}>
      <View style={styles.header}>
        <ThemedText type="section">{creating ? 'Nuevo cliente' : title}</ThemedText>
        <IconButton icon="close" onPress={onClose} label="Cerrar" />
      </View>

      {creating ? (
        <View style={styles.form}>
          <AppTextField label="Nombre" value={fullName} onChangeText={setFullName} />
          <AppTextField
            label="Teléfono"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}
          <AppButton loading={saving} title="Guardar y seleccionar" onPress={() => void onCreate()} />
          <AppButton title="Volver" variant="ghost" onPress={() => setCreating(false)} />
        </View>
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar cliente…"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.search,
              {
                borderColor: theme.border,
                color: theme.text,
                backgroundColor: theme.backgroundElement,
              },
            ]}
          />
          {hasPermission('customers.create') ? (
            <AppButton title="Nuevo cliente" icon="plus" variant="secondary" onPress={() => setCreating(true)} />
          ) : null}
          {loading ? <ThemedText themeColor="textSecondary">Cargando…</ThemedText> : null}
          {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}>
                <ListRow density="compact">
                  <ThemedText type="smallBold">{item.full_name}</ThemedText>
                  {item.phone ? (
                    <ThemedText type="small" themeColor="textMuted">
                      {item.phone}
                    </ThemedText>
                  ) : null}
                </ListRow>
              </Pressable>
            )}
            ListEmptyComponent={
              !loading ? (
                <ThemedText themeColor="textSecondary" style={styles.empty}>
                  No hay clientes.
                </ThemedText>
              ) : null
            }
          />
        </>
      )}
    </KeyboardSafeModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    paddingHorizontal: Density.compact.rowPaddingX,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },
  form: { gap: Spacing.two },
  empty: { paddingVertical: Spacing.four, textAlign: 'center' },
});
