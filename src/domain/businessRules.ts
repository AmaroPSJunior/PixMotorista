import { MercadoPagoPayment, Ride } from '../types';

export function isRideAccessible(ride: Ride | null, nowMs: number = Date.now()): boolean {
  if (!ride || ride.status !== 'active') return false;
  if (!ride.expiresAt) return true;
  return new Date(ride.expiresAt).getTime() > nowMs;
}

export function canDriverManageRide(driverUid: string | null | undefined, ride: Ride | null): boolean {
  return Boolean(driverUid && ride && ride.driverUid === driverUid);
}

export function isVerifiedPaymentForRide(
  payment: MercadoPagoPayment,
  rideId?: string | null,
  passengerSessionId?: string | null
): boolean {
  if (payment.status !== 'approved' || !payment.paymentActivated) return false;
  if (rideId && payment.rideId !== rideId) return false;
  if (passengerSessionId && payment.passengerSessionId !== passengerSessionId) return false;
  return true;
}


export const PASSENGER_REACTIVATION_MS = 24 * 60 * 60 * 1000;

export function buildPassengerClosedState(now: Date = new Date()) {
  const closedAt = now.toISOString();
  return {
    status: 'closed' as const,
    closedAt,
    reactivationExpiresAt: new Date(now.getTime() + PASSENGER_REACTIVATION_MS).toISOString(),
    updatedAt: closedAt,
  };
}

export function canReactivatePassenger(
  session: { createdAt: string; lastActiveAt?: string; reactivationExpiresAt?: string },
  nowMs: number = Date.now()
): boolean {
  const deadline = session.reactivationExpiresAt
    ? new Date(session.reactivationExpiresAt).getTime()
    : new Date(session.lastActiveAt || session.createdAt).getTime() + PASSENGER_REACTIVATION_MS;
  return Number.isFinite(deadline) && nowMs <= deadline;
}
