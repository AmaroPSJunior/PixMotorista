import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isPreferredBioIdVehicleDevice,
  pickDefaultSpotifyDevice,
} from '../src/domain/spotifyDevice';

test('BioID Veículo é reconhecido como dispositivo Spotify padrão', () => {
  assert.equal(isPreferredBioIdVehicleDevice('BioID Veículo'), true);
  assert.equal(isPreferredBioIdVehicleDevice('BIOID VEICULO'), true);
  assert.equal(isPreferredBioIdVehicleDevice('Meu celular'), false);
});

test('BioID Veículo tem prioridade até sobre outro dispositivo ativo', () => {
  const devices = [
    { id: 'phone', name: 'Galaxy', is_active: true },
    { id: 'bioid', name: 'BioID Veículo', is_active: false },
  ];

  assert.equal(pickDefaultSpotifyDevice(devices)?.id, 'bioid');
});
