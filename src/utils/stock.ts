export type StockLevel = 'ok' | 'low' | 'out' | 'unknown';

/**
 * Single source of truth for stock thresholds.
 * - min_stock del producto si es > 0
 * - si no, default_min_stock del tenant si es > 0
 * - si ambos son 0/ausentes: solo distingue sin stock vs normal (nunca "bajo")
 */
export function resolveMinStock(
  productMinStock?: number | null,
  defaultMinStock?: number | null,
): number {
  if (productMinStock != null && productMinStock > 0) return productMinStock;
  if (defaultMinStock != null && defaultMinStock > 0) return defaultMinStock;
  return 0;
}

export function computeStockLevel(
  quantity?: number | null,
  minStock?: number | null,
): StockLevel {
  if (quantity == null || Number.isNaN(quantity)) return 'unknown';
  if (quantity <= 0) return 'out';
  const threshold = minStock ?? 0;
  if (threshold > 0 && quantity <= threshold) return 'low';
  return 'ok';
}

export function isLowStock(
  quantity?: number | null,
  minStock?: number | null,
): boolean {
  return computeStockLevel(quantity, minStock) === 'low';
}
