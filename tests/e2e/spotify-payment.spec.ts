import { expect, test } from '@playwright/test';

test('passageiro paga/simula e Spotify é liberado imediatamente', async ({ page }) => {
  await page.route('**/api/spotify/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: true,
        hasToken: false,
        isIntegrated: false,
        userProfile: null,
      }),
    });
  });

  await page.route('**/api/mercadopago/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: true,
        hasAccessToken: true,
        hasPublicKey: true,
        webhookUrl: 'http://127.0.0.1:4173/api/mercadopago/webhook',
        mode: 'sandbox',
      }),
    });
  });

  await page.route('**/api/mercadopago/create-payment', async (route) => {
    const request = route.request();
    const payload = JSON.parse(request.postData() || '{}');

    expect(payload.serviceIds).toContain('spotify_music');

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        paymentId: 'E2E_SPOTIFY_1',
        amount: 2,
        description: payload.description,
        status: 'pending',
        statusDetail: 'pending_waiting_transfer',
        qrCode: '000201E2E',
        qrCodeBase64: '',
        serviceIds: payload.serviceIds,
        passengerSessionId: payload.passengerSessionId || '',
        paymentActivated: false,
      }),
    });
  });

  await page.route('**/api/mercadopago/test-webhook', async (route) => {
    const request = route.request();
    const payload = JSON.parse(request.postData() || '{}');

    expect(payload.paymentId).toBe('E2E_SPOTIFY_1');
    expect(payload.status).toBe('approved');
    expect(payload.serviceIds).toContain('spotify_music');

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Webhook simulado com sucesso!',
        payment: {
          paymentId: payload.paymentId,
          amount: 2,
          status: 'approved',
          statusDetail: 'accredited',
          paymentActivated: true,
          simulated: true,
          serviceIds: payload.serviceIds,
          passengerSessionId: payload.passengerSessionId || '',
        },
      }),
    });
  });

  await page.goto('/passageiro');

  const unlockButton = page.getByTestId('spotify-unlock-button');
  await expect(unlockButton).toBeVisible();
  await unlockButton.click();

  const modal = page.getByTestId('mercadopago-modal');
  await expect(modal).toBeVisible();

  const simulateButton = page.getByTestId('simulate-webhook-button');
  await expect(simulateButton).toBeVisible();
  await simulateButton.click();

  await expect(modal).toBeHidden();
  await expect(page.getByTestId('spotify-controller-unlocked')).toBeVisible();
  await expect(page.getByText('Músicas Liberadas!')).toBeVisible();
  await expect(page.getByTestId('spotify-unlock-button')).toHaveCount(0);
});
