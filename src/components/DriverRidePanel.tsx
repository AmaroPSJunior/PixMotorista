import React, { useEffect, useState } from 'react';
import { Car, CheckCircle2, Play, Square, UserRound } from 'lucide-react';
import { PassengerSession } from '../types';

interface DriverRidePanelProps {
  activeSession?: PassengerSession;
  ridePrice: number;
  isRidePaid: boolean;
  onStartRide: (price: number) => void;
  onEndRide: () => void;
  passengerUrl?: string;
}

export const DriverRidePanel: React.FC<DriverRidePanelProps> = ({
  activeSession,
  ridePrice,
  isRidePaid,
  onStartRide,
  onEndRide,
  passengerUrl,
}) => {
  const [priceInput, setPriceInput] = useState(ridePrice > 0 ? String(ridePrice) : '');

  useEffect(() => {
    setPriceInput(ridePrice > 0 ? String(ridePrice) : '');
  }, [ridePrice]);

  const parsedPrice = Number(String(priceInput).replace(',', '.')) || 0;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-slate-900 text-sm">Corrida atual</h2>
            <p className="text-xs text-slate-500">
              {activeSession ? 'Em andamento' : 'Nenhuma corrida ativa'}
            </p>
          </div>
        </div>

        {activeSession && (
          <span className="text-[11px] font-black rounded-full px-2.5 py-1 bg-emerald-100 text-emerald-800">
            ATIVA
          </span>
        )}
      </div>

      {activeSession ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">Passageiro</span>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <UserRound className="w-4 h-4" />
                {activeSession.passengerName || 'Passageiro'}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">Pagamento</span>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <CheckCircle2 className={`w-4 h-4 ${isRidePaid ? 'text-emerald-500' : 'text-slate-400'}`} />
                {isRidePaid ? 'Pago' : 'Pendente'}
              </div>
            </div>
          </div>

          {passengerUrl && (
            <a
              href={passengerUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 break-all"
            >
              Abrir link do passageiro desta corrida
            </a>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Valor da corrida</span>
              <div className="text-lg font-black text-slate-900">
                R$ {(ridePrice || 0).toFixed(2).replace('.', ',')}
              </div>
            </div>

            <button
              type="button"
              onClick={onEndRide}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-2"
            >
              <Square className="w-4 h-4 fill-current" />
              Encerrar corrida
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Valor da corrida (opcional)</span>
            <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
              <span className="text-sm font-bold text-slate-500">R$</span>
              <input
                inputMode="decimal"
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
                placeholder="0,00"
                className="w-full bg-transparent p-3 text-sm font-bold text-slate-900 outline-none"
              />
            </div>
          </label>

          <button
            type="button"
            onClick={() => onStartRide(parsedPrice)}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            Nova corrida
          </button>
        </div>
      )}
    </section>
  );
};
