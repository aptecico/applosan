import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { Card } from '@/components/ui/card';
import { KeyboardSafeScrollView } from '@/components/ui/keyboard-safe-scroll-view';
import { MinTouchTarget, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import {
  createProduct,
  createProductCategory,
  getProduct,
  listProductCategories,
  updateProduct,
} from '@/services/backend';
import type { Product, ProductCategory } from '@/types/catalog';

export type ProductEditorProps = {
  productId?: string;
  /** Prefill name (e.g. from purchase search query). */
  initialName?: string;
  onCancel: () => void;
  onSaved: (product: Product) => void;
  /** Hide large page heading when embedded in a sheet/modal. */
  embedded?: boolean;
};

/**
 * Shared create/edit product form used by Products screens and purchase quick-create.
 */
export function ProductEditor({
  productId,
  initialName = '',
  onCancel,
  onSaved,
  embedded = false,
}: ProductEditorProps) {
  const theme = useTheme();
  const { tenant, hasPermission } = useWorkspace();
  const isEdit = Boolean(productId);

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [name, setName] = useState(initialName);
  const [sku, setSku] = useState('');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const canSave = isEdit
    ? hasPermission('products.update')
    : hasPermission('products.create');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await listProductCategories();
      setCategories(cats);
      if (productId) {
        const product = await getProduct(productId);
        setName(product.name);
        setSku(product.sku ?? '');
        setBrand(product.brand ?? '');
        setColor(product.color ?? '');
        setSize(product.size ?? '');
        setSalePrice(String(product.sale_price ?? 0));
        setCategoryId(product.category_id);
      } else if (initialName.trim()) {
        setName(initialName.trim());
      }
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  }, [productId, initialName]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAddCategory() {
    if (!tenant?.id || !newCategory.trim()) return;
    try {
      const created = await createProductCategory(tenant.id, newCategory);
      setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(created.id);
      setNewCategory('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la categoría.');
    }
  }

  async function onSave() {
    if (!tenant?.id) {
      setError('No hay empresa activa.');
      return;
    }
    if (!name.trim()) {
      setError('Ingresa el nombre del producto.');
      return;
    }
    if (!canSave) {
      setError('No tienes permiso para guardar productos.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name,
        sku,
        brand,
        color,
        size,
        category_id: categoryId,
        sale_price: Number(salePrice.replace(',', '.')) || 0,
      };
      const saved =
        isEdit && productId
          ? await updateProduct(productId, payload)
          : await createProduct(tenant.id, payload);
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      </View>
    );
  }

  const body = (
    <View style={styles.body}>
      {!embedded ? (
        <View style={styles.header}>
          <ThemedText type="heading">{isEdit ? 'Editar producto' : 'Nuevo producto'}</ThemedText>
          <ThemedText themeColor="textSecondary">
            Una sola ficha por prenda. Las compras posteriores guardan costos distintos en lotes.
          </ThemedText>
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Completa los datos mínimos. Luego continuarás con la compra.
        </ThemedText>
      )}

      <AppTextField label="Nombre" onChangeText={setName} value={name} />
      <AppTextField
        label="SKU (opcional)"
        onChangeText={setSku}
        value={sku}
        autoCapitalize="characters"
      />
      <AppTextField label="Marca" onChangeText={setBrand} value={brand} />
      <AppTextField label="Color" onChangeText={setColor} value={color} />
      <AppTextField label="Talla" onChangeText={setSize} value={size} />
      <AppTextField
        keyboardType="decimal-pad"
        label="Precio de venta"
        onChangeText={setSalePrice}
        value={salePrice}
      />

      <Card density={embedded ? 'compact' : 'comfortable'}>
        <ThemedText type={embedded ? 'smallBold' : 'section'}>Categoría</ThemedText>
        <View style={styles.chips}>
          <Pressable
            onPress={() => setCategoryId(null)}
            style={[
              styles.chip,
              {
                borderColor: theme.border,
                backgroundColor: !categoryId ? theme.backgroundSelected : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="small">Sin categoría</ThemedText>
          </Pressable>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              style={[
                styles.chip,
                {
                  borderColor: theme.border,
                  backgroundColor:
                    categoryId === category.id ? theme.backgroundSelected : theme.backgroundElement,
                },
              ]}>
              <ThemedText type="small">{category.name}</ThemedText>
            </Pressable>
          ))}
        </View>
        {hasPermission('products.create') ? (
          <View style={styles.newCategory}>
            <AppTextField
              label="Nueva categoría"
              onChangeText={setNewCategory}
              value={newCategory}
            />
            <AppButton title="Agregar" variant="secondary" onPress={() => void onAddCategory()} />
          </View>
        ) : null}
      </Card>

      {error ? <ThemedText themeColor="destructive">{error}</ThemedText> : null}
      <AppButton
        loading={saving}
        icon="save"
        onPress={() => void onSave()}
        title={embedded ? 'Guardar y continuar' : 'Guardar'}
      />
      <AppButton title="Cancelar" variant="ghost" onPress={onCancel} />
    </View>
  );

  if (embedded) {
    return (
      <KeyboardSafeScrollView
        contentContainerStyle={styles.embedScroll}
        style={styles.embed}
        bottomPadding={Spacing.three}>
        {body}
      </KeyboardSafeScrollView>
    );
  }

  return body;
}

const styles = StyleSheet.create({
  loading: { paddingVertical: Spacing.four },
  body: { gap: Spacing.three },
  header: { gap: Spacing.two },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  newCategory: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  embed: { flex: 1 },
  embedScroll: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
});
