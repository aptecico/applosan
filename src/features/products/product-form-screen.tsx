import { StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { ProductEditor } from '@/features/products/product-editor';

export function ProductFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <Screen>
      <ProductEditor
        productId={id}
        onCancel={() => router.back()}
        onSaved={() => router.replace('/products' as Href)}
      />
    </Screen>
  );
}
