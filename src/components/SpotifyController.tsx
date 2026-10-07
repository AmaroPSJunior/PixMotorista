import React, { useState, useEffect, useRef } from 'react';
import { SpotifyAppReplica } from './SpotifyAppReplica';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Music,
  Disc,
  Radio,
  Search,
  Check,
  ExternalLink,
  Sparkles,
  Info,
  Sliders,
  Tv,
  RefreshCw,
  X,
  Plus,
  Heart,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Lock,
  Unlock,
  Zap,
  CheckCircle2,
} from 'lucide-react';

interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumCover: string;
  durationMs: number;
  uri?: string;
  previewUrl?: string;
}

interface SpotifyControllerProps {
  isDriverView?: boolean;
  onOpenDriverConfig?: () => void;
  isMusicUnlocked?: boolean;
  onUnlockClick?: () => void;
}

interface MoodPreset {
  id: string;
  title: string;
  genre: string;
  icon: string;
  color: string;
  track: SpotifyTrack;
}

// Built-in presets for ride moods
const MOOD_PRESETS: MoodPreset[] = [
  {
    id: 'sertanejo',
    title: 'Sertanejo Hits',
    genre: 'Sertanejo',
    icon: '🤠',
    color: 'from-amber-600 to-amber-800',
    track: {
      id: 'demo-1',
      name: 'Erro Gostoso (Ao Vivo)',
      artist: 'Simone Mendes',
      album: 'Cintilante',
      albumCover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
      durationMs: 180000,
      uri: 'spotify:track:1',
    },
  },
  {
    id: 'mpb',
    title: 'MPB Para Viagem',
    genre: 'MPB / Brasil',
    icon: '🇧🇷',
    color: 'from-emerald-600 to-teal-800',
    track: {
      id: 'demo-2',
      name: 'Anunciação',
      artist: 'Alceu Valença',
      album: 'Anunciação Hits',
      albumCover: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80',
      durationMs: 210000,
      uri: 'spotify:track:2',
    },
  },
  {
    id: 'pop',
    title: 'Pop & Dance',
    genre: 'Pop Hits',
    icon: '🎧',
    color: 'from-purple-600 to-indigo-800',
    track: {
      id: 'demo-3',
      name: 'As It Was',
      artist: 'Harry Styles',
      album: "Harry's House",
      albumCover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
      durationMs: 167000,
      uri: 'spotify:track:3',
    },
  },
  {
    id: 'lofi',
    title: 'Lo-Fi / Relax',
    genre: 'Chill Out',
    icon: '☕',
    color: 'from-blue-600 to-slate-800',
    track: {
      id: 'demo-4',
      name: 'Coffee Beats & Rain',
      artist: 'Lo-Fi Chill Hop',
      album: 'Relaxing Highway Drive',
      albumCover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80',
      durationMs: 195000,
      uri: 'spotify:track:4',
    },
  },
];

export const SpotifyController: React.FC<SpotifyControllerProps> = ({
  isDriverView = false,
  onOpenDriverConfig,
  isMusicUnlocked = false,
  onUnlockClick,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [spotifyStatus, setSpotifyStatus] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack>(MOOD_PRESETS[0].track);
  const [progressMs, setProgressMs] = useState<number>(45000);
  const [volume, setVolume] = useState<number>(80);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedGenre, setSelectedGenre] = useState<string>('Sertanejo');
  const [showSetupInstructions, setShowSetupInstructions] = useState<boolean>(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'player' | 'presets' | 'search'>('player');
  const [isFullScreenOpen, setIsFullScreenOpen] = useState<boolean>(false);

  const progressIntervalRef = useRef<any>(null);

  // Check Spotify status from server
  const checkStatus = async () => {
    try {
      const res = await fetch('/api/spotify/status');
      if (res.ok) {
        const data = await res.json();
        setSpotifyStatus(data);
        if (data.hasToken) {
          setIsConnected(true);
          fetchCurrentlyPlaying();
        }
      }
    } catch (e) {
      console.warn('Erro ao checar status do Spotify:', e);
    }
  };

  useEffect(() => {
    checkStatus();

    // Listen for OAuth message from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
        setIsConnected(true);
        setAuthErrorMessage(null);
        if (event.data.accessToken) {
          localStorage.setItem('spotify_access_token', event.data.accessToken);
        }
        checkStatus();
      } else if (event.data?.type === 'SPOTIFY_AUTH_ERROR') {
        setShowSetupInstructions(true);
        setAuthErrorMessage(event.data.error || 'Falha na autenticação com o Spotify.');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Fetch currently playing live track from Spotify API
  const fetchCurrentlyPlaying = async () => {
    const token = localStorage.getItem('spotify_access_token');
    try {
      const res = await fetch('/api/spotify/player', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.item) {
          setCurrentTrack({
            id: data.item.id,
            name: data.item.name,
            artist: data.item.artists.map((a: any) => a.name).join(', '),
            album: data.item.album.name,
            albumCover: data.item.album.images[0]?.url || currentTrack.albumCover,
            durationMs: data.item.duration_ms || 180000,
            uri: data.item.uri,
          });
          setIsPlaying(Boolean(data.is_playing));
          setProgressMs(data.progress_ms || 0);
        }
      }
    } catch (e) {
      console.warn('Não foi possível sincronizar o Spotify ao vivo:', e);
    }
  };

  // Local simulated progress tick if playing
  useEffect(() => {
    if (isPlaying) {
      progressIntervalRef.current = setInterval(() => {
        setProgressMs((prev) => {
          if (prev >= currentTrack.durationMs) return 0;
          return prev + 1000;
        });
      }, 1000);
    } else if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, currentTrack.durationMs]);

  // Connect via Spotify OAuth popup
  const handleConnectSpotify = async () => {
    try {
      const res = await fetch('/api/spotify/auth-url');
      const data = await res.json();

      if (data.needsConfig) {
        setShowSetupInstructions(true);
        return;
      }

      if (data.url) {
        const width = 500;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        window.open(
          data.url,
          'spotify_oauth_popup',
          `width=${width},height=${height},top=${top},left=${left}`
        );
      }
    } catch (err) {
      console.error('Erro ao abrir autenticação Spotify:', err);
      setShowSetupInstructions(true);
    }
  };

  // Play / Pause Toggle
  const handleTogglePlay = async () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);

    const token = localStorage.getItem('spotify_access_token');
    const endpoint = nextState ? '/api/spotify/play' : '/api/spotify/pause';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: nextState && currentTrack.uri ? JSON.stringify({ uris: [currentTrack.uri] }) : undefined,
      });
      if (res.ok) {
        setTimeout(fetchCurrentlyPlaying, 800);
      }
    } catch (e) {
      console.warn('Comando de reprodução Spotify falhou:', e);
    }
  };

  // Unified function to play a specific track on Spotify
  const playSpecificTrack = async (track: SpotifyTrack) => {
    setCurrentTrack(track);
    setProgressMs(0);
    setIsPlaying(true);

    const token = localStorage.getItem('spotify_access_token');
    try {
      const res = await fetch('/api/spotify/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          uris: track.uri ? [track.uri] : undefined,
        }),
      });
      if (res.ok) {
        setTimeout(fetchCurrentlyPlaying, 800);
      }
    } catch (e) {
      console.warn('Erro ao reproduzir faixa no Spotify:', e);
    }
  };

  // Skip Next
  const handleNextTrack = async () => {
    setProgressMs(0);
    const currentIndex = MOOD_PRESETS.findIndex((p) => p.genre === selectedGenre);
    const nextPreset = MOOD_PRESETS[(currentIndex + 1) % MOOD_PRESETS.length];
    setSelectedGenre(nextPreset.genre);
    playSpecificTrack(nextPreset.track);
  };

  // Skip Previous
  const handlePrevTrack = async () => {
    setProgressMs(0);
    const currentIndex = MOOD_PRESETS.findIndex((p) => p.genre === selectedGenre);
    const prevPreset = MOOD_PRESETS[(currentIndex - 1 + MOOD_PRESETS.length) % MOOD_PRESETS.length];
    setSelectedGenre(prevPreset.genre);
    playSpecificTrack(prevPreset.track);
  };

  // Select Preset Mood
  const handleSelectPreset = (preset: typeof MOOD_PRESETS[0]) => {
    setSelectedGenre(preset.genre);
    playSpecificTrack(preset.track);
    setActiveTab('player');
  };

  // Handle Search on Spotify
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const token = localStorage.getItem('spotify_access_token');
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tracks?.items) {
          const mapped = data.tracks.items.map((t: any) => ({
            id: t.id,
            name: t.name,
            artist: t.artists.map((a: any) => a.name).join(', '),
            album: t.album?.name || '',
            albumCover: t.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
            durationMs: t.duration_ms,
            uri: t.uri,
          }));
          setSearchResults(mapped);
        }
      } else {
        // Fallback demo results if search endpoint returned error
        setSearchResults([
          {
            id: 'search-1',
            name: `${searchQuery} (Ao Vivo no Carro)`,
            artist: 'Artista em Alta',
            album: 'Éxitos da Viagem',
            albumCover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
            durationMs: 198000,
            uri: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
          },
          {
            id: 'search-2',
            name: `A Viagem de ${searchQuery}`,
            artist: 'Banda Carro & Som',
            album: 'Músicas na Estrada',
            albumCover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
            durationMs: 220000,
            uri: 'spotify:track:3n3Pp32v2C2u30R3370337',
          },
        ]);
      }
    } catch (err) {
      console.warn('Busca no Spotify falhou:', err);
    }
    setIsSearching(false);
  };

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = Math.min(100, (progressMs / currentTrack.durationMs) * 100);

  const devUrl = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';
  const isApiIntegrated = Boolean(spotifyStatus?.isIntegrated || spotifyStatus?.hasToken || isConnected);

  // If Spotify API is NOT integrated by the driver yet:
  if (!isApiIntegrated) {
    if (isDriverView) {
      return (
        <section className="bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden border border-slate-800 p-5 text-center my-4">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-400">
            <Music className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-white mb-1">
            Integração do Spotify Não Conectada
          </h3>
          <p className="text-slate-400 text-xs max-w-sm mx-auto mb-4 leading-relaxed">
            Você ainda não conectou sua conta do Spotify. Acesse as configurações do motorista para vincular a conta de som do veículo e liberar o controle aos passageiros.
          </p>
          {onOpenDriverConfig && (
            <button
              type="button"
              onClick={onOpenDriverConfig}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs inline-flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Sliders className="w-4 h-4" />
              Configurar Conexão do Spotify
            </button>
          )}
        </section>
      );
    }

    // Passenger View when Spotify credentials exist but the driver's Spotify session is not connected yet.
    return (
      <section data-testid="spotify-passenger-available" className="bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden border border-slate-800 p-6 text-center my-4">
        <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-400">
          <Music className="w-7 h-7 animate-pulse" />
        </div>
        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full inline-block mb-2 border border-emerald-500/30">
          Recurso Disponível
        </span>
        <h3 className="text-lg font-extrabold text-white mb-1">
          Controle de Músicas no Carro (Spotify)
        </h3>
        <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
          O recurso já está disponível. Você pode solicitar a liberação agora; o motorista poderá liberar o controle para a sua sessão.
        </p>
        {onUnlockClick && (
          <button
            data-testid="spotify-unlock-button"
            type="button"
            onClick={onUnlockClick}
            className="mt-5 w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-sky-400 via-emerald-400 to-sky-400 hover:from-sky-300 hover:to-emerald-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-xl shadow-sky-500/25 inline-flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
            Liberar Spotify
          </button>
        )}
      </section>
    );
  }

  // Requirement 1: Lock music selection for passenger until payment confirmation from Mercado Pago
  const isLockedForPassenger = !isDriverView && !isMusicUnlocked;

  if (isLockedForPassenger) {
    return (
      <section data-testid="spotify-passenger-locked" className="bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden border border-sky-500/40 p-5 my-4 animate-fadeIn">
        <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 p-5 rounded-2xl border border-sky-500/30 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-sky-500/20 border border-sky-400/40 text-sky-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-sky-500/20">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider bg-sky-950 text-sky-300 px-3 py-1 rounded-full border border-sky-800 inline-block">
              Serviço Exclusivo A Bordo
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold text-white">
              Escolha de Músicas no Som do Veículo
            </h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              Para liberar o recurso de escolher músicas realiza o pagamento
            </p>
          </div>

          <div className="pt-2">
            <button
              data-testid="spotify-unlock-button"
              type="button"
              onClick={onUnlockClick}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-sky-400 via-emerald-400 to-sky-400 hover:from-sky-300 hover:to-emerald-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-xl shadow-sky-500/25 flex items-center justify-center gap-2 mx-auto active:scale-95 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current text-slate-950" />
              <span>Liberar Escolha de Músicas</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (isFullScreenOpen) {
    return (
      <SpotifyAppReplica
        onBack={() => setIsFullScreenOpen(false)}
        isDriverView={isDriverView}
      />
    );
  }

  return (
    <section data-testid="spotify-controller-unlocked" className="bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden border border-slate-800 transition-all">
      {/* Top Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-4 border-b border-slate-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-emerald-400 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.12-.779-.18-.899-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 C9.6 9.9 15 10.561 18.72 12.841c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.18-.1.2-1.2-.42-.18-.6.42-1.2 1.02-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <h2 className="font-extrabold text-sm sm:text-base text-white leading-none">
                Spotify
              </h2>
              {isMusicUnlocked && !isDriverView ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/40 animate-pulse">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Músicas Liberadas!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Conectado ao Veículo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsFullScreenOpen(true)}
            className="px-3 py-1.5 bg-[#1DB954] hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            title="Abrir App Spotify Completo em Tela Cheia"
          >
            <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Abrir</span>
          </button>

          {isDriverView && onOpenDriverConfig && (
            <button
              type="button"
              onClick={onOpenDriverConfig}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              title="Configurações do Som do Carro"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Opções</span>
            </button>
          )}

          {isDriverView && (
            <button
              type="button"
              onClick={() => setShowSetupInstructions(!showSetupInstructions)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Instruções da API do Spotify"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Setup Instructions Drawer / Banner */}
      {showSetupInstructions && (
        <div className="p-4 bg-slate-950 border-b border-slate-800 text-xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between text-emerald-400 font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Configuração da API do Spotify (OAuth 2.0)</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setShowSetupInstructions(false);
                setAuthErrorMessage(null);
              }}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {authErrorMessage && (
            <div className="bg-rose-950/80 border border-rose-800/80 p-3 rounded-xl text-rose-200 text-xs leading-relaxed">
              <strong className="block text-rose-400 font-bold mb-1">
                ⚠️ Erro na Autenticação com Spotify:
              </strong>
              {authErrorMessage}
            </div>
          )}

          <p className="text-slate-300 leading-relaxed">
            Para controlar a conta do Spotify real no som do carro, adicione as chaves no painel do Spotify Developer:
          </p>

          <div className="space-y-2 bg-slate-900 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300">
            <div>
              <span className="text-slate-500 block">Dashboard Spotify:</span>
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 underline inline-flex items-center gap-1"
              >
                <span>developer.spotify.com/dashboard</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div>
              <span className="text-slate-500 block">Redirect URI (URL de Redirecionamento):</span>
              <span className="text-amber-300 select-all font-bold block break-all">
                {devUrl || 'https://sua-app.run.app/auth/callback'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block">Variáveis de Ambiente no AI Studio:</span>
              <span className="text-slate-300 block">SPOTIFY_CLIENT_ID = "Seu Client ID"</span>
              <span className="text-slate-300 block">SPOTIFY_CLIENT_SECRET = "Seu Client Secret"</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Body - Minimal Compact Controls for Main Screen */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80">
          {/* Album Cover & Track Info */}
          <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
            <div className="relative shrink-0">
              <img
                src={currentTrack.albumCover}
                alt={currentTrack.name}
                className={`w-14 h-14 object-cover rounded-xl shadow-md border border-slate-700/80 transition-transform ${
                  isPlaying ? 'scale-100' : 'opacity-90'
                }`}
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center gap-0.5">
                  <span className="w-0.5 h-3 bg-emerald-400 animate-bounce rounded-full" />
                  <span className="w-0.5 h-4 bg-emerald-400 animate-bounce rounded-full [animation-delay:0.2s]" />
                  <span className="w-0.5 h-2 bg-emerald-400 animate-bounce rounded-full [animation-delay:0.4s]" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                {currentTrack.name}
              </h3>
              <p className="text-xs text-slate-400 truncate font-medium mt-0.5">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Minimal Controls: Previous, Play/Pause, Next */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePrevTrack}
              className="p-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-all active:scale-90 cursor-pointer"
              title="Música Anterior"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              className="w-12 h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full flex items-center justify-center transition-transform shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
              title={isPlaying ? 'Pausar' : 'Tocar no Carro'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNextTrack}
              className="p-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-all active:scale-90 cursor-pointer"
              title="Próxima Música"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
