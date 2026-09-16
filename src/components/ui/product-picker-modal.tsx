import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { AppIcon } from '@/components/ui/app-icon';
import { IconButton } from '@/components/ui/icon-button';
import { KeyboardSafeModal } from '@/components/ui/keyboard-safe-modal';
import { ListRow } from '@/components/ui/list-row';
import { StockBadge } from '@/components/ui/stock-badge';
import {
  CompactTouchTarget,
  Density,
  MinTouchTarget,
  Radii,
  Spacing,
} from '@/constants/theme';
import { ProductEditor } from '@/features/products/product-editor';
import { formatMoneyCOP, productMetaLine } from '@/features/purchases/purchase-format';
import { dismissKeyboard } from '@/hooks/use-keyboard-bottom-inset';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/features/tenants/workspace-provider';
import type { Product } from '@/types/catalog';
import { resolveMinStock } from '@/utils/stock';

type Props = {
  visible: boolean;
  products: Product[];
  stockByProductId?: Record<string, number>;
  onClose: () => void;
  onSelect: (product: Product) => void;
  onProductCreated?: (product: Product) => void;
  title?: string;
};

function matchesQuery(product: Product, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    product.name,
    product.sku,
    product.barcode,
    product.brand,
    product.color,
    product.size,
    product.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function ProductPickerModal({
  visible,
  products,
  stockByProductId,
  onClose,
  onSelect,
  onProductCreated,
  title = 'Seleccionar producto',
}: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { hasPermission, settings } = useWorkspace();
  const [query, setQuery] = useState('');
  const [scanHint, setScanHint] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const isDesktop = width >= 768;
  const canCreate = hasPermission('products.create');

  const results = useMemo(
    () => products.filter((product) => matchesQuery(product, query)),
    [products, query],
  );

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setScanHint(false);
      setCreating(false);
    }
  }, [visible]);

  function handleSelect(product: Product) {
    dismissKeyboard();
    onSelect(product);
    onClose();
  }

  function openCreate() {
    dismissKeyboard();
    setCreating(true);
  }

  function onCreated(product: Product) {
    setCreating(false);
    setQuery('');
    onProductCreated?.(product);
    onSelect(product);
    onClose();
  }

  function onScanPress() {
    setScanHint(true);
    inputRef.current?.focus();
  }

  function requestClose() {
    if (creating) {
      setCreating(false);
      return;
    }
    dismissKeyboard();
    onClose();
  }

  return (
    <KeyboardSafeModal
      visible={visible}
      onClose={requestClose}
      placement={isDesktop ? 'center' : 'bottom'}
      maxHeightRatio={isDesktop ? 0.85 : 0.92}
      closeOnBackdrop={!creating}>
      <View style={styles.sheetBody}>
        {!isDesktop ? (
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
        ) : null}

        {creating ? (
          <>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <ThemedText type="smallBold">Crear producto</ThemedText>
                <ThemedText type="small" themeColor="textMuted" style={styles.headerSub}>
                  Sin salir de la compra
                </ThemedText>
              </View>
              <IconButton
                icon="close"
                label="Volver al buscador"
                onPress={() => setCreating(false)}
              />
            </View>
            <ProductEditor
              embedded
              initialName={query}
              onCancel={() => setCreating(false)}
              onSaved={onCreated}
            />
          </>
        ) : (
          <>
            {/* Header + search stay pinned; only the list shrinks when keyboard opens. */}
            <View style={styles.stickyTop}>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <ThemedText type="smallBold">{title}</ThemedText>
                  <ThemedText type="small" themeColor="textMuted" style={styles.headerSub}>
                    Busca en el catálogo o escanea código
                  </ThemedText>
                </View>
                <IconButton icon="close" label="Cerrar" onPress={requestClose} />
              </View>

              <View style={styles.searchRow}>
                <View
                  style={[
                    styles.searchField,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundElement,
                    },
                  ]}>
                  <AppIcon name="search" size={16} themeColor="textMuted" />
                  <TextInput
                    ref={inputRef}
                    accessibilityLabel="Buscar producto"
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(value) => {
                      setQuery(value);
                      if (scanHint) setScanHint(false);
                    }}
                    placeholder={
                      scanHint
                        ? 'Escanea o escribe el código…'
                        : 'Nombre, SKU o código de barras'
                    }
                    placeholderTextColor={theme.textMuted}
                    style={[styles.searchInput, { color: theme.text }]}
                    value={query}
                    returnKeyType="search"
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Escanear código"
                  onPress={onScanPress}
                  style={({ pressed }) => [
                    styles.scanBtn,
                    {
                      borderColor: theme.border,
                      backgroundColor: pressed
                        ? theme.backgroundSelected
                        : withAlpha(theme.info, 0.1),
                    },
                  ]}
                  {...({ title: 'Escanear código' } as object)}>
                  <AppIcon name="barcode" size={20} color={theme.info} />
                </Pressable>
              </View>
            </View>

            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={dismissKeyboard}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: theme.border }]} />
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <ThemedText type="smallBold">No encontramos productos</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.emptyCopy}>
                    {query.trim()
                      ? `No existe un producto que coincida con “${query.trim()}”.`
                      : 'Todavía no hay productos en el catálogo.'}
                  </ThemedText>
                  {canCreate ? (
                    <AppButton
                      title="Crear producto"
                      icon="plus"
                      onPress={openCreate}
                      style={styles.emptyCta}
                    />
                  ) : null}
                </View>
              }
              ListFooterComponent={
                results.length > 0 && canCreate ? (
                  <View style={styles.createFooter}>
                    <ThemedText type="small" themeColor="textMuted">
                      ¿No encuentras el producto?
                    </ThemedText>
                    <AppButton
                      title="Crear producto"
                      icon="plus"
                      variant="secondary"
                      onPress={openCreate}
                    />
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const meta = productMetaLine(item);
                const stock = stockByProductId?.[item.id];
                return (
                  <ListRow
                    density="compact"
                    bordered={false}
                    accessibilityLabel={`Añadir ${item.name}`}
                    onPress={() => handleSelect(item)}
                    trailing={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Añadir ${item.name}`}
                        hitSlop={6}
                        onPress={() => handleSelect(item)}
                        style={({ pressed }) => [
                          styles.addBtn,
                          {
                            backgroundColor: pressed
                              ? theme.backgroundSelected
                              : withAlpha(theme.accent, 0.12),
                            borderColor: withAlpha(theme.accent, 0.28),
                          },
                        ]}>
                        <AppIcon name="plus" size={14} themeColor="accent" />
                        <ThemedText type="smallBold" themeColor="accent" style={styles.addLabel}>
                          Añadir
                        </ThemedText>
                      </Pressable>
                    }>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {item.name}
                    </ThemedText>
                    {meta ? (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {meta}
                      </ThemedText>
                    ) : null}
                    <View style={styles.metaRow}>
                      <StockBadge
                        quantity={stock}
                        minStock={resolveMinStock(
                          item.min_stock,
                          settings?.default_min_stock,
                        )}
                      />
                      {item.sale_price > 0 ? (
                        <ThemedText type="small" themeColor="textMuted">
                          PVP {formatMoneyCOP(item.sale_price)}
                        </ThemedText>
                      ) : null}
                    </View>
                  </ListRow>
                );
              }}
            />

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <ThemedText type="small" themeColor="textMuted">
                {results.length === products.length
                  ? `${products.length} productos`
                  : `${results.length} de ${products.length} productos`}
              </ThemedText>
            </View>
          </>
        )}
      </View>
    </KeyboardSafeModal>
  );
}

function withAlpha(hex: string, alpha: number) {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  sheetBody: {
    flex: 1,
    paddingTop: Spacing.two,
  },
  stickyTop: {
    flexShrink: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radii.pill,
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Density.compact.rowPaddingX,
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Density.compact.rowPaddingX,
    paddingVertical: Spacing.two,
  },
  searchField: {
    flex: 1,
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.two + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Spacing.two,
  },
  scanBtn: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingBottom: Spacing.two,
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Density.compact.rowPaddingX,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  addBtn: {
    minHeight: CompactTouchTarget,
    minWidth: CompactTouchTarget + 28,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  empty: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  emptyCopy: {
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: Spacing.two,
    alignSelf: 'stretch',
  },
  createFooter: {
    paddingHorizontal: Density.compact.rowPaddingX,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  footer: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Density.compact.rowPaddingX,
    paddingVertical: Spacing.two,
  },
});
