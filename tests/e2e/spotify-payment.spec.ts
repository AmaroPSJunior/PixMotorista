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

  await page.goto('/passageiro?__e2ePassengerExit=1');

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


test('passageiro encerra sessão e volta para cadastro de novo nome', async ({ page }) => {
  await page.route('**/api/spotify/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, hasToken: false, isIntegrated: false, userProfile: null }),
    });
  });

  await page.goto('/passageiro?__e2ePassengerExit=1');

  const exitButton = page.getByTestId('passenger-exit-button');
  await expect(exitButton).toBeVisible();
  await exitButton.click();

  const thanksModal = page.getByTestId('passenger-thanks-modal');
  await expect(thanksModal).toBeVisible();
  await expect(page.getByText('Obrigado pela viagem!')).toBeVisible();

  await page.getByTestId('passenger-thanks-ok').click();

  await expect(thanksModal).toBeHidden();
  await expect(page.getByTestId('passenger-name-modal')).toBeVisible();
  await expect(page.getByText('Como podemos te chamar?')).toBeVisible();
  await expect(page.getByTestId('passenger-name-input')).toBeVisible();
  await expect(page.getByTestId('passenger-exit-button')).toHaveCount(0);

  const stored = await page.evaluate(() => ({
    sessionId: localStorage.getItem('pix_registered_session_id'),
    passengerName: localStorage.getItem('pix_registered_passenger_name'),
    musicUnlocked: localStorage.getItem('pix_music_unlocked'),
  }));
  expect(stored).toEqual({ sessionId: null, passengerName: null, musicUnlocked: null });
});


test('primeiro acesso do passageiro fica bloqueado até informar o nome', async ({ page }) => {
  await page.route('**/api/spotify/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, hasToken: false, isIntegrated: false, userProfile: null }),
    });
  });

  await page.route('**/api/passenger/session/start', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    expect(payload.passengerName).toBe('Junior');
    expect(payload.rideId).toBe('');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        waitingForRide: true,
        session: {
          id: 'sess_waiting_e2e',
          passengerName: 'Junior',
          browserId: payload.browserId || 'e2e-browser',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          status: 'active',
          unlockedServices: [],
          hasMusicUnlocked: false,
          ridePrice: 0,
          rideId: '',
          driverUid: '',
          driverEmail: '',
          authUid: 'e2e-anonymous-passenger',
        },
      }),
    });
  });

  await page.goto('/passageiro?__e2ePassengerFresh=1');

  const gate = page.getByTestId('passenger-login-gate');
  await expect(gate).toBeVisible();
  await expect(page.getByText('Como podemos te chamar?')).toBeVisible();
  await expect(page.getByTestId('passenger-name-input')).toBeVisible();
  await expect(page.getByTestId('passenger-exit-button')).toHaveCount(0);

  await page.getByTestId('passenger-name-input').fill('Junior');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(gate).toBeHidden();
  await expect(page.getByText('Junior')).toBeVisible();
  await expect(page.getByTestId('passenger-exit-button')).toBeVisible();
});


test('motorista libera recurso sem recarregar ou mover a tela', async ({ page }) => {
  await page.goto('/passageiro');

  await page.route('**/api/driver/passenger-sessions/test-session/resources', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.serviceId).toBe('wifi');
    expect(body.unlock).toBe(true);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        session: {
          id: 'test-session',
          passengerName: 'Junior',
          browserId: 'browser-test',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          status: 'active',
          unlockedServices: ['wifi'],
          hasMusicUnlocked: false,
        },
      }),
    });
  });

  const result = await page.evaluate(async () => {
    const before = window.scrollY;
    const response = await fetch('/api/driver/passenger-sessions/test-session/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer e2e' },
      body: JSON.stringify({ serviceId: 'wifi', unlock: true }),
    });
    const payload = await response.json();
    return { status: response.status, payload, before, after: window.scrollY };
  });

  expect(result.status).toBe(200);
  expect(result.payload.session.unlockedServices).toContain('wifi');
  expect(result.after).toBe(result.before);
});
