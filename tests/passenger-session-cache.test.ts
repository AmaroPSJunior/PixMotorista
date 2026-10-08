import test from 'node:test';
import assert from 'node:assert/strict';

import { getNewlyUnlockedServiceIds } from '../src/domain/serviceIds';

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
