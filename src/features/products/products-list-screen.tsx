import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { Spacing } from '@/constants/theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import { listProducts } from '@/services/backend';
import type { Product, ProductCategory } from '@/types/catalog';

type ProductRow = Product & {
  product_categories: Pick<ProductCategory, 'id' | 'name'> | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProductsListScreen() {
  const { hasPermission } = useWorkspace();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const canCreate = hasPermission('products.create');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listProducts());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar productos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const activeCount = useMemo(
    () => rows.filter((row) => row.status === 'active').length,
    [rows],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="heading">Productos</ThemedText>
        <ThemedText themeColor="textSecondary">
          Catálogo del almacén. El costo de compra vive en cada lote, no se promedia aquí.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {activeCount} activos · {rows.length} total
        </ThemedText>
      </View>

      {canCreate ? (
        <Link href={'/products/new' as Href} asChild>
          <AppButton title="Nuevo producto" />
        </Link>
      ) : null}

      {loading ? <ThemedText>Cargando…</ThemedText> : null}
      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}

      {!loading && rows.length === 0 ? (
        <Card>
          <ThemedText>Aún no hay productos. Crea el primero para empezar el inventario.</ThemedText>
        </Card>
      ) : null}

      {rows.map((product) => (
        <Card key={product.id} style={styles.card}>
          <View style={styles.row}>
            <ThemedText type="section">{product.name}</ThemedText>
            <StatusBadge
              label={product.status === 'active' ? 'Activo' : product.status}
              tone={product.status === 'active' ? 'success' : 'neutral'}
            />
          </View>
          <ThemedText themeColor="textSecondary">
            {[product.brand, product.color, product.size].filter(Boolean).join(' · ') || 'Sin detalle'}
          </ThemedText>
          <ThemedText type="small">
            Precio venta: {formatMoney(product.sale_price)}
            {product.sku ? ` · SKU ${product.sku}` : ''}
          </ThemedText>
          {product.product_categories?.name ? (
            <ThemedText type="small" themeColor="textSecondary">
              Categoría: {product.product_categories.name}
            </ThemedText>
          ) : null}
          {hasPermission('products.update') ? (
            <Link href={`/products/${product.id}` as Href} asChild>
              <AppButton title="Editar" variant="secondary" />
            </Link>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  card: {
    marginTop: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
