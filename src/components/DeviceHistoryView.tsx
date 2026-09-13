import React, { useState } from 'react';
import {
  Smartphone,
  Search,
  Users,
  History,
  Clock,
  Zap,
  Wifi,
  Music,
  Lock,
  Unlock,
  CheckCircle2,
  DollarSign,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Power,
  Filter,
} from 'lucide-react';
import { PassengerSession, AdditionalService } from '../types';

interface DeviceHistoryViewProps {
  sessions: PassengerSession[];
  services: AdditionalService[];
  onToggleResource: (session: PassengerSession, resourceKey: string) => Promise<void>;
  onCloseSession: (sessionId: string) => Promise<void>;
  onActivateSession: (session: PassengerSession) => Promise<void>;
}

export interface DeviceGroup {
  browserId: string;
  displayId: string;
  sessions: PassengerSession[];
  totalPaid: number;
  hasActiveSession: boolean;
  passengerNames: string[];
  latestActivity: string;
}

export const DeviceHistoryView: React.FC<DeviceHistoryViewProps> = ({
  sessions,
  services,
  onToggleResource,
  onCloseSession,
  onActivateSession,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paid'>('all');
  const [copiedDeviceId, setCopiedDeviceId] = useState<string | null>(null);
  const [expandedDevices, setExpandedDevices] = useState<Record<string, boolean>>({});

  // Group sessions by browserId (Device Unique Identifier)
  const deviceGroupsMap = new Map<string, PassengerSession[]>();

  sessions.forEach((session) => {
    const devId = (session.browserId || 'DISPOSITIVO_DESCONHECIDO').trim();
    if (!deviceGroupsMap.has(devId)) {
      deviceGroupsMap.set(devId, []);
    }
    deviceGroupsMap.get(devId)!.push(session);
  });

  const deviceGroups: DeviceGroup[] = Array.from(deviceGroupsMap.entries()).map(
    ([bId, devSessions]) => {
      // Sort sessions for this device newest first
      const sorted = [...devSessions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const totalPaid = sorted.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
      const hasActiveSession = sorted.some((s) => s.status === 'active');

      // Unique passenger names on this device
      const names = Array.from(
        new Set(sorted.map((s) => s.passengerName.trim()).filter(Boolean))
      );

      const latestActivity = sorted[0]?.lastActiveAt || sorted[0]?.createdAt || '';

      return {
        browserId: bId,
        displayId: bId.length > 20 ? `${bId.substring(0, 16)}...` : bId,
        sessions: sorted,
        totalPaid,
        hasActiveSession,
        passengerNames: names,
        latestActivity,
      };
    }
  );

  // Filter device groups by search term and status
  const filteredGroups = deviceGroups.filter((group) => {
    // Search matching: Device ID or any Passenger Name
    const matchesSearch =
      searchTerm === '' ||
      group.browserId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.passengerNames.some((n) => n.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'active') {
      return group.hasActiveSession;
    }
    if (statusFilter === 'paid') {
      return group.totalPaid > 0;
    }

    return true;
  });

  const handleCopyId = (bId: string) => {
    navigator.clipboard.writeText(bId);
    setCopiedDeviceId(bId);
    setTimeout(() => setCopiedDeviceId(null), 2000);
  };

  const toggleExpand = (bId: string) => {
    setExpandedDevices((prev) => ({
      ...prev,
      [bId]: !prev[bId],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header Info & Filters */}
      <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                <span>Histórico de Dispositivos Conectados</span>
                <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-bold">
                  ID Único do Celular
                </span>
              </h4>
              <p className="text-xs text-slate-400">
                Identifica múltiplos passageiros e histórico de corridas originados do mesmo dispositivo físico
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <span className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
              {deviceGroups.length} Dispositivo(s) Mapeado(s)
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-800/80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por ID do Dispositivo ou Nome do Passageiro..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                statusFilter === 'all'
                  ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-xs'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              Todos ({deviceGroups.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                statusFilter === 'active'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-xs'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              Ativos ({deviceGroups.filter((g) => g.hasActiveSession).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                statusFilter === 'paid'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              Com Pagamentos
            </button>
          </div>
        </div>
      </div>

      {/* Device Groups List */}
      {filteredGroups.length === 0 ? (
        <div className="bg-slate-950/60 rounded-2xl p-6 text-center border border-slate-800 text-slate-400 space-y-2">
          <Smartphone className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs font-bold text-slate-300">Nenhum dispositivo encontrado</p>
          <p className="text-[11px] text-slate-400">
            {searchTerm
              ? 'Tente ajustar os termos de busca para localizar o ID do dispositivo ou passageiro.'
              : 'Assim que passageiros acessarem o aplicativo no celular, os identificadores de dispositivos aparecerão aqui.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isExpanded = expandedDevices[group.browserId] !== false; // expanded by default
            const latestSession = group.sessions[0];

            return (
              <div
                key={group.browserId}
                className={`bg-slate-950 rounded-2xl border transition-all overflow-hidden ${
                  group.hasActiveSession
                    ? 'border-sky-500/50 shadow-lg shadow-sky-500/5'
                    : 'border-slate-800'
                }`}
              >
                {/* Device Group Card Header */}
                <div
                  className="p-4 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-900/90 transition-colors"
                  onClick={() => toggleExpand(group.browserId)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border ${
                        group.hasActiveSession
                          ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      <Smartphone className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs text-sky-300 bg-sky-950/80 px-2.5 py-0.5 rounded-lg border border-sky-800/80 flex items-center gap-1.5">
                          <span>{group.displayId}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyId(group.browserId);
                            }}
                            className="p-0.5 text-slate-400 hover:text-white transition-colors"
                            title="Copiar ID do Dispositivo"
                          >
                            {copiedDeviceId === group.browserId ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </span>

                        {group.hasActiveSession && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Dispositivo Conectado
                          </span>
                        )}

                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold border border-slate-700 flex items-center gap-1">
                          <Users className="w-3 h-3 text-amber-400" />
                          {group.passengerNames.length} Usuário(s) Registrado(s)
                        </span>

                        {group.totalPaid > 0 && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-amber-400" />
                            R$ {group.totalPaid.toFixed(2).replace('.', ',')} Pagos
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 font-medium mt-1">
                        Nomes Utilizados:{' '}
                        <span className="text-white font-extrabold">
                          {group.passengerNames.join(', ') || 'Sem identificação'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {group.latestActivity
                        ? new Date(group.latestActivity).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                    <button
                      type="button"
                      className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Device Session Timeline */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-800/80 space-y-3 bg-slate-950/80">
                    <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-sky-400" />
                      <span>Histórico de Sessões e Corridas neste Aparelho ({group.sessions.length})</span>
                    </h5>

                    <div className="space-y-2">
                      {group.sessions.map((session, index) => {
                        const isActive = session.status === 'active';
                        const isExpired = session.status === 'expired';
                        const isClosed = session.status === 'closed';

                        const formattedDate = new Date(session.createdAt).toLocaleDateString(
                          'pt-BR',
                          {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        );

                        return (
                          <div
                            key={session.id}
                            className={`p-3 rounded-xl border transition-all space-y-2 ${
                              isActive
                                ? 'bg-slate-900 border-emerald-500/40 shadow-xs'
                                : 'bg-slate-900/50 border-slate-800/80'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                                  #{group.sessions.length - index}
                                </span>
                                <h6 className="text-xs font-black text-white flex items-center gap-1.5">
                                  <span>{session.passengerName}</span>
                                  {isActive && (
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                      Ativo Agora
                                    </span>
                                  )}
                                  {isExpired && (
                                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                      Expirado
                                    </span>
                                  )}
                                  {isClosed && (
                                    <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-bold">
                                      Encerrado
                                    </span>
                                  )}
                                </h6>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-slate-400">
                                  {formattedDate}
                                </span>

                                {!isActive ? (
                                  <button
                                    type="button"
                                    onClick={() => onActivateSession(session)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center gap-1 shadow-xs"
                                  >
                                    <Zap className="w-3 h-3 fill-current" />
                                    <span>Reativar</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onCloseSession(session.id)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-black text-[11px] flex items-center gap-1"
                                  >
                                    <Power className="w-3 h-3" />
                                    <span>Encerrar</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Session Details: Resources & Payment */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/60 text-[11px]">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-slate-400 font-bold">Recursos:</span>
                                {session.unlockedServices.length === 0 && !session.hasMusicUnlocked ? (
                                  <span className="text-slate-500 italic">Nenhum recurso ativado</span>
                                ) : (
                                  <>
                                    {(session.unlockedServices.includes('wifi') || session.unlockedServices.includes('1')) && (
                                      <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-lg font-extrabold flex items-center gap-1">
                                        <Wifi className="w-3 h-3 text-sky-400" /> Wi-Fi 5G
                                      </span>
                                    )}
                                    {(session.hasMusicUnlocked || session.unlockedServices.includes('spotify_music') || session.unlockedServices.includes('2')) && (
                                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-extrabold flex items-center gap-1">
                                        <Music className="w-3 h-3 text-emerald-400" /> Som do Carro
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {session.paidAmount && session.paidAmount > 0 ? (
                                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-lg font-black flex items-center gap-1">
                                    <DollarSign className="w-3 h-3 text-amber-400" />
                                    R$ {session.paidAmount.toFixed(2).replace('.', ',')}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Sem cobrança gravada</span>
                                )}
                              </div>
                            </div>

                            {/* Driver Toggle Buttons for this session */}
                            <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-bold">Controle do Motorista:</span>
                              <button
                                type="button"
                                onClick={() => onToggleResource(session, 'wifi')}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all ${
                                  session.unlockedServices.includes('wifi') || session.unlockedServices.includes('1')
                                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                    : 'bg-slate-900 text-slate-500 border-slate-800'
                                }`}
                              >
                                Wi-Fi: {session.unlockedServices.includes('wifi') || session.unlockedServices.includes('1') ? 'ON' : 'OFF'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onToggleResource(session, 'spotify_music')}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all ${
                                  session.hasMusicUnlocked || session.unlockedServices.includes('spotify_music') || session.unlockedServices.includes('2')
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-slate-900 text-slate-500 border-slate-800'
                                }`}
                              >
                                Som: {session.hasMusicUnlocked || session.unlockedServices.includes('spotify_music') || session.unlockedServices.includes('2') ? 'ON' : 'OFF'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
