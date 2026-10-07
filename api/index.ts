import crypto from 'crypto';
import app from '../server';

const result = (ok: boolean, detail: string, level: 'ok' | 'warning' | 'error' = ok ? 'ok' : 'error') => ({ ok, level, detail });

async function testEnvironment() {
  const checks: Record<string, any> = {};

  const appUrl = (process.env.APP_URL || '').trim();
  if (!appUrl) {
    checks.APP_URL = result(false, 'Não configurada.');
  } else {
    try {
      const url = new URL(appUrl);
      const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
      checks.APP_URL = result(response.ok, `URL válida; HTTP ${response.status}.`);
    } catch {
      checks.APP_URL = result(false, 'Valor inválido ou URL inacessível.');
    }
  }

  const spotifyId = (process.env.SPOTIFY_CLIENT_ID || '').trim();
  const spotifySecret = (process.env.SPOTIFY_CLIENT_SECRET || '').trim();
  if (!spotifyId || !spotifySecret) {
    const detail = 'Par CLIENT_ID/CLIENT_SECRET incompleto.';
    checks.SPOTIFY_CLIENT_ID = result(false, detail);
    checks.SPOTIFY_CLIENT_SECRET = result(false, detail);
  } else {
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${spotifyId}:${spotifySecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      const ok = response.ok;
      const detail = ok ? 'Credenciais aceitas pelo Spotify.' : `Spotify recusou as credenciais (HTTP ${response.status}).`;
      checks.SPOTIFY_CLIENT_ID = result(ok, detail);
      checks.SPOTIFY_CLIENT_SECRET = result(ok, detail);
    } catch {
      const detail = 'Falha de rede ao validar no Spotify.';
      checks.SPOTIFY_CLIENT_ID = result(false, detail);
      checks.SPOTIFY_CLIENT_SECRET = result(false, detail);
    }
  }

  const mpToken = (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();
  if (!mpToken) {
    checks.MERCADO_PAGO_ACCESS_TOKEN = result(false, 'Não configurada.');
  } else {
    try {
      const response = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      checks.MERCADO_PAGO_ACCESS_TOKEN = result(
        response.ok,
        response.ok ? 'Token aceito pelo Mercado Pago.' : `Mercado Pago recusou o token (HTTP ${response.status}).`
      );
    } catch {
      checks.MERCADO_PAGO_ACCESS_TOKEN = result(false, 'Falha de rede ao validar no Mercado Pago.');
    }
  }

  const mpPublicKey = (process.env.MERCADO_PAGO_PUBLIC_KEY || '').trim();
  checks.MERCADO_PAGO_PUBLIC_KEY = mpPublicKey
    ? result(true, 'Configurada. Chave pública não possui endpoint de autenticação isolada; presença validada.', 'warning')
    : result(false, 'Não configurada.');

  const webhookSecret = (process.env.MERCADO_PAGO_WEBHOOK_SECRET || '').trim();
  checks.MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret
    ? result(true, 'Configurada. O segredo é validado quando uma assinatura real de webhook chega.', 'warning')
    : result(false, 'Não configurada.');

  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!geminiKey) {
    checks.GEMINI_API_KEY = result(false, 'Não configurada.');
  } else {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': geminiKey },
      });
      checks.GEMINI_API_KEY = result(
        response.ok,
        response.ok ? 'Chave aceita pela API Gemini.' : `Gemini recusou a chave (HTTP ${response.status}).`
      );
    } catch {
      checks.GEMINI_API_KEY = result(false, 'Falha de rede ao validar na API Gemini.');
    }
  }

  const firebaseRaw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!firebaseRaw) {
    checks.FIREBASE_SERVICE_ACCOUNT_JSON = result(false, 'Não configurada.');
  } else {
    try {
      const serviceAccount = JSON.parse(firebaseRaw);
      const required = serviceAccount.client_email && serviceAccount.private_key && serviceAccount.project_id;
      if (!required) throw new Error('campos ausentes');

      const now = Math.floor(Date.now() / 1000);
      const encode = (value: any) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/datastore',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })}`;
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(unsigned);
      signer.end();
      const jwt = `${unsigned}.${signer.sign(serviceAccount.private_key).toString('base64url')}`;

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });
      checks.FIREBASE_SERVICE_ACCOUNT_JSON = result(
        response.ok,
        response.ok ? 'Service Account autenticada pelo Google.' : `Google recusou a Service Account (HTTP ${response.status}).`
      );
    } catch {
      checks.FIREBASE_SERVICE_ACCOUNT_JSON = result(false, 'JSON inválido, incompleto ou credencial rejeitada.');
    }
  }

  return {
    ok: Object.values(checks).every((item: any) => item.ok),
    checkedAt: new Date().toISOString(),
    checks,
  };
}

export default async function handler(req: any, res: any) {
  const { __path, __route, ...rest } = req.query || {};
  const rawPath = Array.isArray(__path) ? __path.join('/') : String(__path || '');

  if (rawPath.replace(/^\/+/, '') === 'health/env') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    return res.status(200).json(await testEnvironment());
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else if (value !== undefined) params.append(key, String(value));
  }

  const route = __route === 'auth-callback'
    ? '/auth/callback'
    : '/api/' + rawPath.replace(/^\/+/, '');
  const query = params.toString();
  req.url = query ? route + '?' + query : route;

  return app(req, res);
}
