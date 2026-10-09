import type { DriverPixLayout, MercadoPagoPayment } from '../types';

export type DriverPixPaymentPhase =
  | 'idle'
  | 'loading'
  | 'waiting'
  | 'confirmed'
  | 'cancelled'
  | 'error';

export function normalizeDriverPixLayout(value: unknown): DriverPixLayout {
  return value === 'automotive' ? 'automotive' : 'legacy';
}

export function driverPixPaymentPhase(
  payment: MercadoPagoPayment | null,
  isLoading: boolean,
  error: string | null
): DriverPixPaymentPhase {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (!payment) return 'idle';
  if (payment.status === 'cancelled' || payment.status === 'refunded' || payment.status === 'charged_back') {
    return 'cancelled';
  }
  if (payment.status === 'rejected') return 'error';
  if (payment.status === 'approved' && payment.paymentActivated === true) return 'confirmed';
  return 'waiting';
}

export const formatPixAmount = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(value) ? Math.max(0, value) : 0
  );
