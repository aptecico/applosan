export function expenseCode(id: string) {
  return id.replace(/-/g, '').slice(-6).toUpperCase();
}

export function moneySourceLabel(source: string) {
  if (source === 'cash_drawer') return 'Caja';
  if (source === 'bank') return 'Banco';
  if (source === 'other') return 'Otro';
  return source;
}

export function expenseStatusLabel(status: string) {
  if (status === 'posted') return 'Registrado';
  if (status === 'cancelled') return 'Anulado';
  return status;
}

export function expenseStatusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'posted') return 'success';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}
