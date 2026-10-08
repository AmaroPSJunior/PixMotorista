export function normalizeSpotifyDeviceName(name: string): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isPreferredBioIdVehicleDevice(name: string): boolean {
  const normalized = normalizeSpotifyDeviceName(name);
  return normalized.includes('bioid') && normalized.includes('veiculo');
}

export function pickDefaultSpotifyDevice<T extends { id?: string; name?: string; is_active?: boolean }>(
  devices: T[]
): T | undefined {
  return (
    devices.find((device) => isPreferredBioIdVehicleDevice(device.name || '')) ||
    devices.find((device) => device.is_active) ||
    devices.find((device) =>
      /car|som|veiculo|bluetooth|automotive/i.test(
        normalizeSpotifyDeviceName(device.name || '')
      )
    ) ||
    devices[0]
  );
}
