export const PUBLIC_APP_URL = 'https://pix-motorista.vercel.app';
export const DEFAULT_DRIVER_EMAIL = 'arcamos.j@gmail.com';

/**
 * Checks whether the current page is being executed in the internal development or test environment.
 */
export function isDevEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const href = window.location.href;
  const params = new URLSearchParams(window.location.search);

  // Explicit test or dev URL parameters
  if (
    params.get('mode') === 'test' ||
    params.get('dev') === 'true' ||
    params.get('test') === 'true'
  ) {
    return true;
  }

  // Detect Cloud Run container preview and Google AI Studio test domains
  return (
    host.includes('ais-dev-') ||
    host.includes('ais-pre-') ||
    host.includes('run.app') ||
    host.includes('aistudio') ||
    host.includes('google.com') ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    href.includes('aistudio.google.com')
  );
}

/**
 * Reads driver email from URL query string parameters if present
 * (supports ?driver=..., ?driverEmail=..., ?driver_email=..., ?email=..., ?m=...).
 */
export function getDriverEmailFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const driverParam =
    params.get('driver') ||
    params.get('driverEmail') ||
    params.get('driver_email') ||
    params.get('email') ||
    params.get('m');
  if (driverParam) {
    const clean = driverParam.trim().toLowerCase();
    if (clean) return clean;
  }
  return null;
}

/**
 * Resolves the effective driver email for loading profile data and saving sessions.
 * Priority:
 * 1. URL search parameter (?driver=...)
 * 2. Passed explicitly or from current driver state
 * 3. Saved localStorage driver email
 * 4. Fallback to default printed QR code email (arcamos.j@gmail.com)
 */
export function getEffectiveDriverEmail(explicitEmail?: string): string {
  const fromUrl = getDriverEmailFromUrl();
  if (fromUrl) return fromUrl;

  if (explicitEmail && explicitEmail.trim()) {
    return explicitEmail.trim().toLowerCase();
  }

  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('pix_driver_google_email');
    if (saved && saved.trim()) {
      return saved.trim().toLowerCase();
    }
  }

  return DEFAULT_DRIVER_EMAIL;
}

/**
 * Helper to get the 100% public URL for the passenger view with driver parameter.
 * Uses the official published domain or current window origin, attaching ?driver=<driverEmail>.
 */
export function getPublicPassengerUrl(customPublicUrl?: string, driverEmail?: string): string {
  const targetEmail = driverEmail || getEffectiveDriverEmail();

  if (customPublicUrl && customPublicUrl.trim().length > 0) {
    let url = customPublicUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    if (!url.includes('view=')) {
      url += url.includes('?') ? '&view=passenger' : '?view=passenger';
    }
    if (!url.includes('driver=')) {
      url += `&driver=${encodeURIComponent(targetEmail)}`;
    }
    return url;
  }

  // Use current window origin if available, or fall back to production PUBLIC_APP_URL
  const baseUrl = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : PUBLIC_APP_URL;
  return `${baseUrl}/passageiro?driver=${encodeURIComponent(targetEmail)}`;
}



export type AppExperience = 'driver' | 'passenger';

export function getExperienceFromUrl(): AppExperience {
  if (typeof window === 'undefined') return 'passenger';
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/motorista') return 'driver';
  return 'passenger';
}

export function getRideIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('ride') || params.get('rideId');
  return raw && raw.trim() ? raw.trim() : null;
}

export function navigateToExperience(experience: AppExperience, rideId?: string | null, driverEmail?: string): void {
  if (typeof window === 'undefined') return;
  const base = experience === 'driver' ? '/motorista' : '/passageiro';
  const params = new URLSearchParams();
  if (experience === 'passenger') {
    if (rideId) params.set('ride', rideId);
    if (driverEmail) params.set('driver', driverEmail);
  }
  const query = params.toString();
  window.history.pushState({}, '', query ? `${base}?${query}` : base);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
