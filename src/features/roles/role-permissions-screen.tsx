import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { MinTouchTarget, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getModuleLabel } from '@/navigation/modules';
import {
  getRole,
  listPermissions,
  replaceRolePermissions,
  type RoleWithPermissions,
} from '@/services/backend';
import type { Permission } from '@/types/saas';

export function RolePermissionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [role, setRole] = useState<RoleWithPermissions | null>(null);
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [nextRole, permissions] = await Promise.all([getRole(id), listPermissions()]);
      setRole(nextRole);
      setCatalog(permissions);
      const ids = new Set(
        (nextRole.role_permissions ?? [])
          .map((item) => item.permissions?.id ?? item.permission_id)
          .filter(Boolean) as string[],
      );
      setSelected(ids);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar el rol.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    return catalog.reduce<Record<string, Permission[]>>((acc, permission) => {
      const key = permission.module;
      acc[key] = [...(acc[key] ?? []), permission];
      return acc;
    }, {});
  }, [catalog]);

  function toggle(permissionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  }

  async function onSave() {
    if (!id || !role || role.is_system) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await replaceRolePermissions(id, [...selected]);
      setMessage('Permisos actualizados.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ThemedText>Cargando…</ThemedText>
      </Screen>
    );
  }

  if (!role) {
    return (
      <Screen>
        <ThemedText themeColor="destructive">{error || 'Rol no encontrado.'}</ThemedText>
        <AppButton title="Volver" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">{role.name}</ThemedText>
        <ThemedText themeColor="textSecondary">
          Marca lo que este rol puede hacer. Los nombres son para personas; internamente se usan
          códigos técnicos.
        </ThemedText>
      </View>

      {role.is_system ? (
        <Card>
          <ThemedText>
            Este es un rol de sistema y no se puede editar desde la app. Crea un rol personalizado
            para ajustar permisos.
          </ThemedText>
        </Card>
      ) : null}

      {Object.entries(grouped).map(([moduleCode, permissions]) => (
        <Card key={moduleCode} style={styles.card}>
          <ThemedText type="section">{getModuleLabel(moduleCode)}</ThemedText>
          {permissions.map((permission) => {
            const checked = selected.has(permission.id);
            return (
              <Pressable
                key={permission.id}
                disabled={role.is_system}
                onPress={() => toggle(permission.id)}
                style={({ pressed }) => [
                  styles.checkRow,
                  {
                    borderColor: theme.border,
                    backgroundColor: checked ? theme.backgroundSelected : theme.backgroundElement,
                    opacity: pressed || role.is_system ? 0.85 : 1,
                  },
                ]}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: theme.accent,
                      backgroundColor: checked ? theme.accent : 'transparent',
                    },
                  ]}
                />
                <View style={styles.checkText}>
                  <ThemedText type="smallBold">{permission.name}</ThemedText>
                  {permission.description ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {permission.description}
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </Card>
      ))}

      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}
      {message ? <ThemedText themeColor="success">{message}</ThemedText> : null}

      {!role.is_system ? (
        <AppButton loading={saving} onPress={() => void onSave()} title="Guardar permisos" />
      ) : null}
      <AppButton title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  card: {
    marginTop: Spacing.two,
  },
  checkRow: {
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
  },
  checkText: {
    flex: 1,
    gap: Spacing.half,
  },
});
