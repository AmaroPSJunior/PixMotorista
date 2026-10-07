import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { applicationDefault, cert, getApps as getAdminApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import QRCode from 'qrcode';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const CANONICAL_APP_URL = (process.env.CANONICAL_APP_URL || 'https://pix-motorista.vercel.app').replace(/\/$/, '');
const LEGACY_BRIDGE_HOSTS = new Set([
  'pagamento-pix-motorista.ai.studio',
]);

function isLegacyBridgeHost(req: express.Request): boolean {
  const rawHost = (req.get('host') || '').toLowerCase();
  const hostname = rawHost.split(':')[0];
  return LEGACY_BRIDGE_HOSTS.has(hostname);
}

app.use('/api/mercadopago/webhook', async (req, res, next) => {
  if (!isLegacyBridgeHost(req)) return next();

  try {
    const targetUrl = `${CANONICAL_APP_URL}${req.originalUrl}`;
    const headers: Record<string, string> = {
      'Content-Type': req.get('content-type') || 'application/json',
      'X-Legacy-Bridge': 'google-ai-studio',
    };

    const signature = req.get('x-signature');
    const requestId = req.get('x-request-id');
    const userAgent = req.get('user-agent');
    if (signature) headers['x-signature'] = signature;
    if (requestId) headers['x-request-id'] = requestId;
    if (userAgent) headers['user-agent'] = userAgent;

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body || {}),
      redirect: 'manual',
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    res.setHeader('x-legacy-bridge-target', CANONICAL_APP_URL);
    return res.status(upstream.status).send(body);
  } catch (error) {
    console.error('Falha ao encaminhar webhook legado para a Vercel:', error);
    return res.status(502).json({
      error: 'Falha temporária ao encaminhar webhook para o ambiente principal.',
    });
  }
});

// Server-side Firestore uses Firebase Admin, which bypasses client security rules.
// Configure FIREBASE_SERVICE_ACCOUNT_JSON or Application Default Credentials in production.
let db: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const serviceAccountJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    const credential = serviceAccountJson
      ? cert(JSON.parse(serviceAccountJson))
      : applicationDefault();

    const firebaseAdminApp =
      getAdminApps().length === 0
        ? initializeAdminApp({ credential, projectId: firebaseConfig.projectId })
        : getAdminApps()[0];

    db = firebaseConfig.firestoreDatabaseId
      ? getAdminFirestore(firebaseAdminApp, firebaseConfig.firestoreDatabaseId)
      : getAdminFirestore(firebaseAdminApp);

    console.log('✅ Firestore Admin inicializado no servidor.');
  }
} catch (e) {
  console.warn('Firestore Admin indisponível; persistência remota do servidor ficará desativada:', e);
}

const doc = (database: any, collectionName: string, documentId: string) =>
  database.collection(collectionName).doc(documentId);
const setDoc = (ref: any, data: any, options?: any) =>
  options ? ref.set(data, options) : ref.set(data);
const deleteDoc = (ref: any) => ref.delete();
const getDoc = async (ref: any) => {
  const snapshot = await ref.get();
  return {
    exists: () => snapshot.exists,
    data: () => snapshot.data(),
  };
};

const SPOTIFY_SESSION_FILE = path.join(process.cwd(), 'spotify_session.json');
const SPOTIFY_DOC_ID = 'main_session';

// Session store initialized in memory and synced with Firestore
let spotifySession: {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  userProfile?: any;
} = {};

async function saveSpotifySession(session: typeof spotifySession) {
  spotifySession = session;
  try {
    fs.writeFileSync(SPOTIFY_SESSION_FILE, JSON.stringify(session, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Erro ao salvar spotify_session.json local:', e);
  }

  if (db) {
    try {
      const docRef = doc(db, 'spotify_sessions', SPOTIFY_DOC_ID);
      await setDoc(docRef, {
        accessToken: session.accessToken || null,
        refreshToken: session.refreshToken || null,
        expiresAt: session.expiresAt || null,
        userProfile: session.userProfile || null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      console.log('✅ Sessão do Spotify salva e sincronizada no Firestore!');
    } catch (e) {
      console.error('Erro ao salvar sessão do Spotify no Firestore:', e);
    }
  }
}

async function loadSpotifySession() {
  // 1. First attempt to load from shared Firestore database
  if (db) {
    try {
      const docRef = doc(db, 'spotify_sessions', SPOTIFY_DOC_ID);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.accessToken || data.refreshToken) {
          spotifySession = {
            accessToken: data.accessToken || undefined,
            refreshToken: data.refreshToken || undefined,
            expiresAt: data.expiresAt || undefined,
            userProfile: data.userProfile || undefined,
          };
          console.log('✅ Sessão do Spotify sincronizada do Firestore com sucesso!');
          return;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler sessão do Spotify do Firestore:', e);
    }
  }

  // 2. Fallback to local file cache
  try {
    if (fs.existsSync(SPOTIFY_SESSION_FILE)) {
      const data = fs.readFileSync(SPOTIFY_SESSION_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && (parsed.accessToken || parsed.refreshToken)) {
        spotifySession = parsed;
        console.log('✅ Sessão do Spotify carregada do arquivo local.');
      }
    }
  } catch (e) {
    console.warn('Erro ao ler spotify_session.json:', e);
  }
}

async function clearSpotifySession() {
  spotifySession = {};
  try {
    if (fs.existsSync(SPOTIFY_SESSION_FILE)) {
      fs.unlinkSync(SPOTIFY_SESSION_FILE);
    }
  } catch (e) {
    console.warn('Erro ao remover spotify_session.json:', e);
  }

  if (db) {
    try {
      const docRef = doc(db, 'spotify_sessions', SPOTIFY_DOC_ID);
      await deleteDoc(docRef);
      console.log('✅ Sessão do Spotify removida do Firestore.');
    } catch (e) {
      console.error('Erro ao deletar sessão do Spotify do Firestore:', e);
    }
  }
}

// Helper to determine exact callback URL
function getRedirectUri(req: express.Request): string {
  if (process.env.APP_URL) {
    const cleanAppUrl = process.env.APP_URL.replace(/\/$/, '');
    return `${cleanAppUrl}/auth/callback`;
  }
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return `${protocol}://${host}/auth/callback`;
}

// --- SPOTIFY OAUTH & API ROUTES ---

// 1. Status & Config route
app.get('/api/spotify/status', async (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID || '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
  const redirectUri = getRedirectUri(req);
  
  // Ensure we load from Firestore if memory is empty
  if (!spotifySession.accessToken && !spotifySession.refreshToken) {
    await loadSpotifySession();
  }

  // Refresh token if needed
  const token = await getValidAccessToken();
  const isIntegrated = Boolean(token || spotifySession.refreshToken);

  res.json({
    configured: Boolean(clientId && clientSecret),
    hasToken: isIntegrated,
    isIntegrated,
    clientId: clientId ? `${clientId.slice(0, 5)}...` : null,
    redirectUri,
    userProfile: spotifySession.userProfile || null,
  });
});

// Disconnect route (Only disconnects when explicitly requested by user)
app.post('/api/spotify/disconnect', async (req, res) => {
  await clearSpotifySession();
  res.json({ success: true, isIntegrated: false, message: 'Spotify desconectado com sucesso.' });
});

// 2. Auth URL route
app.get('/api/spotify/auth-url', (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(400).json({
      error: 'SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET não estão configurados no servidor.',
      needsConfig: true,
    });
  }

  const redirectUri = getRedirectUri(req);
  const scopes = [
    'user-read-currently-playing',
    'user-modify-playback-state',
    'user-read-playback-state',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-read-email',
    'user-read-private',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    show_dialog: 'true',
  });

  const url = `https://accounts.spotify.com/authorize?${params.toString()}`;
  res.json({ url, redirectUri });
});

// 3. OAuth Callback handler
const callbackHandler: express.RequestHandler = async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error || !code) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Erro na Autenticação Spotify</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px; background: #0f172a; color: #fff;">
          <div style="background: #1e293b; padding: 28px; border-radius: 16px; display: inline-block; max-width: 440px; border: 1px solid #334155; text-align: left;">
            <h2 style="color: #f43f5e; margin: 0 0 12px 0; font-size: 18px;">Falha no Login do Spotify</h2>
            <p style="color: #cbd5e1; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">${error || 'Nenhum código fornecido'}</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_ERROR', error: '${error || 'canceled'}' }, '*');
              setTimeout(() => window.close(), 2500);
            }
          </script>
        </body>
      </html>
    `);
  }

  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID || '';
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    const redirectUri = getRedirectUri(req);

    if (!clientId || !clientSecret) {
      throw new Error(
        'SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET precisam estar definidos no arquivo .env para concluir o login do Spotify.'
      );
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      let detailedError = `Erro HTTP ${tokenResponse.status} na troca de token do Spotify`;
      try {
        const errData = await tokenResponse.json();
        if (errData.error === 'invalid_client') {
          detailedError =
            'SPOTIFY_CLIENT_SECRET ou SPOTIFY_CLIENT_ID inválido. Verifique se o Client ID e Client Secret no .env correspondem exatamente aos dados no Dashboard do Spotify.';
        } else if (errData.error === 'invalid_grant') {
          detailedError =
            'O código de autorização do Spotify expirou ou o Redirect URI não é exatamente o mesmo. Verifique a URL do Redirect URI no Dashboard do Spotify.';
        } else {
          detailedError = errData.error_description || errData.error || detailedError;
        }
      } catch (e) {
        // Fallback
      }
      throw new Error(detailedError);
    }

    const tokenData = await tokenResponse.json();

    // Fetch user profile from Spotify
    let userProfile = null;
    try {
      const profileRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (profileRes.ok) {
        userProfile = await profileRes.json();
      }
    } catch (pErr) {
      console.warn('Erro ao carregar perfil do Spotify:', pErr);
    }

    const sessionData = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
      userProfile,
    };
    await saveSpotifySession(sessionData);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Conectado</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px; background: #0f172a; color: #fff;">
          <div style="background: #1e293b; padding: 30px; border-radius: 16px; display: inline-block; max-width: 400px; border: 1px solid #334155;">
            <div style="width: 48px; height: 48px; background: #1db954; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.12-.779-.18-.899-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 C9.6 9.9 15 10.561 18.72 12.841c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.18-.1.2-1.2-.42-.18-.6.42-1.2 1.02-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z"/></svg>
            </div>
            <h2 style="color: #1db954; margin: 0 0 8px 0; font-size: 20px;">Spotify Conectado!</h2>
            <p style="color: #94a3b8; font-size: 14px; margin: 0 0 16px 0;">Sua conta foi vinculada com sucesso ao reprodutor do motorista.</p>
            <p style="color: #64748b; font-size: 12px;">Esta janela será fechada automaticamente...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'SPOTIFY_AUTH_SUCCESS',
                accessToken: ${JSON.stringify(tokenData.access_token)},
                refreshToken: ${JSON.stringify(tokenData.refresh_token)},
                userProfile: ${JSON.stringify(userProfile)}
              }, '*');
              setTimeout(() => window.close(), 1200);
            } else {
              setTimeout(() => { window.location.href = '/'; }, 1500);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Erro no callback do Spotify:', err);
    const redirectUri = getRedirectUri(req);
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Erro Spotify</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 30px; background: #0f172a; color: #fff;">
          <div style="background: #1e293b; padding: 28px; border-radius: 16px; display: inline-block; max-width: 450px; border: 1px solid #334155; text-align: left;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: #f43f5e20; border: 1px solid #f43f5e50; display: flex; align-items: center; justify-content: center; color: #f43f5e; font-weight: bold; font-size: 18px;">!</div>
              <h2 style="color: #f43f5e; margin: 0; font-size: 18px;">Falha no Login do Spotify</h2>
            </div>
            <p style="color: #cbd5e1; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">${err.message || 'Erro ao trocar código por token.'}</p>
            <div style="background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155; font-size: 11px; color: #94a3b8; font-family: monospace; line-height: 1.4;">
              <strong>Verifique no Spotify Dashboard:</strong><br/>
              • Redirect URI cadastrada no Spotify:<br/>
              <span style="color: #38bdf8; word-break: break-all;">${redirectUri}</span>
            </div>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'SPOTIFY_AUTH_ERROR',
                error: ${JSON.stringify(err.message || 'Erro de autenticação no Spotify')}
              }, '*');
            }
          </script>
        </body>
      </html>
    `);
  }
};

app.get('/auth/callback', callbackHandler);
app.get('/auth/callback/', callbackHandler);

// Helper function to handle Spotify token refresh if expired (always prioritizing driver's registered account)
async function getValidAccessToken(
  clientToken?: string,
  refreshToken?: string,
  forceRefresh: boolean = false
): Promise<string | null> {
  // 1. Ensure server-persistent session is loaded from Firestore if memory is clean
  if (!spotifySession.accessToken && !spotifySession.refreshToken) {
    await loadSpotifySession();
  }

  // 2. If valid server-stored driver access token exists and not force-refreshing, use it!
  if (!forceRefresh && spotifySession.accessToken && spotifySession.expiresAt && Date.now() < spotifySession.expiresAt) {
    return spotifySession.accessToken;
  }

  // 3. Try refreshing the token using the driver's stored refresh_token on the server
  const activeRefToken = refreshToken || spotifySession.refreshToken;
  if (activeRefToken) {
    try {
      const clientId = process.env.SPOTIFY_CLIENT_ID || '';
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
      if (clientId && clientSecret) {
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${authHeader}`,
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: activeRefToken,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          spotifySession.accessToken = data.access_token;
          spotifySession.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
          if (data.refresh_token) {
            spotifySession.refreshToken = data.refresh_token;
          }
          await saveSpotifySession(spotifySession);
          return data.access_token;
        }
      }
    } catch (e) {
      console.error('Falha ao atualizar token do Spotify com refresh_token:', e);
    }
  }

  // 4. Fallback: if driver session is not found or failed to refresh, try clientToken
  if (clientToken) {
    return clientToken;
  }

  return null;
}

// 4. Currently Playing & Player State
app.get('/api/spotify/player', async (req, res) => {
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) {
    return res.status(401).json({ error: 'Nenhum token do Spotify disponível.', authenticated: false });
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 204) {
      return res.json({ is_playing: false, item: null, message: 'Nenhuma música tocando no momento.' });
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json(err);
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Play / Resume with auto-device targeting
app.post('/api/spotify/play', async (req, res) => {
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) {
    return res.status(401).json({ error: 'Token do Spotify necessário.' });
  }

  try {
    const { context_uri, uris, offset, device_id } = req.body || {};

    const executePlay = async (devId?: string) => {
      let url = 'https://api.spotify.com/v1/me/player/play';
      if (devId) url += `?device_id=${devId}`;

      const bodyData: any = {};
      if (context_uri) bodyData.context_uri = context_uri;
      if (uris && Array.isArray(uris) && uris.length > 0) bodyData.uris = uris;
      if (offset) bodyData.offset = offset;

      return await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: Object.keys(bodyData).length > 0 ? JSON.stringify(bodyData) : undefined,
      });
    };

    // 1. Attempt play directly
    let response = await executePlay(device_id);

    if (response.status === 204 || response.ok) {
      return res.json({ success: true });
    }

    // 2. If failed (e.g., 404 No Active Device or 400/403), check available Spotify devices
    let devicesData: any = null;
    try {
      const devRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (devRes.ok) {
        devicesData = await devRes.json();
      }
    } catch (e) {
      console.warn('Erro ao consultar dispositivos no Spotify:', e);
    }

    const devices = devicesData?.devices || [];
    if (devices.length > 0) {
      // Find active device or pick a device (preferring car/bluetooth or first available)
      const targetDev =
        devices.find((d: any) => d.is_active) ||
        devices.find((d: any) => /car|som|veiculo|bluetooth|automotive/i.test(d.name)) ||
        devices[0];

      if (targetDev) {
        // Transfer playback to that device and resume
        await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ device_ids: [targetDev.id], play: true }),
        }).catch(() => {});

        // Retry play on target device
        response = await executePlay(targetDev.id);
        if (response.status === 204 || response.ok) {
          return res.json({ success: true, device: targetDev.name });
        }
      }
    }

    const err = await response.json().catch(() => ({}));
    return res.status(response.status || 400).json(err);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Pause
app.post('/api/spotify/pause', async (req, res) => {
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) return res.status(401).json({ error: 'Token do Spotify necessário.' });

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 204 || response.ok) {
      return res.json({ success: true });
    }

    const err = await response.json().catch(() => ({}));
    res.status(response.status).json(err);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Next Track
app.post('/api/spotify/next', async (req, res) => {
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) return res.status(401).json({ error: 'Token do Spotify necessário.' });

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/next', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 204 || response.ok) return res.json({ success: true });
    const err = await response.json().catch(() => ({}));
    res.status(response.status).json(err);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Previous Track
app.post('/api/spotify/previous', async (req, res) => {
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) return res.status(401).json({ error: 'Token do Spotify necessário.' });

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/previous', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 204 || response.ok) return res.json({ success: true });
    const err = await response.json().catch(() => ({}));
    res.status(response.status).json(err);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Devices (real Spotify devices fetched strictly from driver's Spotify account API)
app.get('/api/spotify/devices', async (req, res) => {
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  let token = await getValidAccessToken(clientToken);

  if (!token) {
    return res.status(401).json({
      error: 'A conta do Spotify do motorista não está vinculada. Conecte o Spotify no Painel do Motorista para buscar aparelhos reais.',
      authenticated: false,
      devices: [],
    });
  }

  try {
    let response = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      // Force refresh driver token from server if token expired
      const freshToken = await getValidAccessToken(undefined, undefined, true);
      if (freshToken) {
        token = freshToken;
        response = await fetch('https://api.spotify.com/v1/me/player/devices', {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }

    if (response.ok) {
      const data = await response.json();
      return res.json({
        devices: data.devices || [],
        authenticated: true,
        userProfile: spotifySession.userProfile || null,
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorData?.error?.message || 'Erro ao consultar dispositivos na conta do Spotify do motorista.',
        devices: [],
        authenticated: response.status !== 401,
        userProfile: spotifySession.userProfile || null,
      });
    }
  } catch (err: any) {
    console.error('Erro ao consultar dispositivos no Spotify:', err);
    return res.status(500).json({ error: err.message, devices: [], authenticated: false });
  }
});

// 10. Transfer Playback to explicit device ID
app.post('/api/spotify/transfer', async (req, res) => {
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) {
    return res.status(401).json({ error: 'Token do Spotify do motorista necessário.' });
  }

  try {
    const { device_id, play = true } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id é obrigatório.' });

    const response = await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_ids: [device_id], play }),
    });

    if (response.status === 204 || response.ok) {
      return res.json({ success: true, message: 'Som transferido com sucesso.' });
    }

    const err = await response.json().catch(() => ({}));
    res.status(response.status).json(err);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to generate rich search fallbacks for any query or category
function generateSpotifySearchFallback(query: string) {
  const q = (query || '').toLowerCase().trim();

  let tracks: any[] = [];
  let playlists: any[] = [];

  if (q.includes('sertanejo')) {
    tracks = [
      {
        id: 'st-1',
        name: 'Erro Gostoso (Ao Vivo)',
        artists: [{ name: 'Simone Mendes' }],
        album: { name: 'Cintilante', images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80' }] },
        duration_ms: 180000,
        uri: 'spotify:track:1',
      },
      {
        id: 'st-2',
        name: 'Leão (Ao Vivo)',
        artists: [{ name: 'Marília Mendonça' }],
        album: { name: 'Decretos Reais Vol. 3', images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }] },
        duration_ms: 166000,
        uri: 'spotify:track:2',
      },
      {
        id: 'st-3',
        name: 'Nosso Quadro',
        artists: [{ name: 'Ana Castela' }],
        album: { name: 'Nosso Quadro', images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }] },
        duration_ms: 173000,
        uri: 'spotify:track:3',
      },
      {
        id: 'st-4',
        name: 'Desejo Imortal',
        artists: [{ name: 'Gusttavo Lima' }],
        album: { name: 'Ao Vivo em Goiânia', images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80' }] },
        duration_ms: 190000,
        uri: 'spotify:track:4',
      },
      {
        id: 'st-5',
        name: 'Oi Balde',
        artists: [{ name: 'Zé Neto & Cristiano' }],
        album: { name: 'Escolhas Vol. 1', images: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80' }] },
        duration_ms: 185000,
        uri: 'spotify:track:5',
      },
    ];
    playlists = [
      {
        id: 'pl-st-1',
        name: 'Sertanejo Hits 2025',
        owner: { display_name: 'Spotify Brasil' },
        images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80' }],
        tracks: { total: 50 },
        uri: 'spotify:playlist:sertanejo-hits-2025',
      },
      {
        id: 'pl-st-2',
        name: 'As Melhores do Sertanejo no Carro',
        owner: { display_name: 'Som do Veículo' },
        images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }],
        tracks: { total: 40 },
        uri: 'spotify:playlist:sertanejo-no-carro',
      },
      {
        id: 'pl-st-3',
        name: 'Modão & Sertanejo Universitário',
        owner: { display_name: 'Playlist Brasil' },
        images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }],
        tracks: { total: 60 },
        uri: 'spotify:playlist:modao-universitario',
      },
    ];
  } else if (q.includes('pop')) {
    tracks = [
      {
        id: 'pop-1',
        name: 'As It Was',
        artists: [{ name: 'Harry Styles' }],
        album: { name: "Harry's House", images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }] },
        duration_ms: 167000,
        uri: 'spotify:track:pop1',
      },
      {
        id: 'pop-2',
        name: 'Flowers',
        artists: [{ name: 'Miley Cyrus' }],
        album: { name: 'Endless Summer Vacation', images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }] },
        duration_ms: 200000,
        uri: 'spotify:track:pop2',
      },
      {
        id: 'pop-3',
        name: 'Blinding Lights',
        artists: [{ name: 'The Weeknd' }],
        album: { name: 'After Hours', images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80' }] },
        duration_ms: 200000,
        uri: 'spotify:track:pop3',
      },
      {
        id: 'pop-4',
        name: 'Levitating',
        artists: [{ name: 'Dua Lipa' }],
        album: { name: 'Future Nostalgia', images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80' }] },
        duration_ms: 203000,
        uri: 'spotify:track:pop4',
      },
    ];
    playlists = [
      {
        id: 'pl-pop-1',
        name: 'Pop Top Hits 2025',
        owner: { display_name: 'Spotify Global' },
        images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }],
        tracks: { total: 50 },
        uri: 'spotify:playlist:pop-top-hits',
      },
      {
        id: 'pl-pop-2',
        name: 'Pop Hits na Estrada',
        owner: { display_name: 'Som do Veículo' },
        images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }],
        tracks: { total: 45 },
        uri: 'spotify:playlist:pop-na-estrada',
      },
    ];
  } else if (q.includes('mpb') || q.includes('brasil')) {
    tracks = [
      {
        id: 'mpb-1',
        name: 'Anunciação',
        artists: [{ name: 'Alceu Valença' }],
        album: { name: 'Anunciação Hits', images: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80' }] },
        duration_ms: 210000,
        uri: 'spotify:track:mpb1',
      },
      {
        id: 'mpb-2',
        name: 'Velha Infância',
        artists: [{ name: 'Tribalistas' }],
        album: { name: 'Tribalistas', images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80' }] },
        duration_ms: 250000,
        uri: 'spotify:track:mpb2',
      },
      {
        id: 'mpb-3',
        name: 'Toda Forma de Amor',
        artists: [{ name: 'Lulu Santos' }],
        album: { name: 'Toda Forma de Amor', images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80' }] },
        duration_ms: 220000,
        uri: 'spotify:track:mpb3',
      },
    ];
    playlists = [
      {
        id: 'pl-mpb-1',
        name: 'MPB & Brasil para Viagem',
        owner: { display_name: 'Spotify Brasil' },
        images: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80' }],
        tracks: { total: 50 },
        uri: 'spotify:playlist:mpb-para-viagem',
      },
      {
        id: 'pl-mpb-2',
        name: 'Clássicos da MPB no Som do Veículo',
        owner: { display_name: 'Som do Veículo' },
        images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80' }],
        tracks: { total: 40 },
        uri: 'spotify:playlist:classicos-mpb-carro',
      },
    ];
  } else if (q.includes('funk')) {
    tracks = [
      {
        id: 'fk-1',
        name: 'Deixa Acontecer / Revoada',
        artists: [{ name: 'Mc Ryan SP & Mc Daniel' }],
        album: { name: 'Hits do Ano', images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }] },
        duration_ms: 180000,
        uri: 'spotify:track:funk1',
      },
      {
        id: 'fk-2',
        name: 'Faz um PIX',
        artists: [{ name: 'Mc DJ Henrique' }],
        album: { name: 'Funk Brasil 2025', images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }] },
        duration_ms: 155000,
        uri: 'spotify:track:funk2',
      },
      {
        id: 'fk-3',
        name: 'Tubarão Te Amo',
        artists: [{ name: 'DJ Zullu & Mc Ryan' }],
        album: { name: 'Som das Pistas', images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80' }] },
        duration_ms: 190000,
        uri: 'spotify:track:funk3',
      },
    ];
    playlists = [
      {
        id: 'pl-funk-1',
        name: 'Funk Hits Brasil 2025',
        owner: { display_name: 'Spotify Brasil' },
        images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }],
        tracks: { total: 50 },
        uri: 'spotify:playlist:funk-hits-brasil',
      },
      {
        id: 'pl-funk-2',
        name: 'Baile no Carro & Automotivo',
        owner: { display_name: 'Som do Veículo' },
        images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }],
        tracks: { total: 45 },
        uri: 'spotify:playlist:baile-no-carro',
      },
    ];
  } else if (q.includes('rock')) {
    tracks = [
      {
        id: 'rk-1',
        name: "Sweet Child O' Mine",
        artists: [{ name: "Guns N' Roses" }],
        album: { name: 'Appetite for Destruction', images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }] },
        duration_ms: 355000,
        uri: 'spotify:track:rock1',
      },
      {
        id: 'rk-2',
        name: 'Hotel California',
        artists: [{ name: 'Eagles' }],
        album: { name: 'Hotel California', images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80' }] },
        duration_ms: 390000,
        uri: 'spotify:track:rock2',
      },
      {
        id: 'rk-3',
        name: 'Tempo Perdido',
        artists: [{ name: 'Legião Urbana' }],
        album: { name: 'Dois', images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80' }] },
        duration_ms: 300000,
        uri: 'spotify:track:rock3',
      },
    ];
    playlists = [
      {
        id: 'pl-rock-1',
        name: 'Rock Classics Highway',
        owner: { display_name: 'Spotify Rock' },
        images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }],
        tracks: { total: 60 },
        uri: 'spotify:playlist:rock-classics',
      },
      {
        id: 'pl-rock-2',
        name: 'Rock Nacional e Internacional no Carro',
        owner: { display_name: 'Som do Veículo' },
        images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80' }],
        tracks: { total: 45 },
        uri: 'spotify:playlist:rock-no-carro',
      },
    ];
  } else if (q.includes('eletronica') || q.includes('electronic') || q.includes('dance')) {
    tracks = [
      {
        id: 'e-1',
        name: 'Hear Me Now',
        artists: [{ name: 'Alok, Bruno Martini & Zeeba' }],
        album: { name: 'Hear Me Now', images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80' }] },
        duration_ms: 192000,
        uri: 'spotify:track:elec1',
      },
      {
        id: 'e-2',
        name: 'In the Dark',
        artists: [{ name: 'Vintage Culture' }],
        album: { name: 'In the Dark', images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }] },
        duration_ms: 210000,
        uri: 'spotify:track:elec2',
      },
      {
        id: 'e-3',
        name: 'Titanium',
        artists: [{ name: 'David Guetta ft. Sia' }],
        album: { name: 'Nothing but the Beat', images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }] },
        duration_ms: 245000,
        uri: 'spotify:track:elec3',
      },
    ];
    playlists = [
      {
        id: 'pl-elec-1',
        name: 'Electronic Dance Roadtrip',
        owner: { display_name: 'Spotify Dance' },
        images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80' }],
        tracks: { total: 50 },
        uri: 'spotify:playlist:electronic-roadtrip',
      },
      {
        id: 'pl-elec-2',
        name: 'Balada no Veículo',
        owner: { display_name: 'Som do Veículo' },
        images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }],
        tracks: { total: 40 },
        uri: 'spotify:playlist:balada-no-carro',
      },
    ];
  } else if (q.includes('pagode') || q.includes('samba')) {
    tracks = [
      {
        id: 'pg-1',
        name: 'Péssimo Negócio (Ao Vivo)',
        artists: [{ name: 'Dilsinho' }],
        album: { name: 'Ao Vivo em Bananeiras', images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80' }] },
        duration_ms: 195000,
        uri: 'spotify:track:pagode1',
      },
      {
        id: 'pg-2',
        name: 'Sinais',
        artists: [{ name: 'Sorriso Maroto' }],
        album: { name: 'Ao Vivo em Recife', images: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80' }] },
        duration_ms: 215000,
        uri: 'spotify:track:pagode2',
      },
      {
        id: 'pg-3',
        name: 'Falta Você',
        artists: [{ name: 'Thiaguinho' }],
        album: { name: 'Meu Nome é Thiago André', images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }] },
        duration_ms: 180000,
        uri: 'spotify:track:pagode3',
      },
    ];
    playlists = [
      {
        id: 'pl-pg-1',
        name: 'Pagode Anos 90 & 2025',
        owner: { display_name: 'Spotify Brasil' },
        images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80' }],
        tracks: { total: 50 },
        uri: 'spotify:playlist:pagode-sucessos',
      },
      {
        id: 'pl-pg-2',
        name: 'Churrasco & Pagode no Carro',
        owner: { display_name: 'Som do Veículo' },
        images: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80' }],
        tracks: { total: 45 },
        uri: 'spotify:playlist:pagode-no-carro',
      },
    ];
  } else if (q.includes('chill') || q.includes('relax') || q.includes('lofi') || q.includes('lo-fi')) {
    tracks = [
      {
        id: 'cl-1',
        name: 'Coffee Beats & Rain',
        artists: [{ name: 'Lo-Fi Chill Hop' }],
        album: { name: 'Relaxing Highway Drive', images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80' }] },
        duration_ms: 195000,
        uri: 'spotify:track:chill1',
      },
      {
        id: 'cl-2',
        name: 'Sunset Highway Beats',
        artists: [{ name: 'Chill Drive' }],
        album: { name: 'Acoustic Sunset', images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }] },
        duration_ms: 210000,
        uri: 'spotify:track:chill2',
      },
    ];
    playlists = [
      {
        id: 'pl-cl-1',
        name: 'Chillout Roadtrip & Lofi',
        owner: { display_name: 'Spotify Chill' },
        images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80' }],
        tracks: { total: 40 },
        uri: 'spotify:playlist:chillout-roadtrip',
      },
    ];
  } else {
    const capitalized = query ? query.charAt(0).toUpperCase() + query.slice(1) : 'Música';
    tracks = [
      {
        id: `gen-1-${q}`,
        name: `${capitalized} - Sucesso Especial`,
        artists: [{ name: capitalized }],
        album: { name: `${capitalized} Ao Vivo no Veículo`, images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }] },
        duration_ms: 198000,
        uri: `spotify:track:gen1-${q}`,
      },
      {
        id: `gen-2-${q}`,
        name: `A Viagem de ${capitalized}`,
        artists: [{ name: `${capitalized} & Som do Carro` }],
        album: { name: 'Músicas na Estrada', images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }] },
        duration_ms: 215000,
        uri: `spotify:track:gen2-${q}`,
      },
      {
        id: `gen-3-${q}`,
        name: `${capitalized} (Remix Especial)`,
        artists: [{ name: `DJ ${capitalized}` }],
        album: { name: 'Som Automotivo 2025', images: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80' }] },
        duration_ms: 185000,
        uri: `spotify:track:gen3-${q}`,
      },
    ];
    playlists = [
      {
        id: `pl-gen-1-${q}`,
        name: `${capitalized} - As Melhores no Carro`,
        owner: { display_name: 'Som do Veículo' },
        images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }],
        tracks: { total: 30 },
        uri: `spotify:playlist:${q}-no-carro`,
      },
      {
        id: `pl-gen-2-${q}`,
        name: `Coletânea ${capitalized} & Convidados`,
        owner: { display_name: 'Music Drive' },
        images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }],
        tracks: { total: 25 },
        uri: `spotify:playlist:${q}-convidados`,
      },
    ];
  }

  return {
    tracks: { items: tracks },
    playlists: { items: playlists },
  };
}

// 10. Search tracks / playlists
app.get('/api/spotify/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query) return res.status(400).json({ error: 'Consulta de busca (q) é obrigatória.' });

  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (token) {
    try {
      const spotifyUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,playlist&limit=10`;
      const response = await fetch(spotifyUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if ((data.tracks?.items && data.tracks.items.length > 0) || (data.playlists?.items && data.playlists.items.length > 0)) {
          return res.json(data);
        }
      }
    } catch (err: any) {
      console.warn('Erro ao buscar no Spotify API live:', err);
    }
  }

  // Fallback search results for test mode or when Spotify API is empty/unauthenticated
  const fallback = generateSpotifySearchFallback(query);
  res.json(fallback);
});

// 11. User Playlists
app.get('/api/spotify/playlists', async (req, res) => {
  const DEFAULT_PLAYLISTS = [
    {
      id: 'pl-sertanejo',
      name: 'Sertanejo no Carro 2025',
      owner: { display_name: 'Som do Veículo' },
      images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80' }],
      tracks: { total: 50 },
      uri: 'spotify:playlist:sertanejo-carro-2025',
    },
    {
      id: 'pl-mpb',
      name: 'MPB & Brasil para Viagem',
      owner: { display_name: 'Som do Veículo' },
      images: [{ url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80' }],
      tracks: { total: 40 },
      uri: 'spotify:playlist:mpb-brasil-viagem',
    },
    {
      id: 'pl-pop',
      name: 'Pop Hits Internacional',
      owner: { display_name: 'Som do Veículo' },
      images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80' }],
      tracks: { total: 45 },
      uri: 'spotify:playlist:pop-hits-internacional',
    },
    {
      id: 'pl-funk',
      name: 'Funk & Automotivo',
      owner: { display_name: 'Som do Veículo' },
      images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80' }],
      tracks: { total: 50 },
      uri: 'spotify:playlist:funk-automotivo',
    },
  ];

  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) return res.json({ items: DEFAULT_PLAYLISTS });

  try {
    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        return res.json(data);
      }
    }
  } catch (err: any) {
    console.warn('Erro ao buscar playlists do Spotify:', err);
  }

  res.json({ items: DEFAULT_PLAYLISTS });
});

// 12. Seek position in track
app.post('/api/spotify/seek', async (req, res) => {
  const { position_ms } = req.body || {};
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) return res.status(401).json({ error: 'Token do Spotify necessário.' });

  try {
    const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${position_ms || 0}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 204 || response.ok) return res.json({ success: true });
    const err = await response.json().catch(() => ({}));
    res.status(response.status).json(err);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Set Volume
app.post('/api/spotify/volume', async (req, res) => {
  const { volume_percent } = req.body || {};
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) return res.status(401).json({ error: 'Token do Spotify necessário.' });

  try {
    const response = await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volume_percent ?? 80}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 204 || response.ok) return res.json({ success: true });
    const err = await response.json().catch(() => ({}));
    res.status(response.status).json(err);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Toggle Shuffle
app.post('/api/spotify/shuffle', async (req, res) => {
  const { state } = req.body || {};
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) return res.status(401).json({ error: 'Token do Spotify necessário.' });

  try {
    const response = await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${Boolean(state)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 204 || response.ok) return res.json({ success: true });
    const err = await response.json().catch(() => ({}));
    res.status(response.status).json(err);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Toggle Repeat Mode
app.post('/api/spotify/repeat', async (req, res) => {
  const { state } = req.body || { state: 'context' };
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) return res.status(401).json({ error: 'Token do Spotify necessário.' });

  try {
    const response = await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${state}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 204 || response.ok) return res.json({ success: true });
    const err = await response.json().catch(() => ({}));
    res.status(response.status).json(err);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 16. Recently Played Tracks
app.get('/api/spotify/recently-played', async (req, res) => {
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) return res.status(401).json({ error: 'Token do Spotify necessário.' });

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=15', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 17. Saved / Liked Tracks
app.get('/api/spotify/saved-tracks', async (req, res) => {
  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) return res.status(401).json({ error: 'Token do Spotify necessário.' });

  try {
    const response = await fetch('https://api.spotify.com/v1/me/tracks?limit=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 18. Transfer Playback to Device
app.post('/api/spotify/transfer', async (req, res) => {
  const { device_id, play = true } = req.body || {};
  if (!device_id) return res.status(400).json({ error: 'ID do dispositivo é obrigatório.' });

  const clientToken = req.headers.authorization?.replace('Bearer ', '');
  const token = await getValidAccessToken(clientToken);

  if (!token) return res.status(401).json({ error: 'Token do Spotify necessário.' });

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_ids: [device_id], play }),
    });

    if (response.status === 204 || response.ok) return res.json({ success: true });
    const err = await response.json().catch(() => ({}));
    res.status(response.status).json(err);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- MERCADO PAGO PIX PAYMENT & WEBHOOK ROUTES ---

// In-memory payment cache for immediate fast lookups & Firestore sync
const paymentStore: Record<string, any> = {};

// Mercado Pago credentials are server-side secrets only.
// Never load access tokens from Firestore or return them to the browser.
async function getMercadoPagoToken(): Promise<string> {
  return (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();
}

async function getMercadoPagoPaymentClient() {
  const token = await getMercadoPagoToken();
  if (!token) return null;
  try {
    const client = new MercadoPagoConfig({ accessToken: token });
    return new Payment(client);
  } catch (e) {
    console.warn('Erro ao inicializar cliente Mercado Pago:', e);
    return null;
  }
}


async function applyApprovedPaymentEffects(payment: any) {
  if (!db || !payment?.paymentActivated || payment?.status !== 'approved') return;
  const rideId = String(payment.rideId || '').trim();
  const sessionId = String(payment.passengerSessionId || '').trim();
  const serviceIds = Array.isArray(payment.serviceIds) ? payment.serviceIds.map((id: any) => String(id)).filter(Boolean) : [];
  const productQuantities = payment.productQuantities && typeof payment.productQuantities === 'object' ? payment.productQuantities : {};
  const includesRide = Boolean(payment.includesRide);

  if (rideId) {
    try {
      const rideRef = doc(db, 'rides', rideId);
      const rideSnap = await getDoc(rideRef);
      const rideData = rideSnap.exists() ? rideSnap.data() || {} : {};
      await setDoc(rideRef, {
        paymentStatus: includesRide ? 'paid' : (rideData.paymentStatus || 'unpaid'),
        paymentId: payment.paymentId,
        paidAmount: includesRide ? Number(payment.amount) || 0 : Number(rideData.paidAmount) || 0,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('Erro ao aplicar pagamento na corrida:', e);
    }
  }

  if (sessionId) {
    try {
      const sessionRef = doc(db, 'passenger_sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const current = sessionSnap.data() || {};
        const appliedPaymentIds = Array.isArray(current.appliedPaymentIds)
          ? current.appliedPaymentIds.map((id: any) => String(id))
          : [];
        const alreadyApplied = appliedPaymentIds.includes(String(payment.paymentId));
        const unlocked = Array.from(new Set([...(Array.isArray(current.unlockedServices) ? current.unlockedServices : []), ...serviceIds]));
        const purchased = { ...(current.purchasedProducts || {}) };

        if (!alreadyApplied) {
          for (const [id, qty] of Object.entries(productQuantities)) {
            const amount = Math.max(0, Number(qty) || 0);
            if (amount > 0) purchased[id] = (Number(purchased[id]) || 0) + amount;
          }
        }

        await setDoc(sessionRef, {
          unlockedServices: unlocked,
          purchasedProducts: purchased,
          hasMusicUnlocked: unlocked.includes('spotify_music'),
          paymentId: payment.paymentId,
          paidAmount: Number(payment.amount) || 0,
          appliedPaymentIds: alreadyApplied
            ? appliedPaymentIds
            : [...appliedPaymentIds, String(payment.paymentId)].slice(-50),
          ...(includesRide ? { isRidePaid: true, paidRideAmount: Number(payment.amount) || 0 } : {}),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    } catch (e) {
      console.warn('Erro ao aplicar pagamento na sessão do passageiro:', e);
    }
  }
}

// 1. Mercado Pago Config Status Endpoint
app.get('/api/mercadopago/status', async (req, res) => {
  const token = await getMercadoPagoToken();
  const publicKey = process.env.MERCADO_PAGO_PUBLIC_KEY || '';
  const appUrl = (process.env.APP_URL || `http://${req.get('host') || 'localhost:3000'}`).replace(/\/$/, '');

  let mode: 'production' | 'sandbox' | 'demonstration' = 'demonstration';
  if (token) {
    mode = token.startsWith('APP_USR-') ? 'production' : 'sandbox';
  }

  res.json({
    configured: Boolean(token),
    hasAccessToken: Boolean(token),
    hasPublicKey: Boolean(publicKey),
    webhookUrl: `${appUrl}/api/mercadopago/webhook`,
    mode,
  });
});

// Mercado Pago secrets must be configured in the server environment.
// This endpoint intentionally refuses browser-side secret persistence.
app.post('/api/mercadopago/save-config', (_req, res) => {
  return res.status(410).json({
    error: 'Credenciais do Mercado Pago devem ser configuradas no ambiente seguro do servidor.',
  });
});

// 2. Create Mercado Pago Pix Payment Charge
app.post('/api/mercadopago/create-payment', async (req, res) => {
  try {
    const {
      amount, transaction_amount, description, payer, serviceId, rideId,
      passengerSessionId, serviceIds, productQuantities,
    } = req.body || {};
    const finalAmount = Number(amount || transaction_amount || 0);
    const normalizedServiceIds = Array.isArray(serviceIds)
      ? serviceIds.map((id: any) => String(id)).filter(Boolean)
      : serviceId ? [String(serviceId)] : [];
    const normalizedProductQuantities =
      productQuantities && typeof productQuantities === 'object' ? productQuantities : {};
    const normalizedDescription = String(description || '').toLowerCase();
    const includesRide =
      normalizedDescription.includes('corrida') ||
      normalizedDescription.includes('viagem') ||
      normalizedDescription.includes('trajeto');

    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({ error: 'O valor da cobrança deve ser maior que zero.' });
    }

    const mpPayment = await getMercadoPagoPaymentClient();
    const appUrl = (process.env.APP_URL || `http://${req.get('host') || 'localhost:3000'}`).replace(/\/$/, '');
    const webhookUrl = `${appUrl}/api/mercadopago/webhook`;

    let paymentData: any = null;

    if (mpPayment) {
      // Use official Mercado Pago SDK
      const body: any = {
        transaction_amount: finalAmount,
        description: description || 'Serviços de Corrida Moto / Extras',
        payment_method_id: 'pix',
        payer: {
          email: payer?.email || 'cliente.corrida@gmail.com',
          first_name: payer?.firstName || 'Passageiro',
          last_name: payer?.lastName || 'Cliente',
        },
        metadata: {
          service_id: serviceId || '',
          ride_id: rideId || '',
          passenger_session_id: passengerSessionId || '',
          service_ids: normalizedServiceIds.join(','),
          includes_ride: includesRide ? '1' : '0',
        },
      };

      // Mercado Pago API requires HTTPS for notification_url in live/production mode
      if (webhookUrl.startsWith('https://')) {
        body.notification_url = webhookUrl;
      }

      // Only pass identification if a valid 11-digit CPF was explicitly provided
      const rawCpf = payer?.cpf ? String(payer.cpf).replace(/\D/g, '') : '';
      if (rawCpf && rawCpf.length === 11 && rawCpf !== '11111111111') {
        body.payer.identification = {
          type: 'CPF',
          number: rawCpf,
        };
      }

      try {
        const mpResponse = await mpPayment.create({ body });
        const pId = String(mpResponse.id);

        paymentData = {
          paymentId: pId,
          amount: mpResponse.transaction_amount || finalAmount,
          description: mpResponse.description || description,
          status: mpResponse.status || 'pending',
          statusDetail: mpResponse.status_detail || 'pending_waiting_transfer',
          qrCode: mpResponse.point_of_interaction?.transaction_data?.qr_code || '',
          qrCodeBase64: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64 || '',
          ticketUrl: mpResponse.point_of_interaction?.transaction_data?.ticket_url || '',
          payerEmail: mpResponse.payer?.email || payer?.email || '',
          serviceId: serviceId || '',
          serviceIds: normalizedServiceIds,
          productQuantities: normalizedProductQuantities,
          rideId: rideId || '',
          passengerSessionId: passengerSessionId || '',
          includesRide,
          isRealMercadoPago: true,
          paymentActivated: mpResponse.status === 'approved',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } catch (sdkError: any) {
        console.warn('Erro na API do Mercado Pago:', sdkError?.message || 'falha desconhecida');

        if (process.env.NODE_ENV === 'production') {
          return res.status(502).json({
            error: 'Não foi possível gerar a cobrança Pix no Mercado Pago. Tente novamente.',
          });
        }

        const simId = 'MP_SIM_' + Date.now();
        const mockPixCopiaECola = `00020126580014br.gov.bcb.pix0136${simId}5204000053039865405${finalAmount.toFixed(2)}5802BR5920MOTO_TAXI_PAGAMENTOS6009SAO_PAULO62070503***63041D2B`;
        let qrBase64 = '';
        try {
          qrBase64 = await QRCode.toDataURL(mockPixCopiaECola);
          qrBase64 = qrBase64.replace(/^data:image\/png;base64,/, '');
        } catch {}

        paymentData = {
          paymentId: simId,
          amount: finalAmount,
          description: description || 'Serviço de Corrida Moto / Extras (Modo Demo)',
          status: 'pending',
          statusDetail: 'pending_waiting_transfer',
          qrCode: mockPixCopiaECola,
          qrCodeBase64: qrBase64,
          ticketUrl: '',
          payerEmail: payer?.email || 'passageiro@email.com',
          serviceId: serviceId || '',
          serviceIds: normalizedServiceIds,
          productQuantities: normalizedProductQuantities,
          rideId: rideId || '',
          passengerSessionId: passengerSessionId || '',
          includesRide,
          isRealMercadoPago: false,
          paymentActivated: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          message: 'Modo demonstrativo disponível apenas fora de produção.',
        };
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({
          error: 'Pagamento Pix indisponível: Mercado Pago não configurado no servidor.',
        });
      }

      const simId = 'MP_SIM_' + Date.now();
      const mockPixCopiaECola = `00020126580014br.gov.bcb.pix0136${simId}5204000053039865405${finalAmount.toFixed(2)}5802BR5920MOTO_TAXI_PAGAMENTOS6009SAO_PAULO62070503***63041D2B`;
      let qrBase64 = '';
      try {
        qrBase64 = await QRCode.toDataURL(mockPixCopiaECola);
        qrBase64 = qrBase64.replace(/^data:image\/png;base64,/, '');
      } catch {}

      paymentData = {
        paymentId: simId,
        amount: finalAmount,
        description: description || 'Serviço de Corrida Moto / Extras (Modo Demo)',
        status: 'pending',
        statusDetail: 'pending_waiting_transfer',
        qrCode: mockPixCopiaECola,
        qrCodeBase64: qrBase64,
        ticketUrl: '',
        payerEmail: payer?.email || 'passageiro@email.com',
        serviceId: serviceId || '',
        rideId: rideId || '',
        isRealMercadoPago: false,
        paymentActivated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        message: 'Modo demonstrativo disponível apenas fora de produção.',
      };
    }

    // Save in memory store
    paymentStore[paymentData.paymentId] = paymentData;

    // Save in Firestore for multi-device real-time sync if db is ready
    if (db) {
      try {
        const docRef = doc(db, 'pix_payments', paymentData.paymentId);
        await setDoc(docRef, paymentData, { merge: true });
      } catch (e) {
        console.warn('Erro ao salvar pix_payment no Firestore:', e);
      }
    }

    res.json({
      success: true,
      ...paymentData,
    });
  } catch (err: any) {
    console.error('Erro em create-payment:', err);
    res.status(500).json({ error: err.message || 'Erro interno ao criar pagamento Pix.' });
  }
});

// 3. Mercado Pago Webhook Endpoint (Receives notifications from Mercado Pago API)
app.all('/api/mercadopago/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const query = req.query || {};

    console.log('Webhook Mercado Pago recebido para processamento.');

    // Extract payment ID from various notification formats sent by MP
    const paymentId =
      body?.data?.id ||
      body?.id ||
      query['data.id'] ||
      query?.id ||
      query?.data_id;

    if (!paymentId) {
      return res.status(200).send('OK (sem paymentId)');
    }

    const mpPayment = await getMercadoPagoPaymentClient();
    let existing = paymentStore[paymentId] || {};
    if (Object.keys(existing).length === 0 && db) {
      try {
        const stored = await getDoc(doc(db, 'pix_payments', String(paymentId)));
        if (stored.exists()) existing = stored.data() || {};
      } catch (e) {
        console.warn('Erro ao recuperar contexto do pagamento no webhook:', e);
      }
    }
    let newStatus = existing.status || 'pending';
    let statusDetail = existing.statusDetail || 'pending_waiting_transfer';
    let verifiedFromMp = false;

    if (mpPayment) {
      try {
        const mpData = await mpPayment.get({ id: paymentId });
        if (mpData) {
          newStatus = mpData.status || newStatus;
          statusDetail = mpData.status_detail || statusDetail;
          verifiedFromMp = true;
          console.log(`✅ Pagamento ${paymentId} verificado no Mercado Pago: Status = ${newStatus}`);
        }
      } catch (e) {
        console.warn(`Aviso ao consultar pagamento ${paymentId} na API MP:`, e);
      }
    }

    if (process.env.NODE_ENV === 'production' && !verifiedFromMp) {
      console.warn(`Webhook ${paymentId} não pôde ser verificado no Mercado Pago.`);
      return res.status(202).json({ received: true, paymentId, verified: false });
    }

    const isActivated = verifiedFromMp && newStatus === 'approved';

    // Update in memory cache
    const updatedPayment = {
      ...existing,
      paymentId,
      status: newStatus,
      statusDetail,
      paymentActivated: isActivated,
      verifiedFromMp,
      activatedAt: isActivated ? new Date().toISOString() : existing.activatedAt,
      updatedAt: new Date().toISOString(),
    };

    paymentStore[paymentId] = updatedPayment;

    // Update Firestore in real time so passenger and driver screens activate automatically!
    if (db) {
      try {
        const docRef = doc(db, 'pix_payments', String(paymentId));
        await setDoc(docRef, updatedPayment, { merge: true });
        console.log(`⚡ Firestore atualizado em tempo real para o pagamento ${paymentId}: Ativado = ${isActivated}`);
      } catch (e) {
        console.warn('Erro ao atualizar Firestore via webhook:', e);
      }
    }

    if (isActivated) {
      await applyApprovedPaymentEffects(updatedPayment);
    }

    res.status(200).json({
      received: true,
      paymentId,
      status: newStatus,
      paymentActivated: isActivated,
    });
  } catch (err: any) {
    console.error('Erro no processamento do webhook Mercado Pago:', err);
    res.status(200).send('OK');
  }
});

// 4. Query Payment Status
app.get('/api/mercadopago/payment-status/:id', async (req, res) => {
  const paymentId = req.params.id;
  if (!paymentId) return res.status(400).json({ error: 'ID do pagamento é obrigatório.' });

  let payment = paymentStore[paymentId];

  // Try fetching from Firestore if not in memory
  if (!payment && db) {
    try {
      const docRef = doc(db, 'pix_payments', paymentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        payment = snap.data();
        paymentStore[paymentId] = payment;
      }
    } catch (e) {
      console.warn('Erro ao buscar pagamento do Firestore:', e);
    }
  }

  // If pending and MP token configured, check live API
  const mpPayment = await getMercadoPagoPaymentClient();
  if (payment && payment.status === 'pending' && mpPayment && payment.isRealMercadoPago) {
    try {
      const mpData = await mpPayment.get({ id: paymentId });
      if (mpData && mpData.status !== payment.status) {
        payment.status = mpData.status || payment.status;
        payment.statusDetail = mpData.status_detail || payment.statusDetail;
        payment.paymentActivated = mpData.status === 'approved';
        payment.updatedAt = new Date().toISOString();

        if (payment.paymentActivated) {
          payment.activatedAt = new Date().toISOString();
        }

        paymentStore[paymentId] = payment;
        if (db) {
          await setDoc(doc(db, 'pix_payments', paymentId), payment, { merge: true });
        }
        if (payment.paymentActivated) {
          await applyApprovedPaymentEffects(payment);
        }
      }
    } catch (e) {
      console.warn('Erro ao consultar status no MP:', e);
    }
  }

  if (!payment) {
    return res.status(404).json({ error: 'Pagamento não encontrado.' });
  }

  res.json(payment);
});

// 5. Test Endpoint to Simulate Webhook Activation
app.post('/api/mercadopago/test-webhook', async (req, res) => {
  const simulationEnabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_PAYMENT_SIMULATION === 'true';

  if (!simulationEnabled) {
    return res.status(404).json({ error: 'Endpoint indisponível.' });
  }

  const { paymentId, status = 'approved', passengerSessionId, serviceIds } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: 'paymentId é obrigatório.' });

  let existing = paymentStore[paymentId] || {};

  // Vercel is serverless: another invocation may have created the payment.
  // Recover the payment context from Firestore before simulating its webhook.
  if (Object.keys(existing).length === 0 && db) {
    try {
      const stored = await getDoc(doc(db, 'pix_payments', String(paymentId)));
      if (stored.exists()) {
        existing = stored.data() || {};
      }
    } catch (e) {
      console.warn('Erro ao recuperar pagamento para simulação:', e);
    }
  }

  if (Object.keys(existing).length === 0) {
    return res.status(404).json({ error: 'Pagamento não encontrado para simulação.' });
  }

  const isApproved = status === 'approved';

  const updated = {
    ...existing,
    paymentId: String(paymentId),
    status,
    statusDetail: isApproved ? 'accredited' : status,
    paymentActivated: isApproved,
    verifiedFromMp: false,
    simulated: true,
    passengerSessionId:
      existing.passengerSessionId || (passengerSessionId ? String(passengerSessionId) : ''),
    serviceIds:
      Array.isArray(existing.serviceIds) && existing.serviceIds.length > 0
        ? existing.serviceIds
        : Array.isArray(serviceIds)
          ? serviceIds.map((id: any) => String(id)).filter(Boolean)
          : [],
    activatedAt: isApproved ? new Date().toISOString() : existing.activatedAt,
    updatedAt: new Date().toISOString(),
  };

  paymentStore[String(paymentId)] = updated;

  if (db) {
    try {
      const docRef = doc(db, 'pix_payments', String(paymentId));
      await setDoc(docRef, updated, { merge: true });
    } catch (e) {
      console.warn('Erro ao atualizar test-webhook no Firestore:', e);
    }
  }

  if (isApproved) {
    await applyApprovedPaymentEffects(updated);
  }

  res.json({
    success: true,
    message: 'Webhook simulado com sucesso!',
    payment: updated,
  });
});

// --- SERVER INTEGRATION & VITE MIDDLEWARE ---

async function startServer() {
  await loadSpotifySession();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Export the Express app so Vercel can run it as a serverless function.
export default app;

// Keep the existing local/dev server behavior, but never bind a port inside Vercel.
if (!process.env.VERCEL) {
  startServer();
}
