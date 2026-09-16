/**
 * QA checklist — Phase final (Inventario / Ventas / Caja / Créditos)
 *
 * Ejecutar manualmente contra un tenant de prueba después de aplicar:
 * - 20260915120000_phase4_sales_cash.sql
 * - 20260915140000_phase4_hardening.sql
 *
 * Marcar PASS / FAIL. No automatizado en CI aún.
 */

export type QaResult = 'PASS' | 'FAIL' | 'SKIP';

export const QA_CASES = [
  {
    id: 'cash-closed-blocks',
    title: 'Caja cerrada bloquea venta, abono, ingreso y retiro',
    expect: 'Mensaje amigable: Debes abrir la caja…',
  },
  {
    id: 'cash-open-sale',
    title: 'Apertura 200k + venta efectivo 100k → esperado 300k',
    expect: 'cash_session_summary.expected_cash = 300000',
  },
  {
    id: 'transfer-with-ref',
    title: 'Venta transferencia con referencia',
    expect: 'Venta creada, ref guardada, expected_cash no sube',
  },
  {
    id: 'transfer-without-ref',
    title: 'Transferencia sin referencia rechazada FE+BE',
    expect: 'Ingresa la referencia de la transferencia.',
  },
  {
    id: 'credit-sale',
    title: 'Venta crédito crea receivable sin mover efectivo',
    expect: 'balance = total; expected_cash sin cambio por crédito',
  },
  {
    id: 'credit-payment',
    title: 'Abono parcial reduce saldo',
    expect: '500k → abono 100k → saldo 400k',
  },
  {
    id: 'credit-overpay',
    title: 'Abono mayor al saldo rechazado',
    expect: 'El abono no puede ser mayor al saldo pendiente.',
  },
  {
    id: 'credit-overdue',
    title: 'Crédito con due_at pasado → overdue; saldo 0 → paid',
    expect: 'sync_overdue_receivables al listar',
  },
  {
    id: 'cash-in',
    title: 'Ingreso 50k aumenta esperado',
    expect: '200k + 50k = 250k',
  },
  {
    id: 'cash-out',
    title: 'Retiro 50k disminuye esperado',
    expect: '250k - 50k = 200k',
  },
  {
    id: 'cash-out-over',
    title: 'Retiro mayor al efectivo disponible rechazado',
    expect: 'No hay suficiente efectivo disponible.',
  },
  {
    id: 'close-even',
    title: 'Cierre cuadrado',
    expect: 'difference = 0',
  },
  {
    id: 'close-short',
    title: 'Faltante exige motivo',
    expect: 'Motivo obligatorio',
  },
  {
    id: 'close-over',
    title: 'Sobrante exige motivo',
    expect: 'Motivo obligatorio',
  },
  {
    id: 'inventory-fifo',
    title: 'Compra sube stock; venta baja stock',
    expect: 'inventory_balances / inventory_movements coherentes',
  },
  {
    id: 'min-stock',
    title: 'min_stock real en badge / bienvenida / picker',
    expect: '4/5 bajo; 4/3 normal; 0 sin stock',
  },
  {
    id: 'rls-tenant',
    title: 'Tenant A no ve datos de Tenant B',
    expect: 'RLS en sales/cash/receivables/products',
  },
  {
    id: 'permissions',
    title: 'Seller sin dashboard no falla; sin sales.create no vende',
    expect: 'Bienvenida usable; RPC rechaza sin permiso',
  },
  {
    id: 'theme-mobile',
    title: 'Light/Dark + anchos 320–414',
    expect: 'Sin overflow; contraste OK',
  },
] as const;
