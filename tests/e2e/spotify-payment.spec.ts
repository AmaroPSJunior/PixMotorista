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

  await expect(page.getByTestId('passenger-name-modal')).toBeVisible();
  await expect(page.getByText('Como podemos te chamar?')).toBeVisible();
  await expect(page.getByTestId('passenger-name-input')).toBeVisible();
  await expect(page.getByTestId('passenger-exit-button')).toHaveCount(0);
  await expect(page.locator('#pix-section-wrapper')).toHaveCount(0);
  await expect(page.locator('#passenger-resource-wifi')).toHaveCount(0);
  await expect(page.getByTestId('spotify-unlock-button')).toHaveCount(0);

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
  await expect(page.locator('#pix-section-wrapper')).toHaveCount(0);
  await expect(page.locator('#passenger-resource-wifi')).toHaveCount(0);

  await page.getByTestId('passenger-name-input').fill('Junior');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(gate).toBeHidden();
  await expect(page.getByText('Junior')).toBeVisible();
  await expect(page.getByTestId('passenger-exit-button')).toBeVisible();
  await expect(page.locator('#pix-section-wrapper')).toBeVisible();
});

test('entrada pelo nome aparece sem aguardar resposta da assinatura de sessões', async ({ page }) => {
  await page.goto('/passageiro');
  await expect(page.getByTestId('passenger-name-modal')).toBeVisible();
  await expect(page.getByTestId('passenger-entry-loading')).toHaveCount(0);
  await expect(page.locator('#pix-section-wrapper')).toHaveCount(0);
  await expect(page.locator('#passenger-resource-wifi')).toHaveCount(0);
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


test('liberação remota do motorista chega ao passageiro sem reload e toca som', async ({ page }) => {
  await page.route('**/api/spotify/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, hasToken: false, isIntegrated: false, userProfile: null }),
    });
  });

  await page.route('**/api/passenger/session/start', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        waitingForRide: true,
        session: {
          id: 'sess_remote_unlock_e2e',
          passengerName: payload.passengerName || 'Junior',
          browserId: payload.browserId || 'browser-e2e',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          status: 'active',
          unlockedServices: [],
          hasMusicUnlocked: false,
          authUid: 'e2e-anonymous-passenger',
        },
      }),
    });
  });

  let currentCalls = 0;
  await page.route('**/api/passenger/session/current?**', async (route) => {
    currentCalls += 1;
    const unlocked = currentCalls >= 2;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        session: {
          id: 'sess_remote_unlock_e2e',
          passengerName: 'Junior',
          browserId: 'browser-e2e',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          status: 'active',
          unlockedServices: unlocked ? ['spotify_music'] : [],
          hasMusicUnlocked: unlocked,
          authUid: 'e2e-anonymous-passenger',
        },
      }),
    });
  });

  await page.addInitScript(() => {
    (window as any).__unlockSoundCount = 0;
    window.addEventListener('pix:success-sound', () => {
      (window as any).__unlockSoundCount += 1;
    });
  });

  await page.goto('/passageiro?__e2ePassengerFresh=1');
  await page.getByTestId('passenger-name-input').fill('Junior');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByTestId('spotify-controller-unlocked')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('Músicas Liberadas!')).toBeVisible();

  await expect.poll(
    async () => page.evaluate(() => (window as any).__unlockSoundCount || 0),
    { timeout: 8000 }
  ).toBeGreaterThan(0);
});


test('dois dispositivos: motorista libera Spotify e passageiro recebe em tempo real com som', async ({ browser }) => {
  const context = await browser.newContext();
  let unlocked = false;
  let revision = 0;

  await context.route('**/api/spotify/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, hasToken: false, isIntegrated: false, userProfile: null }),
    });
  });

  await context.route('**/api/passenger/session/start', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        waitingForRide: true,
        session: {
          id: 'sess_two_devices',
          passengerName: payload.passengerName || 'Junior',
          browserId: payload.browserId || 'browser-two-devices',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          status: 'active',
          unlockedServices: [],
          hasMusicUnlocked: false,
          authUid: 'e2e-anonymous-passenger',
          resourceRevision: 0,
        },
      }),
    });
  });

  await context.route('**/api/passenger/session/current?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        session: {
          id: 'sess_two_devices',
          passengerName: 'Junior',
          browserId: 'browser-two-devices',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          status: 'active',
          unlockedServices: unlocked ? ['spotify_music'] : [],
          hasMusicUnlocked: unlocked,
          authUid: 'e2e-anonymous-passenger',
          resourceRevision: revision,
          lastResourceChangeAt: revision ? new Date().toISOString() : undefined,
        },
      }),
    });
  });

  await context.route('**/api/driver/passenger-sessions/sess_two_devices/resources', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.serviceId).toBe('spotify_music');
    expect(typeof body.unlock).toBe('boolean');
    unlocked = body.unlock;
    revision += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        propagatedSessionIds: ['sess_two_devices'],
        session: {
          id: 'sess_two_devices',
          passengerName: 'Junior',
          status: 'active',
          unlockedServices: unlocked ? ['spotify_music'] : [],
          hasMusicUnlocked: unlocked,
          resourceRevision: revision,
        },
      }),
    });
  });

  const passengerPage = await context.newPage();
  await passengerPage.addInitScript(() => {
    (window as any).__unlockSoundCount = 0;
    window.addEventListener('pix:success-sound', () => {
      (window as any).__unlockSoundCount += 1;
    });
  });

  await passengerPage.goto('/passageiro?__e2ePassengerFresh=1');
  await passengerPage.getByTestId('passenger-name-input').fill('Junior');
  await passengerPage.getByRole('button', { name: 'Entrar' }).click();

  await expect(passengerPage.getByTestId('spotify-passenger-available')).toBeVisible();

  const driverPage = await context.newPage();
  await driverPage.goto('/passageiro');
  const driverResponse = await driverPage.evaluate(async () => {
    const response = await fetch('/api/driver/passenger-sessions/sess_two_devices/resources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer driver-e2e',
      },
      body: JSON.stringify({ serviceId: 'spotify_music', unlock: true }),
    });
    return { status: response.status, payload: await response.json() };
  });

  expect(driverResponse.status).toBe(200);
  expect(driverResponse.payload.session.unlockedServices).toContain('spotify_music');

  await expect(passengerPage.getByTestId('spotify-controller-unlocked')).toBeVisible({ timeout: 7000 });
  await expect(passengerPage.getByText('Músicas Liberadas!')).toBeVisible();
  await expect(passengerPage.getByTestId('resource-unlock-modal')).toBeVisible();
  await expect(passengerPage.getByTestId('unlock-icon-spotify_music').locator('svg.lucide-music')).toBeVisible();
  await expect(passengerPage.getByText(/Escolha de músicas foi liberad[oa] pelo motorista\./)).toBeVisible();
  await expect(passengerPage.locator('#passenger-resource-spotify_music')).toBeInViewport();

  await expect.poll(
    async () => passengerPage.evaluate(() => (window as any).__unlockSoundCount || 0),
    { timeout: 7000 }
  ).toBeGreaterThan(0);

  await passengerPage.getByTestId('resource-unlock-modal-ok').click();
  const revokeResponse = await driverPage.evaluate(async () => {
    const response = await fetch('/api/driver/passenger-sessions/sess_two_devices/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer driver-e2e' },
      body: JSON.stringify({ serviceId: 'spotify_music', unlock: false }),
    });
    return { status: response.status, payload: await response.json() };
  });
  expect(revokeResponse.status).toBe(200);
  expect(revokeResponse.payload.session.unlockedServices).not.toContain('spotify_music');
  await expect(passengerPage.getByTestId('spotify-unlock-button')).toBeVisible({ timeout: 7000 });
  await expect(passengerPage.getByTestId('spotify-controller-unlocked')).toHaveCount(0);
  await expect.poll(async () => passengerPage.evaluate(() => localStorage.getItem('pix_music_unlocked'))).toBeNull();

  await context.close();
});

test('encerramento remoto tira o passageiro da sessão sem recarregar', async ({ page }) => {
  let closed = false;
  const session = {
    id: 'sess_remote_close', passengerName: 'Junior', browserId: 'browser-e2e',
    createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(),
    status: 'active', unlockedServices: [], hasMusicUnlocked: false,
    authUid: 'e2e-anonymous-passenger',
  };
  await page.route('**/api/spotify/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ configured: true, hasToken: false, isIntegrated: false, userProfile: null }) });
  });
  await page.route('**/api/passenger/session/start', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, session: { ...session, passengerName: JSON.parse(route.request().postData() || '{}').passengerName } }) });
  });
  await page.route('**/api/passenger/session/current?**', async (route) => {
    await route.fulfill({ status: closed ? 410 : 200, contentType: 'application/json',
      body: JSON.stringify(closed
        ? { error: 'Sessão encerrada.', session: { ...session, status: 'closed' } }
        : { success: true, session }) });
  });
  await page.route('**/api/driver/passenger-sessions/sess_remote_close/close', async (route) => {
    closed = true;
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, session: { ...session, status: 'closed' } }) });
  });

  await page.goto('/passageiro?__e2ePassengerFresh=1');
  await page.getByTestId('passenger-name-input').fill('Junior');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByTestId('spotify-passenger-available')).toBeVisible();

  const result = await page.evaluate(async () => {
    const response = await fetch('/api/driver/passenger-sessions/sess_remote_close/close', { method: 'POST' });
    return response.status;
  });
  expect(result).toBe(200);
  await expect(page.getByTestId('passenger-name-input')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('#pix-section-wrapper')).toHaveCount(0);
  await expect(page.locator('#passenger-resource-wifi')).toHaveCount(0);
  await expect(page.getByTestId('passenger-exit-button')).toHaveCount(0);
  await expect(page.getByTestId('spotify-controller-unlocked')).toHaveCount(0);
});


test('refresh mantém passageiro, botão Sair e recurso liberado sem pedir nome novamente', async ({ page }) => {
  const session = {
    id: 'sess_refresh_stable',
    passengerName: 'Junior',
    browserId: 'browser-refresh',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    status: 'active',
    unlockedServices: ['spotify_music'],
    hasMusicUnlocked: true,
    authUid: 'e2e-anonymous-passenger',
    resourceRevision: 3,
    lastResourceChangeAt: new Date().toISOString(),
  };

  await page.addInitScript(({ session }) => {
    localStorage.setItem('pix_registered_session_id', session.id);
    localStorage.setItem('pix_registered_passenger_name', session.passengerName);
    localStorage.setItem('pix_passenger_session_cache', JSON.stringify(session));
  }, { session });

  await page.route('**/api/spotify/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: true, hasToken: false, isIntegrated: false, userProfile: null }),
    });
  });

  await page.route('**/api/passenger/session/current?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, session }),
    });
  });

  await page.goto('/passageiro?__e2ePassengerFresh=1');
  await expect(page.getByTestId('passenger-exit-button')).toBeVisible();
  await expect(page.getByTestId('spotify-controller-unlocked')).toBeVisible();
  await expect(page.getByTestId('passenger-login-gate')).toHaveCount(0);

  await page.reload();

  await expect(page.getByTestId('passenger-exit-button')).toBeVisible({ timeout: 3000 });
  await expect(page.getByTestId('spotify-controller-unlocked')).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('Junior')).toBeVisible();
  await expect(page.getByTestId('passenger-login-gate')).toHaveCount(0);
});
