import React from 'react';
import { CarFront, LogOut, Settings2, Users } from 'lucide-react';
import type { DriverProfile } from '../types';
import { APP_VERSION } from '../version';

interface DriverAutomotiveHeaderProps {
  driver: DriverProfile;
  onOpenSettings: () => void;
  onPassengerView: () => void;
  onLogout: () => void;
}

export const DriverAutomotiveHeader: React.FC<DriverAutomotiveHeaderProps> = ({
  driver,
  onOpenSettings,
  onPassengerView,
  onLogout,
}) => (
  <header className="bg-[#081b29] border-b border-sky-400/30 text-white px-4 sm:px-6 py-4">
    <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-14 h-14 rounded-2xl bg-sky-400 text-slate-950 flex items-center justify-center shrink-0">
          <CarFront className="w-8 h-8" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold tracking-widest uppercase text-sky-300">Central do motorista</p>
          <h1 className="text-xl sm:text-2xl font-black truncate">{driver.name || 'Painel de pagamentos'}</h1>
          <p className="text-sm text-slate-300 truncate">
            {[driver.carModel, driver.licensePlate].filter(Boolean).join(' • ') || `PixMotorista ${APP_VERSION}`}
          </p>
        </div>
      </div>
      <nav aria-label="Ações do motorista" className="flex flex-wrap gap-2 w-full sm:w-auto">
        <button type="button" onClick={onOpenSettings}
          className="min-h-14 min-w-14 flex-1 sm:flex-none px-4 rounded-2xl bg-sky-400 text-slate-950 text-base font-black flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-4 focus-visible:outline-white">
          <Settings2 className="w-6 h-6" aria-hidden="true" /> Configurações
        </button>
        <button type="button" onClick={onPassengerView}
          className="min-h-14 min-w-14 px-4 rounded-2xl border border-slate-500 text-white text-base font-bold flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky-300">
          <Users className="w-6 h-6" aria-hidden="true" /> <span className="hidden lg:inline">Visão passageiro</span>
          <span className="sr-only lg:hidden">Visão passageiro</span>
        </button>
        <button type="button" onClick={onLogout} aria-label="Sair da conta do motorista"
          className="min-h-14 min-w-14 px-4 rounded-2xl border border-slate-500 text-white flex items-center justify-center focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky-300">
          <LogOut className="w-6 h-6" aria-hidden="true" />
        </button>
      </nav>
    </div>
  </header>
);
