import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_SERVICES } from '../src/data/defaultData';

test('fresh and reset catalogs contain only the three vehicle resources', () => {
  assert.deepEqual(DEFAULT_SERVICES.map((service) => service.id), ['wifi', 'spotify_music', 'charger']);
  assert.ok(DEFAULT_SERVICES.every((service) => service.itemType === 'servico'));
});
