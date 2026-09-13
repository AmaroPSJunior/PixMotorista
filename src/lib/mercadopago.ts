import { MercadoPagoPayment } from '../types';

export interface MercadoPagoStatusResponse {
  configured: boolean;
  hasAccessToken: boolean;
  hasPublicKey: boolean;
  webhookUrl: string;
  mode: 'production' | 'sandbox' | 'demonstration';
}

export async function fetchMercadoPagoStatus(): Promise<MercadoPagoStatusResponse> {
  try {
    const response = await fetch('/api/mercadopago/status');
    if (!response.ok) {
      throw new Error('Falha ao verificar status do Mercado Pago');
    }
    return await response.json();
  } catch (error) {
    console.warn('Erro ao consultar status do Mercado Pago:', error);
    return {
      configured: false,
      hasAccessToken: false,
      hasPublicKey: false,
      webhookUrl: typeof window !== 'undefined' ? `${window.location.origin}/api/mercadopago/webhook` : '',
      mode: 'demonstration',
    };
  }
}

export async function createMercadoPagoPixPayment(params: {
  amount: number;
  description?: string;
  payer?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    cpf?: string;
  };
  serviceId?: string;
  rideId?: string;
}): Promise<MercadoPagoPayment> {
  const response = await fetch('/api/mercadopago/create-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido ao gerar Pix' }));
    throw new Error(errorData.error || 'Erro ao comunicar com a API do Mercado Pago');
  }

  return await response.json();
}

export async function checkMercadoPagoPaymentStatus(paymentId: string): Promise<MercadoPagoPayment> {
  const response = await fetch(`/api/mercadopago/payment-status/${paymentId}`);
  if (!response.ok) {
    throw new Error('Falha ao consultar status do pagamento');
  }
  return await response.json();
}

export async function simulateMercadoPagoWebhook(paymentId: string, status: 'approved' | 'rejected' = 'approved'): Promise<{ success: boolean; message: string; payment: MercadoPagoPayment }> {
  const response = await fetch('/api/mercadopago/test-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentId, status }),
  });

  if (!response.ok) {
    throw new Error('Falha ao simular webhook');
  }

  return await response.json();
}
