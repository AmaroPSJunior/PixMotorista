import React, { useState } from 'react';
import { UserCheck, Zap, Loader2 } from 'lucide-react';
import { PassengerSession, SessionSettings } from '../types';
import { getOrCreateBrowserId } from '../utils/browserId';
import { savePassengerSession, closeAllPreviousPassengerSessionsExcept } from '../lib/firebase';

interface PassengerRegistrationModalProps {
  isOpen: boolean;
  settings: SessionSettings;
  driverName?: string;
  carModel?: string;
  driverEmail?: string;
  onRegistered: (sessionId: string, initialRidePrice?: number) => void;
}

export const PassengerRegistrationModal: React.FC<PassengerRegistrationModalProps> = ({
  isOpen,
  settings,
  driverName,
  carModel,
  driverEmail,
  onRegistered,
}) => {
  const [nameInput, setNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const browserId = getOrCreateBrowserId();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) return;

    setIsSubmitting(true);
    try {
      const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();

      const newSession: PassengerSession = {
        id: newSessionId,
        passengerName: cleanName,
        browserId,
        createdAt: nowIso,
        lastActiveAt: nowIso,
        status: 'active',
        unlockedServices: [],
        hasMusicUnlocked: false,
        driverEmail: driverEmail || '',
      };

      // Store local passenger identification for strict session validation
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pix_registered_passenger_name', cleanName);
        localStorage.setItem('pix_registered_session_id', newSessionId);
      }

      // Rule: Single Session vs Multi Passenger Mode
      if (!settings.allowMultiPassengerMode) {
        await closeAllPreviousPassengerSessionsExcept(newSessionId, driverEmail);
      }

      await savePassengerSession(newSession);
      onRegistered(newSessionId);
    } catch (err) {
      console.error('Erro ao registrar sessão no Firebase:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn">
      {/* Radial Background Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/30 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-500/10 space-y-6 text-white text-center">
        
        {/* Top Header Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
            <UserCheck className="w-8 h-8" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Seja Bem-Vindo(a)!
          </h2>

          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {driverName ? `Motorista: ${driverName}` : 'Veículo Conectado'} {carModel ? `(${carModel})` : ''}
          </p>
        </div>

        {/* Mandatory Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <span>Seu Nome de Passageiro:</span>
              <span className="text-rose-400 font-bold">*</span>
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ex: João / Maria"
              required
              disabled={isSubmitting}
              autoFocus
              className="w-full px-4 py-3 bg-slate-950 border-2 border-emerald-500/50 rounded-2xl text-white font-bold text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 transition-all disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={!nameInput.trim() || isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2 text-slate-950 font-extrabold">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Cadastrando e conectando...</span>
              </div>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Entrar no Veículo & Liberar Painel</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
