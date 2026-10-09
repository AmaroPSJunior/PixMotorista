import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  driverPixPaymentPhase,
  formatPixAmount,
  normalizeDriverPixLayout,
} from '../src/domain/driverPixLayout.ts';
import type { MercadoPagoPayment } from '../src/types.ts';

const payment = (status: MercadoPagoPayment['status'], paymentActivated = false): MercadoPagoPayment => ({
  paymentId: 'payment-1', amount: 12.5, description: 'Pix', status, paymentActivated,
});

test('preferência antiga é o padrão; somente o valor automotivo ativa o novo layout', () => {
  assert.equal(normalizeDriverPixLayout(undefined), 'legacy');
  assert.equal(normalizeDriverPixLayout('legacy'), 'legacy');
  assert.equal(normalizeDriverPixLayout('automotive'), 'automotive');
  assert.equal(normalizeDriverPixLayout('valor-inválido'), 'legacy');
});

test('a confirmação exige pagamento aprovado e ativado pelo servidor', () => {
  assert.equal(driverPixPaymentPhase(payment('approved', true), false, null), 'confirmed');
  assert.equal(driverPixPaymentPhase(payment('approved'), false, null), 'waiting');
  assert.equal(driverPixPaymentPhase(payment('pending', true), false, null), 'waiting');
});

test('cobrança distingue espera, falha, cancelamento e carregamento', () => {
  assert.equal(driverPixPaymentPhase(null, false, null), 'idle');
  assert.equal(driverPixPaymentPhase(null, true, null), 'loading');
  assert.equal(driverPixPaymentPhase(null, false, 'Sem conexão'), 'error');
  assert.equal(driverPixPaymentPhase(payment('pending'), false, null), 'waiting');
  assert.equal(driverPixPaymentPhase(payment('in_process'), false, null), 'waiting');
  assert.equal(driverPixPaymentPhase(payment('rejected'), false, null), 'error');
  for (const status of ['cancelled', 'refunded', 'charged_back'] as const) {
    assert.equal(driverPixPaymentPhase(payment(status), false, null), 'cancelled');
  }
});

test('valor é exibido em reais e nunca mostra número inválido', () => {
  assert.equal(formatPixAmount(12.5), 'R$ 12,50');
  assert.equal(formatPixAmount(Number.NaN), 'R$ 0,00');
  assert.equal(formatPixAmount(-5), 'R$ 0,00');
});
