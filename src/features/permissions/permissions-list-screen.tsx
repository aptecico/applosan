import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { getModuleLabel } from '@/navigation/modules';
import { listPermissions } from '@/services/backend';
import type { Permission } from '@/types/saas';

export function PermissionsListScreen() {
  const [rows, setRows] = useState<Permission[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listPermissions());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los permisos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const grouped = useMemo(() => {
    return rows.reduce<Record<string, Permission[]>>((accumulator, permission) => {
      const moduleName = permission.module;
      accumulator[moduleName] = [...(accumulator[moduleName] ?? []), permission];
      return accumulator;
    }, {});
  }, [rows]);

  return (
    <Screen>
      <ThemedText type="heading">Permisos</ThemedText>
      <ThemedText themeColor="textSecondary">
        Catálogo en lenguaje claro. Los códigos técnicos solo se usan por el sistema.
      </ThemedText>
      {loading ? <ThemedText>Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}
      {Object.entries(grouped).map(([moduleCode, permissions]) => (
        <Card key={moduleCode} style={styles.card}>
          <ThemedText type="section">{getModuleLabel(moduleCode)}</ThemedText>
          {permissions.map((permission) => (
            <View key={permission.id} style={styles.row}>
              <ThemedText type="smallBold">{permission.name}</ThemedText>
              {permission.description ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {permission.description}
                </ThemedText>
              ) : null}
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: Spacing.one,
  },
  row: {
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
});
