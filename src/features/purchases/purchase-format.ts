import type { PurchaseStatus } from '@/types/catalog';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const shortDateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatMoneyCOP(value: number) {
  return moneyFormatter.format(value);
}

export function formatPurchaseDate(value: string | Date) {
  return shortDateFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatPurchaseDateTime(value: string | Date) {
  return dateTimeFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

/** Display code when there is no sequential purchase number. */
export function purchaseCode(id: string) {
  return id.replace(/-/g, '').slice(-6).toUpperCase();
}

export function purchaseTitle(id: string, reference?: string | null) {
  if (reference?.trim()) return `Compra ${reference.trim()}`;
  return `Compra #${purchaseCode(id)}`;
}

export function purchaseStatusLabel(status: PurchaseStatus | string) {
  if (status === 'received') return 'Registrada';
  if (status === 'draft') return 'Borrador';
  if (status === 'cancelled') return 'Anulada';
  return status;
}

export function purchaseStatusTone(
  status: PurchaseStatus | string,
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'received') return 'success';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

export function productLabel(product: {
  name: string;
  sku?: string | null;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
}) {
  const details = [product.brand, product.color, product.size ? `Talla ${product.size}` : null]
    .filter(Boolean)
    .join(' · ');
  return details ? `${product.name} (${details})` : product.name;
}

export function productMetaLine(product: {
  sku?: string | null;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
}) {
  return [
    product.sku ? product.sku : null,
    product.brand,
    product.size ? `Talla ${product.size}` : null,
    product.color,
  ]
    .filter(Boolean)
    .join(' · ');
}
