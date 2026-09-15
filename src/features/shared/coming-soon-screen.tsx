import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';

type Props = {
  title: string;
  description: string;
  permission?: string;
};

export function ComingSoonScreen({ title, description, permission }: Props) {
  const { hasPermission } = useWorkspace();
  const allowed = !permission || hasPermission(permission);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{description}</ThemedText>
      </View>

      {!allowed ? (
        <Card>
          <ThemedText themeColor="destructive">
            No tienes permiso para este módulo. Si lo necesitas, pide a un administrador que ajuste
            tu rol.
          </ThemedText>
        </Card>
      ) : (
        <Card>
          <ThemedText type="section">Próximamente</ThemedText>
          <ThemedText themeColor="textSecondary">
            La base de datos y los permisos ya están preparados. La pantalla operativa se habilitará
            en la siguiente fase.
          </ThemedText>
        </Card>
      )}

      <Link href="/" asChild>
        <AppButton title="Volver al inicio" variant="secondary" />
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
});
