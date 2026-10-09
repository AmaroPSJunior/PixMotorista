import test from 'node:test';
import assert from 'node:assert/strict';

import { getNewlyLockedServiceIds, getNewlyUnlockedServiceIds } from '../src/domain/serviceIds';

test('remote unlock delta keeps already unlocked services out of notification', () => {
  assert.deepEqual(
    getNewlyUnlockedServiceIds(['wifi'], ['wifi', 'spotify_music']),
    ['spotify_music']
  );
});

test('canonical aliases do not trigger duplicate remote unlock notifications', () => {
  assert.deepEqual(
    getNewlyUnlockedServiceIds(['2'], ['spotify_music']),
    []
  );
});

test('remote revocation identifies canonical resources without duplicate aliases', () => {
  assert.deepEqual(
    getNewlyLockedServiceIds(['2', 'wifi', 'charger'], ['spotify_music', 'charger']),
    ['wifi']
  );
  assert.deepEqual(getNewlyLockedServiceIds(['spotify_music'], []), ['spotify_music']);
});
