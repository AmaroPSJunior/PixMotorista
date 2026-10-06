import { normalizeServiceIds, SERVICE_IDS } from './serviceIds';

export interface RidePreset {
  id: string;
  name: string;
  description: string;
  defaultPrice: number;
  autoExpireMinutes: number;
  unlockedServices: string[];
}

export const DEFAULT_RIDE_PRESETS: RidePreset[] = [
  {
    id: 'standard',
    name: 'Padrão',
    description: 'Corrida simples, sem extras liberados automaticamente.',
    defaultPrice: 0,
    autoExpireMinutes: 30,
    unlockedServices: [],
  },
  {
    id: 'comfort',
    name: 'Conforto',
    description: 'Wi-Fi e carregador liberados durante a corrida.',
    defaultPrice: 0,
    autoExpireMinutes: 45,
    unlockedServices: [SERVICE_IDS.WIFI, SERVICE_IDS.CHARGER],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Wi-Fi, carregador e música liberados.',
    defaultPrice: 0,
    autoExpireMinutes: 60,
    unlockedServices: [
      SERVICE_IDS.WIFI,
      SERVICE_IDS.CHARGER,
      SERVICE_IDS.MUSIC,
    ],
  },
];

export function normalizeRidePreset(preset: RidePreset): RidePreset {
  return {
    ...preset,
    defaultPrice: Math.max(0, Number(preset.defaultPrice) || 0),
    autoExpireMinutes: Math.max(1, Number(preset.autoExpireMinutes) || 30),
    unlockedServices: normalizeServiceIds(preset.unlockedServices || []),
  };
}
