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
