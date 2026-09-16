import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppIcon } from '@/components/ui/app-icon';
import { StatusBadge } from '@/components/ui/status-badge';
import { Radii, Spacing } from '@/constants/theme';
import { formatMoneyCOP } from '@/features/purchases/purchase-format';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import type { CashSession } from '@/types/commerce';

type Props = {
  session: CashSession | null;
  loading?: boolean;
  compact?: boolean;
};

export function CashStatusBanner({ session, loading, compact }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const { hasPermission } = useWorkspace();
  const canOpen = hasPermission('cash.open');
  const canView = hasPermission('cash.view') || canOpen;

  if (!canView || loading) return null;

  const open = session?.status === 'open';

  return (
    <View
      style={[
        styles.banner,
        {
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
        compact ? styles.compact : null,
      ]}>
      <View style={styles.left}>
        <AppIcon name={open ? 'check' : 'ban'} size={16} themeColor={open ? 'success' : 'warning'} />
        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <ThemedText type="smallBold">{open ? 'Caja abierta' : 'Caja cerrada'}</ThemedText>
            <StatusBadge
              label={open ? 'Abierta' : 'Cerrada'}
              tone={open ? 'success' : 'warning'}
            />
          </View>
          {open && session ? (
            <ThemedText type="small" themeColor="textMuted">
              Efectivo inicial {formatMoneyCOP(session.opening_cash)}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textMuted">
              {canOpen
                ? 'Abre la caja para registrar ventas y pagos.'
                : 'Solicita al administrador la apertura de caja.'}
            </ThemedText>
          )}
        </View>
      </View>
      {open && session ? (
        <AppButton
          title="Ver caja"
          variant="secondary"
          onPress={() => router.push(`/cash/${session.id}` as Href)}
          style={styles.cta}
        />
      ) : canOpen ? (
        <AppButton
          title="Abrir caja"
          icon="plus"
          onPress={() => router.push('/cash/open' as Href)}
          style={styles.cta}
        />
      ) : null}
    </View>
  );
}

export function CashClosedGate({
  canOpen,
  message = 'Debes abrir una caja antes de realizar esta operación.',
}: {
  canOpen: boolean;
  message?: string;
}) {
  const router = useRouter();
  return (
    <View style={styles.gate}>
      <AppIcon name="ban" size={28} themeColor="warning" />
      <ThemedText type="section">Caja cerrada</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.gateCopy}>
        {canOpen
          ? message
          : 'No existe una caja abierta. Solicita al administrador la apertura de caja.'}
      </ThemedText>
      {canOpen ? (
        <AppButton title="Abrir caja" icon="plus" onPress={() => router.push('/cash/open' as Href)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  compact: {
    paddingVertical: Spacing.two,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  textBlock: { flex: 1, gap: 2 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  cta: { minWidth: 110 },
  gate: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  gateCopy: { textAlign: 'center' },
});
