import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DriverPixDashboard } from '../src/components/DriverPixDashboard';
import { DriverPixCheckout } from '../src/components/DriverPixCheckout';
import { DriverEditModal } from '../src/components/DriverEditModal';
import { DEFAULT_DRIVER_PROFILE } from '../src/data/defaultData';
import type { MercadoPagoPayment } from '../src/types';

const driver = { ...DEFAULT_DRIVER_PROFILE, name: 'Ana', pixKey: 'ana@example.com' };
const noop = () => {};

test('painel automotivo impede cobrança sem valor e preserva acesso às configurações', () => {
  const html = renderToStaticMarkup(React.createElement(DriverPixDashboard, {
    driver: { ...driver, pixKey: '' }, chargeAmount: 0, rideAmount: 25,
    passengerName: 'João', ridePaid: false, selectedServicesCount: 0,
    selectedTip: 0, onCharge: noop, onOpenSettings: noop,
  }));
  assert.match(html, /data-testid="driver-pix-automotive"/);
  assert.match(html, /Sem valor para cobrar/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Configure sua chave Pix/);
  assert.match(html, /Corrida pendente/);
});

test('configuração expõe escolha reversível com rótulo e estado acessíveis', () => {
  const renderSettings = (mode: 'legacy' | 'automotive') => renderToStaticMarkup(React.createElement(DriverEditModal, {
    isOpen: true, onClose: noop, driver: { ...driver, driverPixLayout: mode }, services: [],
    onSaveDriver: noop, onSaveServices: noop, onResetDefaults: noop,
  }));
  assert.match(renderSettings('legacy'), /role="switch"[^>]*aria-checked="false"/);
  assert.match(renderSettings('automotive'), /role="switch"[^>]*aria-checked="true"/);
});

const basePayment: MercadoPagoPayment = {
  paymentId: 'payment-1', amount: 12.5, description: 'Pix', status: 'pending',
};
const checkout = (payment: MercadoPagoPayment | null, loading = false, error: string | null = null) =>
  renderToStaticMarkup(React.createElement(DriverPixCheckout, {
    payment, amount: 12.5, qrImage: '', isLoading: loading, error,
    copiedCode: false, copyError: false, onCopyCode: noop, onClose: noop,
  }));

test('checkout comunica espera, confirmação real e falha em telas distintas', () => {
  assert.match(checkout(null, true), /data-testid="driver-pix-loading"/);
  assert.match(checkout(basePayment), /data-testid="driver-pix-waiting"/);
  assert.match(checkout({ ...basePayment, status: 'approved', paymentActivated: true }), /data-testid="driver-pix-confirmed"/);
  assert.match(checkout({ ...basePayment, status: 'rejected' }), /data-testid="driver-pix-failed"/);
  assert.match(checkout({ ...basePayment, status: 'cancelled' }), /Cobrança encerrada/);
  assert.doesNotMatch(checkout({ ...basePayment, status: 'pending', paymentActivated: true }), /Pagamento confirmado/);
});
