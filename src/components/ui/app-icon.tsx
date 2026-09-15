import { SymbolView } from 'expo-symbols';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { ThemeColor } from '@/constants/theme';

/** Semantic icon names used across the app. Maps to SF Symbols / Material. */
export type AppIconName =
  | 'eye'
  | 'pencil'
  | 'trash'
  | 'ban'
  | 'search'
  | 'plus'
  | 'save'
  | 'moreVertical'
  | 'history'
  | 'download'
  | 'filter'
  | 'settings'
  | 'close'
  | 'package'
  | 'building'
  | 'chevronRight'
  | 'check'
  | 'barcode';

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  themeColor?: ThemeColor;
  style?: StyleProp<ViewStyle>;
};

const ICON_MAP = {
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  pencil: { ios: 'pencil', android: 'edit', web: 'edit' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  ban: { ios: 'nosign', android: 'block', web: 'block' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  save: { ios: 'square.and.arrow.down', android: 'save', web: 'save' },
  moreVertical: { ios: 'ellipsis', android: 'more_vert', web: 'more_vert' },
  history: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
  download: { ios: 'arrow.down.circle', android: 'download', web: 'download' },
  filter: { ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  package: { ios: 'shippingbox', android: 'inventory_2', web: 'inventory_2' },
  building: { ios: 'building.2', android: 'business', web: 'business' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  barcode: { ios: 'barcode', android: 'qr_code_scanner', web: 'qr_code_scanner' },
} as const;

export function AppIcon({ name, size = 20, color, themeColor = 'text', style }: AppIconProps) {
  const theme = useTheme();
  const tint = color ?? theme[themeColor];

  return (
    <SymbolView
      name={ICON_MAP[name]}
      size={size}
      tintColor={tint}
      weight="medium"
      style={[styles.icon, { width: size, height: size }, style]}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
