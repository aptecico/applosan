import '@/global.css';

import { Platform } from 'react-native';

/**
 * Semantic color tokens — designed for light and dark independently.
 * Prefer these names over raw hex in UI components.
 */
export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    background: '#F1F5F9',
    backgroundElement: '#F8FAFC',
    backgroundSelected: '#E2E8F0',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    primary: '#0F766E',
    onPrimary: '#FFFFFF',
    accent: '#0F766E',
    onAccent: '#FFFFFF',
    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    destructive: '#DC2626',
    onDestructive: '#FFFFFF',
    success: '#059669',
    warning: '#D97706',
    info: '#2563EB',
    overlay: 'rgba(15, 23, 42, 0.45)',
  },
  dark: {
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    background: '#0B1220',
    backgroundElement: '#1E293B',
    backgroundSelected: '#334155',
    surface: '#111827',
    surfaceElevated: '#1E293B',
    primary: '#2DD4BF',
    onPrimary: '#042F2E',
    accent: '#2DD4BF',
    onAccent: '#042F2E',
    border: '#1F2937',
    borderSubtle: '#1E293B',
    destructive: '#F87171',
    onDestructive: '#450A0A',
    success: '#34D399',
    warning: '#FBBF24',
    info: '#60A5FA',
    overlay: 'rgba(2, 6, 23, 0.65)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

/**
 * Density scale — use Compact for lists/catalogs, Comfortable for forms/detail,
 * Spacious only for welcome/dashboard/empty states.
 */
export const Density = {
  compact: {
    gap: 4,
    sectionGap: 8,
    cardPadding: 12,
    rowPaddingY: 8,
    rowPaddingX: 12,
    listItemMinHeight: 56,
    headerGap: 8,
  },
  comfortable: {
    gap: 8,
    sectionGap: 16,
    cardPadding: 16,
    rowPaddingY: 12,
    rowPaddingX: 16,
    listItemMinHeight: 72,
    headerGap: 12,
  },
  spacious: {
    gap: 12,
    sectionGap: 24,
    cardPadding: 24,
    rowPaddingY: 16,
    rowPaddingX: 20,
    listItemMinHeight: 88,
    headerGap: 16,
  },
} as const;

export type DensityName = keyof typeof Density;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
export const MinTouchTarget = 44;
/** Compact control height — still tappable, denser than MinTouchTarget. */
export const CompactTouchTarget = 36;
