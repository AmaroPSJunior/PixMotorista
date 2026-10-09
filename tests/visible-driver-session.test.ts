import test from 'node:test';
import assert from 'node:assert/strict';

import type { PassengerSession } from '../src/types';
import { visibleDriverSession } from '../src/domain/visibleDriverSession';

const session = (id: string, status: PassengerSession['status'], lastActiveAt: string, extras: Partial<PassengerSession> = {}): PassengerSession => ({
  id,
  passengerName: id,
  browserId: id,
  createdAt: lastActiveAt,
  lastActiveAt,
  status,
  unlockedServices: [],
  ...extras,
});

test('driver shows only the most recently active passenger, regardless of list order', () => {
  const previous = session('Anterior', 'active', '2026-10-09T10:00:00Z');
  const current = session('Atual', 'active', '2026-10-09T11:00:00Z');
  const ended = session('Encerrado', 'closed', '2026-10-09T12:00:00Z', { closedAt: '2026-10-09T12:30:00Z' });

  assert.equal(visibleDriverSession([current, ended, previous])?.id, current.id);
});

test('when no passenger is active, driver shows the one most recently ended', () => {
  const old = session('Antigo', 'closed', '2026-10-09T11:00:00Z', { closedAt: '2026-10-09T11:30:00Z' });
  const latest = session('Último', 'expired', '2026-10-09T10:00:00Z', { updatedAt: '2026-10-09T12:00:00Z' });

  assert.equal(visibleDriverSession([latest, old])?.id, latest.id);
});

test('unnamed placeholder sessions do not appear in driver history', () => {
  assert.equal(visibleDriverSession([session('placeholder', 'active', '2026-10-09T12:00:00Z', { passengerName: 'Passageiro' })]), null);
  assert.equal(visibleDriverSession([]), null);
});
