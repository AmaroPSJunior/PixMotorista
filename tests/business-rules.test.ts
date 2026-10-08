import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPassengerClosedState, canDriverManageRide, canReactivatePassenger, isPassengerCloseTerminalStatus, isRideAccessible, isVerifiedPaymentForRide, PASSENGER_REACTIVATION_MS } from '../src/domain/businessRules';
import { getNewlyUnlockedServiceIds } from '../src/domain/serviceIds';
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


test('passenger close state keeps exactly 24h of reactivation history', () => {
  const now = new Date('2026-10-07T16:00:00.000Z');
  const closed = buildPassengerClosedState(now);
  assert.equal(closed.status, 'closed');
  assert.equal(closed.closedAt, now.toISOString());
  assert.equal(
    new Date(closed.reactivationExpiresAt).getTime() - now.getTime(),
    PASSENGER_REACTIVATION_MS
  );
  assert.equal(
    canReactivatePassenger(
      { createdAt: now.toISOString(), reactivationExpiresAt: closed.reactivationExpiresAt },
      now.getTime() + PASSENGER_REACTIVATION_MS
    ),
    true
  );
  assert.equal(
    canReactivatePassenger(
      { createdAt: now.toISOString(), reactivationExpiresAt: closed.reactivationExpiresAt },
      now.getTime() + PASSENGER_REACTIVATION_MS + 1
    ),
    false
  );
});


test('404 from close is treated as already-closed logout, while auth/server errors are not', () => {
  assert.equal(isPassengerCloseTerminalStatus(200), true);
  assert.equal(isPassengerCloseTerminalStatus(204), true);
  assert.equal(isPassengerCloseTerminalStatus(404), true);
  assert.equal(isPassengerCloseTerminalStatus(401), false);
  assert.equal(isPassengerCloseTerminalStatus(403), false);
  assert.equal(isPassengerCloseTerminalStatus(500), false);
});


test('detects only newly unlocked canonical services from remote updates', () => {
  assert.deepEqual(
    getNewlyUnlockedServiceIds(['wifi'], ['1', 'spotify_music', 'charger']),
    ['spotify_music', 'charger']
  );
  assert.deepEqual(
    getNewlyUnlockedServiceIds(['spotify_music'], ['2']),
    []
  );
});
