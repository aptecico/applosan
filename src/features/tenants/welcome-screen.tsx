import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { MinTouchTarget, Radii, Spacing } from '@/constants/theme';
import { CashStatusBanner } from '@/features/cash/cash-status-banner';
import { useOpenCashSession } from '@/features/cash/use-open-cash-session';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { useTheme } from '@/hooks/use-theme';
import { getQuickActions, getVisibleModules } from '@/navigation/access';
import type { AppNavItem } from '@/navigation/modules';
import { listInventoryBalances } from '@/services/backend';
import { isLowStock, resolveMinStock } from '@/utils/stock';

const MODULE_ICON: Record<string, AppIconName> = {
  dashboard: 'chart',
  'sales-new': 'cart',
  'sales-list': 'receipt',
  cash: 'wallet',
  credits: 'creditCard',
  expenses: 'receipt',
  products: 'package',
  inventory: 'inventory',
  purchases: 'cart',
  suppliers: 'truck',
  customers: 'users',
  reports: 'chart',
  admin: 'settings',
};

export function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile, tenant, role, branch, plan, permissions, features, error, hasPermission, settings } =
    useWorkspace();
  const { session, loading: cashLoading } = useOpenCashSession();
  const [lowStockCount, setLowStockCount] = useState(0);

  const firstName = (profile?.full_name ?? '').trim().split(/\s+/)[0] || 'equipo';
  const quickActions = getQuickActions(permissions, features);
  const modules = getVisibleModules(permissions, features);
  const showCash =
    hasPermission('cash.view') || hasPermission('cash.open') || hasPermission('cash.close');
  const canViewInventory = hasPermission('inventory.view');

  const loadLowStock = useCallback(async () => {
    if (!canViewInventory) {
      setLowStockCount(0);
      return;
    }
    try {
      const balances = await listInventoryBalances();
      const count = balances.filter((row) =>
        isLowStock(
          row.qty_on_hand,
          resolveMinStock(row.products?.min_stock, settings?.default_min_stock),
        ),
      ).length;
      setLowStockCount(count);
    } catch {
      setLowStockCount(0);
    }
  }, [canViewInventory, settings?.default_min_stock]);

  useEffect(() => {
    void loadLowStock();
  }, [loadLowStock]);

  function openItem(item: AppNavItem) {
    router.push(item.href as Href);
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <ThemedText type="heading">Bienvenido, {firstName}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {tenant?.name ?? 'Tu negocio'} · {role?.name ?? 'Sin rol'}
          {branch?.name ? ` · ${branch.name}` : ''}
        </ThemedText>
        {plan?.name ? <StatusBadge label={`Plan ${plan.name}`} tone="success" /> : null}
      </View>

      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {showCash ? <CashStatusBanner session={session} loading={cashLoading} compact /> : null}

      {canViewInventory && lowStockCount > 0 ? (
        <View
          style={[
            styles.lowStock,
            { borderColor: theme.border, backgroundColor: theme.surface },
          ]}>
          <AppIcon name="warning" size={16} themeColor="warning" />
          <View style={styles.lowStockText}>
            <ThemedText type="smallBold">Stock bajo</ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              {lowStockCount} {lowStockCount === 1 ? 'producto necesita' : 'productos necesitan'}{' '}
              reposición
            </ThemedText>
          </View>
          <AppButton
            title="Ver"
            variant="secondary"
            onPress={() => router.push('/inventory' as Href)}
            style={styles.lowStockCta}
          />
        </View>
      ) : null}

      {quickActions.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="section">Acciones rápidas</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            Empieza con lo que más usas hoy.
          </ThemedText>
          <View style={styles.grid}>
            {quickActions.map((item) => (
              <ActionTile key={item.id} item={item} onPress={() => openItem(item)} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="section">Tus módulos</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Solo ves lo que tu rol y plan permiten.
        </ThemedText>
        {modules.length === 0 ? (
          <Card>
            <ThemedText>
              Aún no tienes módulos asignados. Pide a un administrador que revise tu rol.
            </ThemedText>
          </Card>
        ) : (
          <View style={styles.moduleList}>
            {modules.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${item.title}`}
                onPress={() => openItem(item)}
                style={({ pressed }) => [
                  styles.moduleRow,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <AppIcon
                  name={MODULE_ICON[item.id] ?? 'package'}
                  size={18}
                  themeColor="accent"
                />
                <View style={styles.moduleText}>
                  <ThemedText type="smallBold">{item.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.description}
                    {item.comingSoon ? ' · Próximamente' : ''}
                  </ThemedText>
                </View>
                <ThemedText themeColor="accent">Abrir</ThemedText>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function ActionTile({ item, onPress }: { item: AppNavItem; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <AppIcon name={MODULE_ICON[item.id] ?? 'package'} size={20} themeColor="accent" />
      <ThemedText type="smallBold">{item.title}</ThemedText>
      {item.comingSoon ? (
        <ThemedText type="small" themeColor="textSecondary">
          Pronto
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  lowStock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  lowStockText: { flex: 1, gap: 2 },
  lowStockCta: { minWidth: 72 },
  section: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    minHeight: MinTouchTarget * 2,
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.three,
    justifyContent: 'center',
    gap: Spacing.one,
  },
  moduleList: {
    gap: Spacing.two,
  },
  moduleRow: {
    minHeight: MinTouchTarget + 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  moduleText: {
    flex: 1,
    gap: Spacing.half,
  },
});
