import fs from 'node:fs';
import crypto from 'node:crypto';

const projectId = 'elliptical-feat-379000';
const projectNumber = '429686789219';
const databaseId = 'ai-studio-pagamentopixmoto-1827ed66-1d2c-4f2e-a2c7-bf084ca8cdf1';

async function getAccessToken() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required.');
  const account = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key).toString('base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = await response.json() as any;
  if (!response.ok || !body.access_token) {
    throw new Error(`OAuth failed with HTTP ${response.status}`);
  }
  return body.access_token as string;
}

async function main() {
  const content = fs.readFileSync('firestore.rules', 'utf8');
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const source = { files: [{ name: 'firestore.rules', content }] };

  // Creating a ruleset performs Firebase Rules syntax/semantic validation.
  const rulesetResponse = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source,
        attachment_point: `firestore.googleapis.com/projects/${projectNumber}/databases/${databaseId}`,
      }),
    }
  );
  const ruleset = await rulesetResponse.json() as any;
  if (!rulesetResponse.ok || !ruleset.name) {
    throw new Error(`Ruleset create failed: HTTP ${rulesetResponse.status} ${JSON.stringify(ruleset)}`);
  }

  const releaseName = `projects/${projectId}/releases/cloud.firestore/${databaseId}`;
  const releasePayload = { name: releaseName, rulesetName: ruleset.name };

  const releaseResponse = await fetch(
    `https://firebaserules.googleapis.com/v1/${releaseName}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        release: releasePayload,
        updateMask: 'rulesetName',
      }),
    }
  );
  const releaseBody = await releaseResponse.json() as any;

  if (!releaseResponse.ok) {
    throw new Error(`Rules release failed: HTTP ${releaseResponse.status} ${JSON.stringify(releaseBody)}`);
  }

  const verifyResponse = await fetch(
    `https://firebaserules.googleapis.com/v1/${releaseName}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const verify = await verifyResponse.json() as any;
  if (!verifyResponse.ok || verify.rulesetName !== ruleset.name) {
    throw new Error(`Rules verification failed: HTTP ${verifyResponse.status}`);
  }

  console.log(`Firestore rules deployed and verified: ${verify.rulesetName}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
