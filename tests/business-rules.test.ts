import test from 'node:test';
import assert from 'node:assert/strict';
import { canDriverManageRide, isRideAccessible, isVerifiedPaymentForRide } from '../src/domain/businessRules';
import { Ride } from '../src/types';

const baseRide: Ride = {
  id: 'ride_1',
  driverUid: 'driver_1',
  driverEmail: 'driver@example.com',
  status: 'active',
  paymentStatus: 'unpaid',
  price: 20,
  createdAt: '2026-10-07T00:00:00.000Z',
  startedAt: '2026-10-07T00:00:00.000Z',
  expiresAt: '2026-10-07T01:00:00.000Z',
  defaultUnlockedServices: [],
};

test('active non-expired ride is accessible', () => {
  assert.equal(isRideAccessible(baseRide, new Date('2026-10-07T00:30:00.000Z').getTime()), true);
});

test('expired or completed ride is not accessible', () => {
  assert.equal(isRideAccessible(baseRide, new Date('2026-10-07T02:00:00.000Z').getTime()), false);
  assert.equal(isRideAccessible({ ...baseRide, status: 'completed' }), false);
});

test('only owning driver manages a ride', () => {
  assert.equal(canDriverManageRide('driver_1', baseRide), true);
  assert.equal(canDriverManageRide('driver_2', baseRide), false);
});

test('payment must be approved, activated and scoped to ride/session', () => {
  const payment = {
    paymentId: 'pay_1',
    amount: 20,
    description: 'Corrida',
    status: 'approved' as const,
    paymentActivated: true,
    rideId: 'ride_1',
    passengerSessionId: 'sess_1',
  };
  assert.equal(isVerifiedPaymentForRide(payment, 'ride_1', 'sess_1'), true);
  assert.equal(isVerifiedPaymentForRide({ ...payment, paymentActivated: false }, 'ride_1', 'sess_1'), false);
  assert.equal(isVerifiedPaymentForRide(payment, 'ride_2', 'sess_1'), false);
  assert.equal(isVerifiedPaymentForRide(payment, 'ride_1', 'sess_2'), false);
});
