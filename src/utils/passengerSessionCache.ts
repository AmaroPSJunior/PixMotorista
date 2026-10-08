import { PassengerSession } from '../types';

export const PASSENGER_SESSION_CACHE_KEY = 'pix_passenger_session_cache';

export function readPassengerSessionCache(): PassengerSession[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PASSENGER_SESSION_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.id) return [];

    return [{
      id: String(parsed.id),
      passengerName: String(parsed.passengerName || ''),
      browserId: String(parsed.browserId || ''),
      createdAt: String(parsed.createdAt || new Date().toISOString()),
      lastActiveAt: String(parsed.lastActiveAt || parsed.createdAt || new Date().toISOString()),
      status: parsed.status === 'expired' || parsed.status === 'closed' ? parsed.status : 'active',
      unlockedServices: Array.isArray(parsed.unlockedServices) ? parsed.unlockedServices.map(String) : [],
      purchasedProducts:
        parsed.purchasedProducts && typeof parsed.purchasedProducts === 'object'
          ? parsed.purchasedProducts
          : {},
      hasMusicUnlocked: Boolean(parsed.hasMusicUnlocked),
      paidAmount: Number(parsed.paidAmount) || 0,
      paymentId: parsed.paymentId ? String(parsed.paymentId) : '',
      notes: parsed.notes ? String(parsed.notes) : '',
      isRidePaid: Boolean(parsed.isRidePaid),
      paidRideAmount: Number(parsed.paidRideAmount) || 0,
      ridePrice: Number(parsed.ridePrice) || 0,
      driverEmail: parsed.driverEmail ? String(parsed.driverEmail) : '',
      driverUid: parsed.driverUid ? String(parsed.driverUid) : '',
      rideId: parsed.rideId ? String(parsed.rideId) : '',
      authUid: parsed.authUid ? String(parsed.authUid) : '',
      closedAt: parsed.closedAt ? String(parsed.closedAt) : undefined,
      reactivationExpiresAt: parsed.reactivationExpiresAt ? String(parsed.reactivationExpiresAt) : undefined,
      updatedAt: parsed.updatedAt ? String(parsed.updatedAt) : undefined,
      lastResourceChangeAt: parsed.lastResourceChangeAt ? String(parsed.lastResourceChangeAt) : undefined,
      resourceRevision: Number(parsed.resourceRevision) || 0,
    }];
  } catch {
    return [];
  }
}

export function writePassengerSessionCache(session: PassengerSession | null | undefined): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (!session || session.status !== 'active') {
      localStorage.removeItem(PASSENGER_SESSION_CACHE_KEY);
      return;
    }
    localStorage.setItem(PASSENGER_SESSION_CACHE_KEY, JSON.stringify(session));
  } catch {}
}

export function clearPassengerSessionCache(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(PASSENGER_SESSION_CACHE_KEY);
  } catch {}
}
