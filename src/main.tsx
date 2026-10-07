import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const CANONICAL_APP_URL = 'https://pix-motorista.vercel.app';
const LEGACY_PUBLIC_HOSTS = new Set([
  'pagamento-pix-motorista.ai.studio',
]);

function redirectLegacyPublicHost(): boolean {
  if (typeof window === 'undefined') return false;

  const host = window.location.hostname.toLowerCase();
  if (!LEGACY_PUBLIC_HOSTS.has(host)) return false;

  const current = new URL(window.location.href);
  const target = new URL(CANONICAL_APP_URL);

  if (current.pathname === '/' || current.pathname === '') {
    target.pathname = '/passageiro';
  } else {
    target.pathname = current.pathname;
  }

  current.searchParams.delete('view');
  target.search = current.searchParams.toString();
  target.hash = current.hash;

  window.location.replace(target.toString());
  return true;
}

if (!redirectLegacyPublicHost()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
