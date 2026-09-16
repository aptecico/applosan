import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { CashClosedGate, CashStatusBanner } from '@/features/cash/cash-status-banner';
import { useOpenCashSession } from '@/features/cash/use-open-cash-session';
import { moneySourceLabel } from '@/features/expenses/expense-format';
import { paymentMethodLabel } from '@/features/sales/sale-format';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { createExpense, listExpenseCategories } from '@/services/backend';
import type { ExpenseCategory, ExpenseMoneySource } from '@/types/commerce';

export function ExpenseFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { branch, hasPermission } = useWorkspace();
  const { session, isOpen, loading: cashLoading, refresh } = useOpenCashSession();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash');
  const [source, setSource] = useState<ExpenseMoneySource>('cash_drawer');
  const [transferRef, setTransferRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await refresh();
      setCategories(await listExpenseCategories());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    if (!branch?.id) {
      setError('No hay sucursal activa.');
      return;
    }
    const value = Number(amount.replace(',', '.'));
    if (!concept.trim()) {
      setError('Indica el concepto del gasto.');
      return;
    }
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      setError('Indica un monto mayor que 0.');
      return;
    }
    if (method === 'transfer' && !transferRef.trim()) {
      setError('Ingresa la referencia de la transferencia.');
      return;
    }
    if (!isOpen) {
      setError('Debes abrir la caja para realizar esta operación.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const expense = await createExpense({
        branch_id: branch.id,
        concept: concept.trim(),
        amount: value,
        payment_method: method,
        category_id: categoryId,
        money_source: method === 'cash' ? 'cash_drawer' : source,
        transfer_reference: method === 'transfer' ? transferRef.trim() : null,
        notes: notes.trim() || null,
      });
      router.replace(`/expenses/${expense.id}` as Href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo registrar el gasto.');
    } finally {
      setSaving(false);
    }
  }

  if (!hasPermission('expenses.create')) {
    return (
      <Screen>
        <ThemedText themeColor="destructive">No tienes permiso para registrar gastos.</ThemedText>
      </Screen>
    );
  }

  if (loading || cashLoading) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </Screen>
    );
  }

  if (!isOpen) {
    return (
      <Screen>
        <CashStatusBanner session={session} />
        <CashClosedGate
          canOpen={hasPermission('cash.open')}
          message="Para registrar este gasto debes abrir la caja."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Nuevo gasto</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Registra una salida de dinero con trazabilidad.
        </ThemedText>
      </View>

      <CashStatusBanner session={session} compact />

      <AppTextField
        label="Concepto"
        value={concept}
        onChangeText={setConcept}
        placeholder="Ej. Compra de materiales"
      />

      <ThemedText type="smallBold">Categoría</ThemedText>
      <View style={styles.chips}>
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => setCategoryId(cat.id)}
            style={[
              styles.chip,
              {
                borderColor: theme.border,
                backgroundColor:
                  categoryId === cat.id ? theme.backgroundSelected : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="small">{cat.name}</ThemedText>
          </Pressable>
        ))}
      </View>

      <AppTextField
        label="Monto"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        placeholder="0"
      />

      <Card density="compact">
        <ThemedText type="smallBold">Método</ThemedText>
        <View style={styles.row}>
          {(['cash', 'transfer'] as const).map((m) => (
            <AppButton
              key={m}
              title={paymentMethodLabel(m)}
              variant={method === m ? 'primary' : 'secondary'}
              onPress={() => {
                setMethod(m);
                if (m === 'cash') setSource('cash_drawer');
              }}
              style={styles.flex}
            />
          ))}
        </View>

        {method === 'cash' ? (
          <ThemedText type="small" themeColor="textMuted">
            Origen: {moneySourceLabel('cash_drawer')} (reduce efectivo esperado)
          </ThemedText>
        ) : (
          <>
            <ThemedText type="smallBold">Origen del dinero</ThemedText>
            <View style={styles.row}>
              {(['bank', 'other'] as const).map((s) => (
                <AppButton
                  key={s}
                  title={moneySourceLabel(s)}
                  variant={source === s ? 'primary' : 'secondary'}
                  onPress={() => setSource(s)}
                  style={styles.flex}
                />
              ))}
            </View>
            <AppTextField
              label="Referencia de transferencia"
              value={transferRef}
              onChangeText={setTransferRef}
            />
            <ThemedText type="small" themeColor="textMuted">
              No reduce el efectivo físico de caja.
            </ThemedText>
          </>
        )}
      </Card>

      <AppTextField label="Observación (opcional)" value={notes} onChangeText={setNotes} />

      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      <AppButton
        title="Registrar gasto"
        icon="save"
        loading={saving}
        onPress={() => void onSave()}
      />
      <AppButton title="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  row: { flexDirection: 'row', gap: Spacing.one },
  flex: { flex: 1 },
});
