import React, { useMemo, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import {
  DEFAULT_RIDE_PRESETS,
  normalizeRidePreset,
  RidePreset,
} from '../domain/ridePresets';

interface DriverRidePresetsProps {
  onSelect: (preset: RidePreset) => void;
}

const STORAGE_KEY = 'pix_driver_selected_ride_preset';

export const DriverRidePresets: React.FC<DriverRidePresetsProps> = ({ onSelect }) => {
  const initial = useMemo(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'standard';
    } catch {
      return 'standard';
    }
  }, []);

  const [selectedId, setSelectedId] = useState(initial);

  const selectPreset = (preset: RidePreset) => {
    const normalized = normalizeRidePreset(preset);
    setSelectedId(normalized.id);
    try {
      localStorage.setItem(STORAGE_KEY, normalized.id);
    } catch {}
    onSelect(normalized);
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <div>
          <h2 className="font-black text-sm text-slate-900">Modo da corrida</h2>
          <p className="text-xs text-slate-500">Escolha uma configuração rápida</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {DEFAULT_RIDE_PRESETS.map((preset) => {
          const selected = selectedId === preset.id;
          return (
            <button
              type="button"
              key={preset.id}
              onClick={() => selectPreset(preset)}
              className={`text-left rounded-xl border p-3 transition-all ${
                selected
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-900">
                  {preset.name}
                </span>
                {selected && <Check className="w-4 h-4 text-emerald-600" />}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {preset.description}
              </p>
              <div className="mt-2 text-[10px] font-bold text-slate-400">
                Sessão: {preset.autoExpireMinutes} min
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
