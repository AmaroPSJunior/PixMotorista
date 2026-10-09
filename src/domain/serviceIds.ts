export const SERVICE_IDS = {
  WIFI: 'wifi',
  MUSIC: 'spotify_music',
  CHARGER: 'charger',
} as const;

const LEGACY_ALIASES: Record<string, string> = {
  '1': SERVICE_IDS.WIFI,
  wifi: SERVICE_IDS.WIFI,
  'wi-fi': SERVICE_IDS.WIFI,
  '2': SERVICE_IDS.MUSIC,
  spotify_music: SERVICE_IDS.MUSIC,
  spotify: SERVICE_IDS.MUSIC,
  music: SERVICE_IDS.MUSIC,
  musica: SERVICE_IDS.MUSIC,
  'música': SERVICE_IDS.MUSIC,
  '3': SERVICE_IDS.CHARGER,
  charger: SERVICE_IDS.CHARGER,
  carregador: SERVICE_IDS.CHARGER,
};

export function normalizeServiceId(value: string): string {
  const normalized = String(value || '').trim().toLowerCase();
  return LEGACY_ALIASES[normalized] || normalized;
}

export function normalizeServiceIds(values: string[] = []): string[] {
  return Array.from(new Set(values.map(normalizeServiceId).filter(Boolean)));
}

export function isCanonicalUnlockableService(value: string): boolean {
  const id = normalizeServiceId(value);
  return id === SERVICE_IDS.WIFI || id === SERVICE_IDS.MUSIC || id === SERVICE_IDS.CHARGER;
}


export function getNewlyUnlockedServiceIds(
  previous: string[] = [],
  current: string[] = []
): string[] {
  const previousSet = new Set(normalizeServiceIds(previous));
  return normalizeServiceIds(current).filter((id) => !previousSet.has(id));
}

export function getNewlyLockedServiceIds(previous: string[] = [], current: string[] = []): string[] {
  const currentSet = new Set(normalizeServiceIds(current));
  return normalizeServiceIds(previous).filter((id) => !currentSet.has(id));
}
