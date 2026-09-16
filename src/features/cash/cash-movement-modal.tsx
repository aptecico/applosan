import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { IconButton } from '@/components/ui/icon-button';
import { KeyboardSafeModal } from '@/components/ui/keyboard-safe-modal';
import { Spacing } from '@/constants/theme';
import { formatMoneyCOP } from '@/features/purchases/purchase-format';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { registerCashMovement } from '@/services/backend';

type MovementKind = 'cash_in' | 'cash_out';

type Props = {
  visible: boolean;
  kind: MovementKind;
  availableCash: number;
  onClose: () => void;
  onSaved: () => void;
};

export function CashMovementModal({ visible, kind, availableCash, onClose, onSaved }: Props) {
  const { branch } = useWorkspace();
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isIn = kind === 'cash_in';
  const title = isIn ? 'Registrar ingreso' : 'Registrar retiro';

  useEffect(() => {
    if (!visible) return;
    setAmount('');
    setConcept('');
    setReference('');
    setError('');
  }, [visible, kind]);

  async function onSubmit() {
    const value = Number(amount.replace(',', '.'));
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      setError('Indica un monto mayor que 0.');
      return;
    }
    if (!concept.trim()) {
      setError('Indica el concepto del movimiento.');
      return;
    }
    if (!isIn && value > availableCash) {
      setError('No hay suficiente efectivo disponible.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await registerCashMovement(
        kind,
        value,
        concept.trim(),
        branch?.id,
        reference.trim() || undefined,
      );
      onSaved();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No fue posible registrar el movimiento. Verifica los datos e inténtalo nuevamente.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardSafeModal visible={visible} onClose={onClose} maxHeightRatio={0.7}>
      <View style={styles.header}>
        <ThemedText type="section">{title}</ThemedText>
        <IconButton icon="close" label="Cerrar" onPress={onClose} />
      </View>

      <ThemedText type="small" themeColor="textMuted">
        Tipo: {isIn ? 'Ingreso' : 'Retiro'}
      </ThemedText>

      {!isIn ? (
        <ThemedText type="small" themeColor="textSecondary">
          Efectivo disponible: {formatMoneyCOP(availableCash)}
        </ThemedText>
      ) : null}

      <AppTextField
        label="Monto"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        placeholder="0"
      />
      <AppTextField
        label="Concepto"
        value={concept}
        onChangeText={setConcept}
        placeholder={isIn ? 'Ej. Aporte de efectivo' : 'Ej. Compra de suministros'}
      />
      <AppTextField
        label="Referencia (opcional)"
        value={reference}
        onChangeText={setReference}
        placeholder="Núm. de comprobante"
      />

      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      <View style={styles.actions}>
        <AppButton title="Cancelar" variant="ghost" onPress={onClose} />
        <AppButton
          title={isIn ? 'Registrar ingreso' : 'Registrar retiro'}
          icon={isIn ? 'arrowUp' : 'arrowDown'}
          loading={saving}
          onPress={() => void onSubmit()}
        />
      </View>
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
  actions: { gap: Spacing.one, marginTop: Spacing.two },
});
