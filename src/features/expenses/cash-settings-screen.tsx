import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import { formatMoneyCOP } from '@/features/purchases/purchase-format';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import {
  createExpenseCategory,
  listExpenseCategories,
  updateExpenseCategory,
  updateTenantCashSettings,
} from '@/services/backend';
import type { ExpenseCategory } from '@/types/commerce';

export function CashSettingsScreen() {
  const { tenant, settings, hasPermission, refresh } = useWorkspace();
  const [opening, setOpening] = useState(String(settings?.default_opening_cash ?? 0));
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = hasPermission('settings.update');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await listExpenseCategories(true));
      setOpening(String(settings?.default_opening_cash ?? 0));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }, [settings?.default_opening_cash]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveOpening() {
    if (!tenant?.id) {
      setError('No hay empresa activa.');
      return;
    }
    const value = Number(opening.replace(',', '.'));
    if (Number.isNaN(value) || value < 0) {
      setError('Indica un efectivo inicial válido.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateTenantCashSettings(tenant.id, value);
      await refresh();
      setMessage('Configuración de caja guardada.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    if (!tenant?.id) return;
    if (!newCategory.trim()) {
      setError('Indica el nombre de la categoría.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createExpenseCategory(tenant.id, newCategory.trim());
      setNewCategory('');
      setCategories(await listExpenseCategories(true));
      setMessage('Categoría creada.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la categoría.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategory(cat: ExpenseCategory) {
    setSaving(true);
    setError('');
    try {
      await updateExpenseCategory(cat.id, {
        status: cat.status === 'active' ? 'inactive' : 'active',
      });
      setCategories(await listExpenseCategories(true));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo actualizar.');
    } finally {
      setSaving(false);
    }
  }

  if (!hasPermission('settings.view') && !canEdit) {
    return (
      <Screen>
        <ThemedText themeColor="destructive">No tienes permiso para ver configuración.</ThemedText>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Configuración de caja</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Valores predeterminados y categorías de gastos.
        </ThemedText>
      </View>

      <Card density="compact">
        <ThemedText type="smallBold">Efectivo inicial predeterminado</ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          Se sugiere al abrir una caja nueva. El usuario puede modificarlo.
        </ThemedText>
        <AppTextField
          label="Monto"
          keyboardType="decimal-pad"
          value={opening}
          onChangeText={setOpening}
          editable={canEdit}
        />
        {canEdit ? (
          <AppButton
            title="Guardar efectivo inicial"
            loading={saving}
            onPress={() => void saveOpening()}
          />
        ) : null}
        <ThemedText type="small" themeColor="textMuted">
          Actual: {formatMoneyCOP(settings?.default_opening_cash ?? 0)}
        </ThemedText>
      </Card>

      <ThemedText type="smallBold">Categorías de gastos</ThemedText>
      {canEdit ? (
        <View style={styles.addRow}>
          <View style={styles.flex}>
            <AppTextField
              label="Nueva categoría"
              value={newCategory}
              onChangeText={setNewCategory}
            />
          </View>
          <AppButton title="Crear" icon="plus" onPress={() => void addCategory()} />
        </View>
      ) : null}

      {loading ? <ThemedText themeColor="textSecondary">Cargando…</ThemedText> : null}
      {message ? <ThemedText themeColor="textSecondary">{message}</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {categories.map((cat) => (
        <ListRow
          key={cat.id}
          density="compact"
          trailing={
            <StatusBadge
              label={cat.status === 'active' ? 'Activa' : 'Inactiva'}
              tone={cat.status === 'active' ? 'success' : 'neutral'}
            />
          }>
          <ThemedText type="smallBold">{cat.name}</ThemedText>
          {canEdit ? (
            <AppButton
              title={cat.status === 'active' ? 'Desactivar' : 'Activar'}
              variant="ghost"
              onPress={() => void toggleCategory(cat)}
            />
          ) : null}
        </ListRow>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  addRow: { gap: Spacing.two },
  flex: { flex: 1 },
});
