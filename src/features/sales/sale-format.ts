import type { PaymentMethod, ReceivableStatus, SaleStatus } from '@/types/commerce';

export function saleCode(id: string) {
  return id.replace(/-/g, '').slice(-6).toUpperCase();
}

export function saleTitle(id: string) {
  return `Venta #${saleCode(id)}`;
}

export function paymentMethodLabel(method: PaymentMethod | string) {
  if (method === 'cash') return 'Efectivo';
  if (method === 'transfer') return 'Transferencia';
  if (method === 'credit') return 'Crédito';
  return method;
}

export function saleStatusLabel(status: SaleStatus | string) {
  if (status === 'completed') return 'Completada';
  if (status === 'cancelled') return 'Anulada';
  return status;
}

export function saleStatusTone(
  status: SaleStatus | string,
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

export function receivableStatusLabel(status: ReceivableStatus | string) {
  if (status === 'pending') return 'Pendiente';
  if (status === 'partial') return 'Parcial';
  if (status === 'paid') return 'Pagado';
  if (status === 'overdue') return 'Vencido';
  return status;
}

export function receivableStatusTone(
  status: ReceivableStatus | string,
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'paid') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'overdue') return 'danger';
  return 'neutral';
}
