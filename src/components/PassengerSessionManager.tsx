import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Users,
  Clock,
  ShieldCheck,
  Zap,
  Lock,
  Unlock,
  Power,
  RefreshCw,
  Trash2,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Music,
  Wifi,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { PassengerSession, SessionSettings, AdditionalService } from '../types';
import { DEFAULT_SERVICES } from '../data/defaultData';
import { getOrCreateBrowserId } from '../utils/browserId';
import { DeviceHistoryView } from './DeviceHistoryView';
import {
  savePassengerSession,
  updatePassengerSessionStatus,
  closeAllPreviousPassengerSessionsExcept,
  toggleSessionServiceUnlock,
  saveSessionSettings,
} from '../lib/firebase';
import { normalizeServiceId, normalizeServiceIds, SERVICE_IDS } from '../domain/serviceIds';
import { getCurrentIdToken } from '../lib/auth';

interface PassengerSessionManagerProps {
  viewMode: 'driver' | 'passenger';
  sessions: PassengerSession[];
  settings: SessionSettings;
  services: AdditionalService[];
  activeSessionId: string | null;
  onSetActiveSessionId: (id: string | null) => void;
  isDevEnv?: boolean;
  driverEmail?: string;
  requirePassengerIdentification?: boolean;
  onIdentifyPassenger?: (name: string) => Promise<void>;
  onSessionUpdated?: (session: PassengerSession) => void;
}

export const PassengerSessionManager: React.FC<PassengerSessionManagerProps> = ({
  viewMode,
  sessions,
  settings,
  services,
  activeSessionId,
  onSetActiveSessionId,
  isDevEnv = false,
  driverEmail,
  requirePassengerIdentification = false,
  onIdentifyPassenger,
  onSessionUpdated,
}) => {
  const browserId = getOrCreateBrowserId();
  const [passengerNameInput, setPassengerNameInput] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [activeDriverTab, setActiveDriverTab] = useState<'sessions' | 'devices'>('sessions');
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [identifyError, setIdentifyError] = useState('');
  const [isIdentifyingPassenger, setIsIdentifyingPassenger] = useState(false);

  const registeredName = (
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('pix_registered_passenger_name') || ''
      : ''
  ).trim().toLowerCase();

  const registeredSessionId =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('pix_registered_session_id') || ''
      : '';

  // Find current active session for this browser device and passenger name
  const currentDeviceAnySession = sessions.find((s) => {
    if (s.browserId !== browserId) return false;
    if (registeredName && s.passengerName.trim().toLowerCase() !== registeredName) {
      return false;
    }
    if (registeredSessionId && s.id !== registeredSessionId) {
      return false;
    }
    return true;
  });

  const isFreshPassengerE2E =
    isDevEnv &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('__e2ePassengerFresh');

  const currentDeviceSession =
    currentDeviceAnySession?.status === 'active'
      ? currentDeviceAnySession
      : isFreshPassengerE2E
        ? ({
            id: 'e2e-fresh-session',
            passengerName: 'Passageiro',
            browserId,
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            status: 'active',
            unlockedServices: [],
            hasMusicUnlocked: false,
          } as PassengerSession)
        : undefined;

  // Auto-fill only a real passenger name, never the generic placeholder.
  useEffect(() => {
    if (
      currentDeviceSession &&
      currentDeviceSession.passengerName &&
      currentDeviceSession.passengerName.trim().toLowerCase() !== 'passageiro' &&
      !passengerNameInput
    ) {
      setPassengerNameInput(currentDeviceSession.passengerName);
      if (activeSessionId !== currentDeviceSession.id) {
        onSetActiveSessionId(currentDeviceSession.id);
      }
    }
  }, [currentDeviceSession]);

  // Only the authenticated driver may expire passenger sessions.
  useEffect(() => {
    if (viewMode !== 'driver') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const expireMs = settings.autoExpireMinutes * 60 * 1000;

      sessions.forEach((session) => {
        if (session.status === 'active' && settings.autoExpireMinutes > 0) {
          const lastActiveMs = new Date(session.lastActiveAt).getTime();
          if (now - lastActiveMs > expireMs) {
            updatePassengerSessionStatus(session.id, 'expired');
          }
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [viewMode, sessions, settings.autoExpireMinutes]);

  // Passenger identification is required before the passenger UI is unlocked.
  const handleIdentifyPassenger = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = passengerNameInput.trim();
    if (!name) return;

    setIdentifyError('');
    setIsIdentifyingPassenger(true);
    try {
      if (onIdentifyPassenger) {
        await onIdentifyPassenger(name);
      } else if (currentDeviceSession) {
        const nowIso = new Date().toISOString();
        await savePassengerSession({
          ...currentDeviceSession,
          passengerName: name,
          lastActiveAt: nowIso,
        });

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('pix_registered_passenger_name', name);
          localStorage.setItem('pix_registered_session_id', currentDeviceSession.id);
        }

        onSetActiveSessionId(currentDeviceSession.id);
      }
      setIsEditingName(false);
    } catch (error: any) {
      setIdentifyError(error?.message || 'Não foi possível iniciar sua sessão.');
    } finally {
      setIsIdentifyingPassenger(false);
    }
  };

  // Heartbeat update on user action
  const touchHeartbeat = () => {
    if (currentDeviceSession) {
      savePassengerSession({
        ...currentDeviceSession,
        lastActiveAt: new Date().toISOString(),
      });
    }
  };

  // Driver actions
  const handleToggleMultiMode = (allow: boolean) => {
    saveSessionSettings({
      ...settings,
      allowMultiPassengerMode: allow,
    });
  };

  const handleSetExpireMinutes = (minutes: number) => {
    saveSessionSettings({
      ...settings,
      autoExpireMinutes: minutes,
    });
  };

  const handleActivateSession = async (session: PassengerSession) => {
    const deadline = session.reactivationExpiresAt
      ? new Date(session.reactivationExpiresAt).getTime()
      : new Date(session.lastActiveAt || session.createdAt).getTime() + 24 * 60 * 60 * 1000;
    if (Date.now() > deadline) {
      alert('O prazo de 24 horas para reativar este passageiro terminou.');
      return;
    }
    if (!settings.allowMultiPassengerMode) {
      // Close other active sessions if multi-passenger mode is disabled
      await closeAllPreviousPassengerSessionsExcept(session.id);
    }
    await updatePassengerSessionStatus(session.id, 'active', {
      lastActiveAt: new Date().toISOString(),
      closedAt: undefined,
      reactivationExpiresAt: undefined,
    });
    onSetActiveSessionId(session.id);
  };

  const handleCloseSession = async (sessionId: string) => {
    const now = new Date();
    await updatePassengerSessionStatus(sessionId, 'closed', {
      closedAt: now.toISOString(),
      reactivationExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (activeSessionId === sessionId) onSetActiveSessionId(null);
  };

  const handlePassengerExit = async () => {
    if (!currentDeviceSession) return;
    try {
      const token = await getCurrentIdToken();
      const response = await fetch('/api/passenger/session/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: currentDeviceSession.id }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Não foi possível sair da sessão.');
      }
      onSetActiveSessionId(null);
    } catch (error: any) {
      alert(error?.message || 'Não foi possível sair da sessão.');
    }
  };

  const handleToggleResource = async (
    session: PassengerSession,
    resourceKey: string
  ) => {
    const canonicalId = normalizeServiceId(resourceKey);
    const unlocked = normalizeServiceIds(session.unlockedServices);
    const nextUnlockState = !unlocked.includes(canonicalId);
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;

    try {
      const token = await getCurrentIdToken();
      const response = await fetch(
        '/api/driver/passenger-sessions/' + encodeURIComponent(session.id) + '/resources',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({
            serviceId: canonicalId,
            unlock: nextUnlockState,
          }),
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.session) {
        throw new Error(payload?.error || 'Não foi possível atualizar o recurso.');
      }

      onSessionUpdated?.(payload.session as PassengerSession);
    } catch (error: any) {
      console.error('Falha ao atualizar recurso do passageiro:', error);
      alert(error?.message || 'Não foi possível atualizar o recurso.');
    } finally {
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'auto' }));
      }
    }
  };

  const handleUnlockAllResources = async (session: PassengerSession) => {
    const serviceIds = unifiedServicesList
      .filter((srv) => {
        const type =
          srv.itemType ||
          (srv.id === 'wifi' ||
          srv.id === 'spotify_music' ||
          srv.id === 'charger'
            ? 'servico'
            : 'produto');
        return type === 'servico';
      })
      .map((srv) => normalizeServiceId(srv.id));

    if (serviceIds.length === 0) return;

    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;

    try {
      const token = await getCurrentIdToken();
      const response = await fetch(
        '/api/driver/passenger-sessions/' + encodeURIComponent(session.id) + '/resources',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({
            serviceIds,
            unlock: true,
          }),
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.session) {
        throw new Error(payload?.error || 'Não foi possível liberar os recursos.');
      }

      onSessionUpdated?.(payload.session as PassengerSession);
    } catch (error: any) {
      console.error('Falha ao liberar todos os recursos:', error);
      alert(error?.message || 'Não foi possível liberar os recursos.');
    } finally {
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'auto' }));
      }
    }
  };

  // Helper to get one canonical resource card per service.
  const unifiedServicesList = (() => {
    const list = services.length > 0 ? services : DEFAULT_SERVICES;
    const seen = new Set<string>();

    return list
      .filter((service) => service.isActive !== false)
      .map((service) => {
        const id = normalizeServiceId(service.id);
        return {
          ...service,
          id,
          title:
            id === SERVICE_IDS.WIFI
              ? 'Wi-Fi 5G'
              : id === SERVICE_IDS.MUSIC
              ? 'Som do Carro'
              : id === SERVICE_IDS.CHARGER
              ? 'Carregador Celular'
              : service.title,
        };
      })
      .filter((service) => {
        if (seen.has(service.id)) return false;
        seen.add(service.id);
        return true;
      });
  })();

  // Temporary test mode: every driver can see every passenger session.
  // Later this will be scoped by the QR-code relationship between driver and ride.
  const driverSessions = sessions.filter(
    (session) =>
      Boolean(session.passengerName?.trim()) &&
      session.passengerName.trim().toLowerCase() !== 'passageiro'
  );

  const activeSessions = driverSessions.filter((s) => s.status === 'active');
  const expiredSessions = driverSessions.filter((s) => s.status === 'expired' || s.status === 'closed');

  // Active + Expired + Closed sessions stay visible by default in driver view (Active first, Expired/Closed below)
  const activeAndExpiredSessions = [...driverSessions]
    .filter((s) => s.status === 'active' || s.status === 'expired' || s.status === 'closed')
    .sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      const timeA = new Date(a.lastActiveAt || a.createdAt).getTime();
      const timeB = new Date(b.lastActiveAt || b.createdAt).getTime();
      return timeB - timeA;
    });

  // PASSENGER VIEW: the whole passenger experience remains locked until a real name exists.
  if (viewMode === 'passenger') {
    const needsName = requirePassengerIdentification;
    if (!needsName) return null;
    return (
      <div
        data-testid="passenger-login-gate"
        className="fixed inset-0 z-[250] bg-slate-950 flex items-center justify-center p-4"
      >
        <form
          data-testid="passenger-name-modal"
          onSubmit={handleIdentifyPassenger}
          className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 space-y-4"
        >
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <UserCheck className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-slate-900">Como podemos te chamar?</h2>
            <p className="text-xs text-slate-500 mt-1">
              Digite seu nome para o motorista identificar você e liberar os recursos disponíveis.
            </p>
            {currentDeviceAnySession?.status === 'expired' && (
              <p className="text-[11px] font-bold text-amber-600 mt-2">
                Sua sessão anterior expirou. Informe seu nome para iniciar uma nova sessão.
              </p>
            )}
            {currentDeviceAnySession?.status === 'closed' && (
              <p className="text-[11px] font-bold text-amber-600 mt-2">
                Sua sessão anterior foi encerrada. Informe seu nome para entrar novamente.
              </p>
            )}
          </div>

          <input
            data-testid="passenger-name-input"
            autoFocus
            value={passengerNameInput}
            onChange={(e) => setPassengerNameInput(e.target.value)}
            placeholder="Seu nome"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />

          {identifyError && (
            <p data-testid="passenger-login-error" className="text-xs font-bold text-rose-600 text-center">
              {identifyError}
            </p>
          )}

          <button
            type="submit"
            disabled={!passengerNameInput.trim() || isIdentifyingPassenger}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black py-3 text-sm transition-colors"
          >
            {isIdentifyingPassenger ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  // DRIVER VIEW RENDERING
  return (
    <section className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 sm:p-5 my-5 shadow-2xl space-y-5">
      {/* Central Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>Sessões de Passageiros</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
            {activeSessions.length} Ativo(s) {expiredSessions.length > 0 && `• ${expiredSessions.length} Expirado(s)`}
          </span>
        </div>
      </div>

      {/* Driver Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Rule 3: Multi Passenger Mode Toggle */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800 inline-block mb-1">
                Ativação de Múltiplos Passageiros
              </span>
              <h4 className="text-sm font-bold text-white">Múltiplos Passageiros Simultâneos</h4>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Ative para permitir que 2 ou mais pessoas controlem e paguem recursos ao mesmo tempo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleMultiMode(!settings.allowMultiPassengerMode)}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 border ${
                settings.allowMultiPassengerMode
                  ? 'bg-amber-500 border-amber-400'
                  : 'bg-slate-800 border-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform transform shadow-md ${
                  settings.allowMultiPassengerMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {settings.allowMultiPassengerMode
                ? 'Modo Múltiplos Ativo: O motorista gerencia sessões paralelas.'
                : 'Modo Sessão Única Ativo: Novo passageiro substitui automaticamente o anterior.'}
            </span>
          </div>
        </div>

        {/* Rule 2: Automatic Expiration Time Config */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 bg-sky-950/60 px-2.5 py-0.5 rounded-full border border-sky-800 inline-block mb-1">
              Expiração Automática por Inatividade
            </span>
            <h4 className="text-sm font-bold text-white">Tempo Limite da Sessão</h4>
            <p className="text-xs text-slate-400 leading-relaxed mt-1">
              A sessão expira automaticamente se o passageiro não apresentar atividade.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-2">
            {[15, 30, 60, 120].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => handleSetExpireMinutes(mins)}
                className={`py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                  settings.autoExpireMinutes === mins
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {mins} min
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation for Driver Panel */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 pt-1">
        <button
          type="button"
          onClick={() => setActiveDriverTab('sessions')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
            activeDriverTab === 'sessions'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Sessões ({activeAndExpiredSessions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDriverTab('devices')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
            activeDriverTab === 'devices'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Histórico por Dispositivo (ID Único)</span>
        </button>
      </div>

      {/* Render selected Driver Tab */}
      {activeDriverTab === 'devices' ? (
        <DeviceHistoryView
          sessions={driverSessions}
          services={unifiedServicesList}
          onToggleResource={handleToggleResource}
          onCloseSession={handleCloseSession}
          onActivateSession={handleActivateSession}
        />
      ) : (
        /* Sessions List */
        <div className="space-y-3">
          {(() => {
            const displayedSessions = showFullHistory ? driverSessions : activeAndExpiredSessions;

            return (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <span>{showFullHistory ? 'Histórico Completo de Sessões' : 'Sessões Ativas & Expiradas'} ({displayedSessions.length})</span>
                    {showFullHistory && (
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                        Total ({driverSessions.length})
                      </span>
                    )}
                  </h4>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      Expirar em {settings.autoExpireMinutes} min
                    </span>
                    {driverSessions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowFullHistory(!showFullHistory)}
                        className="text-xs font-bold text-sky-400 hover:text-sky-300 bg-sky-950/60 border border-sky-800/80 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{showFullHistory ? 'Mostrar Ativos e Expirados' : `Ver Histórico Completo (${driverSessions.length})`}</span>
                      </button>
                    )}
                  </div>
                </div>

                {displayedSessions.length === 0 ? (
                  <div className="bg-slate-950/50 rounded-2xl p-6 text-center border border-slate-800 text-slate-400 space-y-3">
                    <Users className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-300">
                      {showFullHistory ? 'Nenhuma sessão de passageiro registrada' : 'Nenhuma sessão ativa no momento'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {showFullHistory
                        ? 'Quando um passageiro abrir o aplicativo no celular e informar o nome, a sessão aparecerá aqui.'
                        : 'Quando um passageiro acessar o app, a sessão ativa será exibida nesta tela.'}
                    </p>
                    {!showFullHistory && sessions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowFullHistory(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold transition-all shadow-md cursor-pointer active:scale-95"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Acessar Histórico Completo ({sessions.length} registradas)</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {displayedSessions.map((session) => {
                      const isActive = session.status === 'active';
                      const isExpired = session.status === 'expired';
                      const isClosed = session.status === 'closed';

                      const createdTime = new Date(session.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={session.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            isActive
                              ? 'bg-slate-950 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                              : isExpired
                              ? 'bg-slate-950/60 border-amber-500/30 text-slate-400'
                              : 'bg-slate-950/40 border-slate-800 text-slate-400'
                          }`}
                        >
                          {/* Session Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                  isActive
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                    : isExpired
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {session.passengerName.substring(0, 2).toUpperCase()}
                              </div>

                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h5 className="font-extrabold text-sm text-white">{session.passengerName}</h5>
                                  {isActive && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                      Ativo
                                    </span>
                                  )}
                                  {(session.unlockedServices.includes('wifi') || session.unlockedServices.includes('1')) && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-bold border border-sky-500/30">
                                      <Wifi className="w-3 h-3 text-sky-400" /> Wi-Fi 5G Ativo
                                    </span>
                                  )}
                                  {(session.hasMusicUnlocked || session.unlockedServices.includes('spotify_music') || session.unlockedServices.includes('2')) && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                                      <Music className="w-3 h-3 text-emerald-400" /> Som Liberado
                                    </span>
                                  )}
                                  {(session.unlockedServices.includes('charger') || session.unlockedServices.includes('3')) && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                                      <Zap className="w-3 h-3 text-amber-400" /> Carregador Ativo
                                    </span>
                                  )}
                                  {isExpired && (
                                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                                      ⏳ Expirado
                                    </span>
                                  )}
                                  {isClosed && (
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold border border-slate-700">
                                      Encerrado
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  Início: {createdTime}
                                </p>
                              </div>
                            </div>

                            {/* Quick Driver Controls for Session */}
                            <div className="flex items-center gap-1.5">
                              {!isActive ? (() => {
                                const deadline = session.reactivationExpiresAt
                                  ? new Date(session.reactivationExpiresAt).getTime()
                                  : new Date(session.lastActiveAt || session.createdAt).getTime() + 24 * 60 * 60 * 1000;
                                const canReactivate = Date.now() <= deadline;
                                return canReactivate ? (
                                  <button
                                    type="button"
                                    onClick={() => handleActivateSession(session)}
                                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
                                  >
                                    <Zap className="w-3.5 h-3.5 fill-current text-slate-950" />
                                    <span>Reativar</span>
                                  </button>
                                ) : (
                                  <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-500 text-[10px] font-bold">
                                    Prazo de 24h encerrado
                                  </span>
                                );
                              })() : (
                                <button
                                  type="button"
                                  onClick={() => handleCloseSession(session.id)}
                                  className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <Power className="w-3.5 h-3.5" />
                                  <span>Encerrar</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Rule 4: Resource & Access Control Toggles Categorized */}
                          <div className="pt-2 border-t border-slate-800/80 space-y-2.5 text-xs">
                            {/* Categoria SERVIÇOS DO VEÍCULO */}
                            <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <span className="text-sky-300 font-extrabold text-xs flex items-center gap-1.5">
                                    🛠️ Recursos do veículo
                                  </span>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    Toque uma vez para liberar ou bloquear.
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={(e) => { e.preventDefault(); e.currentTarget.blur(); handleUnlockAllResources(session); }}
                                  className="min-h-12 px-4 rounded-2xl bg-emerald-500 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                                  title="Liberar todos os recursos deste passageiro"
                                >
                                  <Unlock className="w-4 h-4" />
                                  Liberar tudo
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                {unifiedServicesList
                                  .filter((srv) => {
                                    const type =
                                      srv.itemType ||
                                      (srv.id === 'wifi' ||
                                      srv.id === 'spotify_music' ||
                                      srv.id === 'charger'
                                        ? 'servico'
                                        : 'produto');
                                    return type === 'servico';
                                  })
                                  .map((srv) => {
                                    const isMusic = srv.id === 'spotify_music' || srv.id === '2';
                                    const isWifi = srv.id === 'wifi' || srv.id === '1';
                                    const isCharger =
                                      srv.id === 'charger' ||
                                      srv.id === '3' ||
                                      srv.title.toLowerCase().includes('carregador');

                                    const isUnlocked =
                                      session.unlockedServices.includes(srv.id) ||
                                      (isMusic &&
                                        (session.hasMusicUnlocked ||
                                          session.unlockedServices.includes('2') ||
                                          session.unlockedServices.includes('spotify_music'))) ||
                                      (isWifi &&
                                        (session.unlockedServices.includes('1') ||
                                          session.unlockedServices.includes('wifi'))) ||
                                      (isCharger &&
                                        (session.unlockedServices.includes('3') ||
                                          session.unlockedServices.includes('charger')));

                                    const Icon = isMusic ? Music : isWifi ? Wifi : Zap;

                                    return (
                                      <button
                                        key={srv.id}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => { e.preventDefault(); e.currentTarget.blur(); handleToggleResource(session, srv.id); }}
                                        aria-pressed={isUnlocked}
                                        className={`min-h-[72px] rounded-2xl border px-3 py-3 text-left transition-all active:scale-[0.98] ${
                                          isUnlocked
                                            ? 'bg-emerald-500/20 border-emerald-400/70 shadow-lg shadow-emerald-500/10'
                                            : 'bg-slate-950 border-slate-700'
                                        }`}
                                        title={isUnlocked ? `Bloquear ${srv.title}` : `Liberar ${srv.title}`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div
                                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                                isUnlocked
                                                  ? 'bg-emerald-400 text-slate-950'
                                                  : 'bg-slate-800 text-slate-300'
                                              }`}
                                            >
                                              <Icon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                              <div className="text-sm font-black text-white leading-tight truncate">
                                                {srv.title}
                                              </div>
                                              <div
                                                className={`text-[11px] font-black mt-1 ${
                                                  isUnlocked ? 'text-emerald-300' : 'text-slate-500'
                                                }`}
                                              >
                                                {isUnlocked ? 'LIBERADO' : 'BLOQUEADO'}
                                              </div>
                                            </div>
                                          </div>

                                          <div
                                            className={`w-12 h-7 rounded-full p-1 shrink-0 transition-colors ${
                                              isUnlocked ? 'bg-emerald-400' : 'bg-slate-700'
                                            }`}
                                          >
                                            <div
                                              className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                                isUnlocked ? 'translate-x-5' : 'translate-x-0'
                                              }`}
                                            />
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>
                            {/* Categoria PRODUTOS A BORDO */}
                            {unifiedServicesList.some((srv) => (srv.itemType || (srv.id === 'wifi' || srv.id === 'spotify_music' || srv.id === 'charger' ? 'servico' : 'produto')) === 'produto') && (
                              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-amber-300 font-extrabold text-[11px] flex items-center gap-1">
                                  📦 Produtos Comprados a Bordo:
                                </span>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  {unifiedServicesList
                                    .filter((srv) => {
                                      const type = srv.itemType || (srv.id === 'wifi' || srv.id === 'spotify_music' || srv.id === 'charger' ? 'servico' : 'produto');
                                      return type === 'produto';
                                    })
                                    .map((srv) => {
                                      const purchasedQty = (session.purchasedProducts && session.purchasedProducts[srv.id]) || (session.unlockedServices.includes(srv.id) ? 1 : 0);
                                      const isPurchased = purchasedQty > 0;

                                      return (
                                        <button
                                          key={srv.id}
                                          type="button"
                                          onClick={() => handleToggleResource(session, srv.id)}
                                          className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] flex items-center gap-1.5 border transition-all cursor-pointer ${
                                            isPurchased
                                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs hover:bg-amber-500/30'
                                              : 'bg-slate-950/90 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                                          }`}
                                          title={isPurchased ? `Produto Comprado (${purchasedQty} un)` : `Nenhum pedido de ${srv.title}`}
                                        >
                                          <span>{srv.title}:</span>
                                          {isPurchased ? (
                                            <span className="text-emerald-400 font-black flex items-center gap-0.5">
                                              COMPRADO ({purchasedQty}x) <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                            </span>
                                          ) : (
                                            <span className="text-slate-500 font-bold flex items-center gap-0.5">
                                              SEM PEDIDO <Lock className="w-3 h-3 text-slate-500" />
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {!showFullHistory && driverSessions.length > activeAndExpiredSessions.length && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setShowFullHistory(true)}
                          className="text-xs font-bold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-4 py-2.5 rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
                        >
                          <Clock className="w-3.5 h-3.5 text-sky-400" />
                          <span>Acessar Histórico Completo ({driverSessions.length - activeAndExpiredSessions.length} sessões encerradas)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
};
