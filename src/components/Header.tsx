import React from 'react';
import { Star, Car, Settings, User, Eye, ArrowLeftRight, LogOut, Zap, Tag } from 'lucide-react';
import { DriverProfile } from '../types';
import { APP_VERSION } from '../version';

interface HeaderProps {
  driver: DriverProfile;
  passengerName?: string;
  onOpenEditModal: () => void;
  onOpenMercadoPagoModal?: () => void;
  viewMode: 'driver' | 'passenger';
  onToggleViewMode: () => void;
  isDevEnv?: boolean;
  onGoogleLogout?: () => void;
  onPassengerExit?: () => void;
  passengerSessionActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  driver,
  passengerName,
  onOpenEditModal,
  onOpenMercadoPagoModal,
  viewMode,
  onToggleViewMode,
  isDevEnv = true,
  onGoogleLogout,
  onPassengerExit,
  passengerSessionActive = false,
}) => {
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [driver.photoUrl]);

  const isPassenger = viewMode === 'passenger';
  const isDriver = viewMode === 'driver';

  return (
    <header className="bg-slate-900 text-white pt-5 pb-7 px-4 rounded-b-3xl shadow-lg relative overflow-hidden">
      {/* Subtle decorative background pattern */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="max-w-xl mx-auto">
        {/* Top bar with release version badge on the left (driver only) and quick utility buttons on the right */}
        <div className="flex items-center justify-between gap-2 mb-4 text-xs font-medium">
          {/* Release Version Badge - Top Left Corner (ONLY visible in driver view) */}
          {isDriver ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-xs shrink-0"
              title={`Release ${APP_VERSION}`}
            >
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <span>Release {APP_VERSION}</span>
            </span>
          ) : (
            <div />
          )}

          {/* Controls visible in dev/test environment or driver mode */}
          {isDevEnv && (
            <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
              {/* Passenger View / Driver Mode Toggle Button */}
              <button
                onClick={onToggleViewMode}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all shadow-sm active:scale-95 ${
                  isPassenger
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/50'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white ring-2 ring-indigo-500/40'
                }`}
                title={isPassenger ? 'Alternar para Painel de Configuração do Motorista' : 'Alternar para Visualização do Passageiro'}
              >
                {isPassenger ? (
                  <>
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Modo Motorista</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-indigo-200" />
                    <span>Visão do Passageiro</span>
                  </>
                )}
              </button>

              {!isPassenger && (
                <>
                  {onOpenMercadoPagoModal && (
                    <button
                      onClick={onOpenMercadoPagoModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-colors shadow-xs"
                      title="Configurações e Webhook Mercado Pago"
                    >
                      <Zap className="w-3.5 h-3.5 text-sky-200 fill-current" />
                      <span className="hidden sm:inline">Mercado Pago</span>
                    </button>
                  )}

                  <button
                    onClick={onOpenEditModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow-xs"
                    title="Configurações do Motorista"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Configurações</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Driver or Passenger info row */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {isPassenger ? (
              <>
                {/* Passenger Avatar Badge */}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 border-2 border-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
                    <User className="w-8 h-8 text-slate-950" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-full flex items-center justify-center" title="Sessão A Bordo Ativa">
                    <span className="w-1.5 h-1.5 bg-slate-950 rounded-full animate-pulse" />
                  </span>
                </div>

                {/* Passenger Name & Vehicle Info */}
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white truncate">
                    {passengerName || 'Passageiro'}
                  </h1>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <div className="flex items-center gap-1.5 text-slate-200 font-medium bg-slate-800/90 px-2.5 py-1 rounded-xl border border-slate-700/80">
                      <Car className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Veículo: <strong className="text-white font-bold">{driver.carModel || 'Veículo'}</strong></span>
                      {driver.carColor && <span className="text-slate-400">({driver.carColor})</span>}
                      {driver.name && (
                        <span className="text-slate-400 ml-1 border-l border-slate-700 pl-1.5">
                          Motorista: <strong className="text-slate-200">{driver.name}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="relative shrink-0">
                  {driver.photoUrl && !imageError ? (
                    <img
                      src={driver.photoUrl}
                      alt={driver.name || 'Motorista'}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-md bg-slate-800"
                      referrerPolicy="no-referrer"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800 border-2 border-amber-500/50 flex flex-col items-center justify-center text-amber-400 p-1">
                      <User className="w-7 h-7" />
                      <span className="text-[9px] font-bold mt-0.5 text-amber-300 uppercase">Sem Login</span>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
                    {driver.name || 'Aguardando Sincronização Google'}
                  </h1>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    {driver.carModel || driver.licensePlate ? (
                      <>
                        {driver.carModel && (
                          <div className="flex items-center gap-1 text-slate-200 font-medium">
                            <Car className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{driver.carModel}</span>
                          </div>
                        )}
                        {driver.carColor && (
                          <span className="text-slate-400">({driver.carColor})</span>
                        )}
                        {driver.licensePlate && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700">
                            {driver.licensePlate}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-amber-400 font-medium">
                        Perfil não sincronizado no banco de dados
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {isPassenger && passengerSessionActive && onPassengerExit && (
            <button
              data-testid="passenger-exit-button"
              onClick={onPassengerExit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold transition-colors shadow-xs shrink-0 self-end"
              title="Sair da sessão do passageiro"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Sair</span>
            </button>
          )}

          {/* Sair button aligned on the right side in line with driver info, bottom right */}
          {driver.googleAuthenticated && onGoogleLogout && isDriver && (
            <button
              onClick={onGoogleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold transition-colors shadow-xs shrink-0 self-end"
              title="Sair da Conta Google"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Sair</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

