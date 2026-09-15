import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { MinTouchTarget, Radii, Spacing } from '@/constants/theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { useTheme } from '@/hooks/use-theme';
import { getQuickActions, getVisibleModules } from '@/navigation/access';
import type { AppNavItem } from '@/navigation/modules';

export function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile, tenant, role, branch, plan, permissions, features, error } = useWorkspace();

  const firstName = (profile?.full_name ?? '').trim().split(/\s+/)[0] || 'equipo';
  const quickActions = getQuickActions(permissions, features);
  const modules = getVisibleModules(permissions, features);

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
