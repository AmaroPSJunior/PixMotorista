import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Search,
  Music,
  Disc,
  Radio,
  Heart,
  Shuffle,
  Repeat,
  Tv,
  ListMusic,
  Mic2,
  Maximize2,
  Check,
  ChevronDown,
  Sparkles,
  Sliders,
  RefreshCw,
  Clock,
  User,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumCover: string;
  durationMs: number;
  uri?: string;
}

interface SpotifyAppReplicaProps {
  onBack: () => void;
  isDriverView?: boolean;
}

const CATEGORIES = [
  { id: 'sertanejo', name: 'Sertanejo', color: 'from-amber-600 to-amber-900', query: 'Sertanejo 2025' },
  { id: 'pop', name: 'Pop Hits', color: 'from-pink-600 to-purple-900', query: 'Pop Top Hits' },
  { id: 'mpb', name: 'MPB & Brasil', color: 'from-emerald-600 to-teal-950', query: 'MPB Classicos' },
  { id: 'funk', name: 'Funk Brasil', color: 'from-red-600 to-amber-900', query: 'Funk Hits' },
  { id: 'rock', name: 'Rock Classics', color: 'from-blue-700 to-slate-950', query: 'Rock Classics' },
  { id: 'eletronica', name: 'Eletrônica', color: 'from-cyan-600 to-indigo-950', query: 'Electronic Dance' },
  { id: 'pagode', name: 'Pagode & Samba', color: 'from-yellow-600 to-amber-950', query: 'Pagode Anos 90 2024' },
  { id: 'chill', name: 'Relax / Viagem', color: 'from-indigo-600 to-slate-900', query: 'Chillout Roadtrip' },
];

const DEFAULT_PRESETS = [
  {
    id: 'sertanejo-hit',
    name: 'Sertanejo no Carro',
    artist: 'Simone Mendes & Convidados',
    album: 'Cintilante',
    albumCover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
    durationMs: 180000,
    uri: 'spotify:track:1',
  },
  {
    id: 'mpb-hit',
    name: 'Anunciação',
    artist: 'Alceu Valença',
    album: 'Anunciação Ao Vivo',
    albumCover: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80',
    durationMs: 210000,
    uri: 'spotify:track:2',
  },
  {
    id: 'pop-hit',
    name: 'As It Was',
    artist: 'Harry Styles',
    album: "Harry's House",
    albumCover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
    durationMs: 167000,
    uri: 'spotify:track:3',
  },
  {
    id: 'relax-hit',
    name: 'Coffee Beats & Rain',
    artist: 'Lo-Fi Chill Hop',
    album: 'Relaxing Highway Drive',
    albumCover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80',
    durationMs: 195000,
    uri: 'spotify:track:4',
  },
];

export const SpotifyAppReplica: React.FC<SpotifyAppReplicaProps> = ({
  onBack,
  isDriverView = false,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'library' | 'devices' | 'lyrics'>('home');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack>(DEFAULT_PRESETS[0]);
  const [progressMs, setProgressMs] = useState<number>(35000);
  const [volume, setVolume] = useState<number>(80);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatState, setRepeatState] = useState<'off' | 'context' | 'track'>('off');
  
  // Expanded Player Modal
  const [isExpandedPlayerOpen, setIsExpandedPlayerOpen] = useState<boolean>(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [searchResultPlaylists, setSearchResultPlaylists] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // User Library & Playlists
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<SpotifyTrack[]>([]);
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [statusInfo, setStatusInfo] = useState<any>(null);

  const progressInterval = useRef<any>(null);

  // Load Status, Currently Playing, Playlists, Recently Played, Saved Tracks, Devices
  useEffect(() => {
    fetchSpotifyData();
    const interval = setInterval(fetchCurrentlyPlaying, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSpotifyData = async () => {
    fetchCurrentlyPlaying();
    fetchUserPlaylists();
    fetchRecentlyPlayed();
    fetchSavedTracks();
    fetchDevices();
  };

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
            albumCover: data.item.album.images[0]?.url || DEFAULT_PRESETS[0].albumCover,
            durationMs: data.item.duration_ms || 180000,
            uri: data.item.uri,
          });
          setIsPlaying(Boolean(data.is_playing));
          setProgressMs(data.progress_ms || 0);
          if (data.shuffle_state !== undefined) setIsShuffle(Boolean(data.shuffle_state));
          if (data.repeat_state) setRepeatState(data.repeat_state);
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar reprodução ao vivo:', e);
    }
  };

  const fetchUserPlaylists = async () => {
    const token = localStorage.getItem('spotify_access_token');
    try {
      const res = await fetch('/api/spotify/playlists', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.items) setUserPlaylists(data.items);
      }
    } catch (e) {
      console.warn('Erro ao carregar playlists:', e);
    }
  };

  const fetchRecentlyPlayed = async () => {
    const token = localStorage.getItem('spotify_access_token');
    try {
      const res = await fetch('/api/spotify/recently-played', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          const mapped = data.items.map((item: any) => ({
            id: item.track.id,
            name: item.track.name,
            artist: item.track.artists.map((a: any) => a.name).join(', '),
            album: item.track.album.name,
            albumCover: item.track.album.images[0]?.url || DEFAULT_PRESETS[0].albumCover,
            durationMs: item.track.duration_ms,
            uri: item.track.uri,
          }));
          setRecentlyPlayed(mapped);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar tocadas recentemente:', e);
    }
  };

  const fetchSavedTracks = async () => {
    const token = localStorage.getItem('spotify_access_token');
    try {
      const res = await fetch('/api/spotify/saved-tracks', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          const mapped = data.items.map((item: any) => ({
            id: item.track.id,
            name: item.track.name,
            artist: item.track.artists.map((a: any) => a.name).join(', '),
            album: item.track.album.name,
            albumCover: item.track.album.images[0]?.url || DEFAULT_PRESETS[0].albumCover,
            durationMs: item.track.duration_ms,
            uri: item.track.uri,
          }));
          setSavedTracks(mapped);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar faixas salvas:', e);
    }
  };

  const fetchDevices = async () => {
    const token = localStorage.getItem('spotify_access_token');
    try {
      const res = await fetch('/api/spotify/devices', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        if (data.userProfile) {
          setStatusInfo((prev: any) => ({ ...prev, userProfile: data.userProfile }));
        }
        return;
      }
    } catch (e) {
      console.warn('Erro ao buscar dispositivos reais do Spotify:', e);
    }
    setDevices([]);
  };

  // Local tick simulation for playing progress bar
  useEffect(() => {
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        setProgressMs((prev) => (prev >= currentTrack.durationMs ? 0 : prev + 1000));
      }, 1000);
    } else {
      clearInterval(progressInterval.current);
    }
    return () => clearInterval(progressInterval.current);
  }, [isPlaying, currentTrack.durationMs]);

  // Actions
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
        setTimeout(fetchCurrentlyPlaying, 600);
      }
    } catch (e) {
      console.warn('Falha no comando play/pause:', e);
    }
  };

  const playSpecificTrack = async (track: SpotifyTrack, queueTracks?: SpotifyTrack[]) => {
    setCurrentTrack(track);
    setProgressMs(0);
    setIsPlaying(true);

    const token = localStorage.getItem('spotify_access_token');
    
    // Build payload to ensure continuous queue playback
    let payload: any = { uris: track.uri ? [track.uri] : undefined };
    if (queueTracks && queueTracks.length > 0) {
      const validUris = queueTracks.map((t) => t.uri).filter(Boolean);
      if (validUris.length > 0 && track.uri) {
        payload = {
          uris: validUris,
          offset: { uri: track.uri },
        };
      }
    }

    try {
      const res = await fetch('/api/spotify/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setTimeout(fetchCurrentlyPlaying, 600);
      }
    } catch (e) {
      console.warn('Erro ao dar play na música:', e);
    }
  };

  const playPlaylistContext = async (playlistUri: string, playlistName?: string, coverUrl?: string) => {
    setIsPlaying(true);
    setProgressMs(0);
    if (playlistName) {
      setCurrentTrack({
        id: playlistUri,
        name: playlistName,
        artist: 'Playlist Spotify',
        album: playlistName,
        albumCover: coverUrl || DEFAULT_PRESETS[0].albumCover,
        durationMs: 210000,
        uri: playlistUri,
      });
    }

    const token = localStorage.getItem('spotify_access_token');
    try {
      const res = await fetch('/api/spotify/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ context_uri: playlistUri }),
      });
      if (res.ok) {
        setTimeout(fetchCurrentlyPlaying, 800);
      }
    } catch (e) {
      console.warn('Erro ao tocar playlist:', e);
    }
  };

  const handleNext = async () => {
    const token = localStorage.getItem('spotify_access_token');
    try {
      await fetch('/api/spotify/next', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setTimeout(fetchCurrentlyPlaying, 600);
    } catch (e) {
      console.warn('Erro ao avançar música:', e);
    }
  };

  const handlePrevious = async () => {
    const token = localStorage.getItem('spotify_access_token');
    try {
      await fetch('/api/spotify/previous', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setTimeout(fetchCurrentlyPlaying, 600);
    } catch (e) {
      console.warn('Erro ao voltar música:', e);
    }
  };

  const handleSeek = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPos = Number(e.target.value);
    setProgressMs(newPos);
    const token = localStorage.getItem('spotify_access_token');
    try {
      await fetch('/api/spotify/seek', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ position_ms: newPos }),
      });
    } catch (e) {
      console.warn('Erro ao buscar posição na faixa:', e);
    }
  };

  const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = Number(e.target.value);
    setVolume(newVol);
    const token = localStorage.getItem('spotify_access_token');
    try {
      await fetch('/api/spotify/volume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ volume_percent: newVol }),
      });
    } catch (e) {
      console.warn('Erro ao mudar volume:', e);
    }
  };

  const handleToggleShuffle = async () => {
    const nextState = !isShuffle;
    setIsShuffle(nextState);
    const token = localStorage.getItem('spotify_access_token');
    try {
      await fetch('/api/spotify/shuffle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ state: nextState }),
      });
    } catch (e) {
      console.warn('Erro ao alternar ordem aleatória:', e);
    }
  };

  const handleToggleRepeat = async () => {
    const nextRepeat = repeatState === 'off' ? 'context' : repeatState === 'context' ? 'track' : 'off';
    setRepeatState(nextRepeat);
    const token = localStorage.getItem('spotify_access_token');
    try {
      await fetch('/api/spotify/repeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ state: nextRepeat }),
      });
    } catch (e) {
      console.warn('Erro ao alternar modo de repetição:', e);
    }
  };

  const handleSearch = async (queryText?: string) => {
    const textToSearch = queryText || searchQuery;
    if (!textToSearch.trim()) return;

    setIsSearching(true);
    const token = localStorage.getItem('spotify_access_token');
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(textToSearch)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tracks?.items) {
          const mappedTracks = data.tracks.items.map((t: any) => ({
            id: t.id,
            name: t.name,
            artist: t.artists ? t.artists.map((a: any) => a.name).join(', ') : 'Artista',
            album: t.album?.name || '',
            albumCover: t.album?.images?.[0]?.url || DEFAULT_PRESETS[0].albumCover,
            durationMs: t.duration_ms || 180000,
            uri: t.uri,
          }));
          setSearchResults(mappedTracks);
        } else {
          setSearchResults([]);
        }

        if (data.playlists?.items) {
          const mappedPlaylists = data.playlists.items.filter(Boolean).map((p: any) => ({
            id: p.id,
            name: p.name,
            owner: p.owner?.display_name || 'Spotify',
            coverImage: p.images?.[0]?.url || DEFAULT_PRESETS[0].albumCover,
            tracksCount: p.tracks?.total || 0,
            uri: p.uri,
          }));
          setSearchResultPlaylists(mappedPlaylists);
        } else {
          setSearchResultPlaylists([]);
        }
      }
    } catch (e) {
      console.warn('Erro na busca Spotify:', e);
    }
    setIsSearching(false);
  };

  const handleTransferDevice = async (deviceId: string) => {
    setDevices((prev) =>
      prev.map((dev) => ({
        ...dev,
        is_active: dev.id === deviceId,
      }))
    );

    const token = localStorage.getItem('spotify_access_token');
    try {
      await fetch('/api/spotify/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ device_id: deviceId, play: true }),
      });
      fetchDevices();
      setTimeout(fetchCurrentlyPlaying, 1000);
    } catch (e) {
      console.warn('Erro ao transferir dispositivo:', e);
    }
  };

  // Helper formatting mm:ss
  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#121212] text-white flex flex-col font-sans select-none overflow-hidden animate-fadeIn">
      {/* 1. TOP HEADER BAR WITH PROMINENT BACK BUTTON */}
      <header className="h-16 bg-[#000000]/80 backdrop-blur-md border-b border-[#282828] px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            type="button"
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm rounded-full flex items-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            <span>Voltar para a Corrida</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 border-l border-[#282828] pl-3 ml-1">
            <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center text-black font-black text-xs shadow-md">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.12-.779-.18-.899-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 C9.6 9.9 15 10.561 18.72 12.841c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.18-.1.2-1.2-.42-.18-.6.42-1.2 1.02-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z" />
              </svg>
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-white leading-none">Spotify do Veículo</h1>
              <p className="text-[11px] text-emerald-400 font-medium">Sincronizado com o Som do Carro</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 bg-[#181818] border border-[#282828] px-3 py-1.5 rounded-full text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Status: Conectado</span>
          </div>

          <button
            onClick={fetchSpotifyData}
            title="Atualizar dados do Spotify"
            type="button"
            className="p-2.5 bg-[#181818] hover:bg-[#282828] text-slate-300 rounded-full transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN VIEW BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* DESKTOP SIDEBAR NAVIGATION */}
        <aside className="hidden md:flex w-64 bg-[#000000] border-r border-[#282828] flex-col p-4 space-y-6 shrink-0">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${
                activeTab === 'home' ? 'bg-[#282828] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Music className={`w-5 h-5 ${activeTab === 'home' ? 'text-emerald-500' : ''}`} />
              <span>Início</span>
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${
                activeTab === 'search' ? 'bg-[#282828] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className={`w-5 h-5 ${activeTab === 'search' ? 'text-emerald-500' : ''}`} />
              <span>Buscar</span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${
                activeTab === 'library' ? 'bg-[#282828] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListMusic className={`w-5 h-5 ${activeTab === 'library' ? 'text-emerald-500' : ''}`} />
              <span>Sua Biblioteca</span>
            </button>

            <button
              onClick={() => setActiveTab('devices')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${
                activeTab === 'devices' ? 'bg-[#282828] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv className={`w-5 h-5 ${activeTab === 'devices' ? 'text-emerald-500' : ''}`} />
              <span>Dispositivos</span>
            </button>

            <button
              onClick={() => setActiveTab('lyrics')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${
                activeTab === 'lyrics' ? 'bg-[#282828] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mic2 className={`w-5 h-5 ${activeTab === 'lyrics' ? 'text-emerald-500' : ''}`} />
              <span>Letras da Música</span>
            </button>
          </nav>

          <div className="pt-4 border-t border-[#282828] space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
              Sua Biblioteca do Spotify
            </h3>
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1 text-xs">
              {userPlaylists.length > 0 ? (
                userPlaylists.map((pl: any) => (
                  <button
                    key={pl.id}
                    onClick={() => {
                      if (pl.uri) {
                        playSpecificTrack({
                          id: pl.id,
                          name: pl.name,
                          artist: 'Playlist Spotify',
                          album: 'Spotify',
                          albumCover: pl.images?.[0]?.url || DEFAULT_PRESETS[0].albumCover,
                          durationMs: 180000,
                          uri: pl.uri,
                        });
                      }
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#181818] truncate transition-colors"
                  >
                    {pl.name}
                  </button>
                ))
              ) : (
                <p className="px-2 text-slate-500 italic">Sincronizando playlists...</p>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN DISPLAY CONTENT CANVAS */}
        <main className="flex-1 bg-gradient-to-b from-[#1e1e1e] to-[#121212] overflow-y-auto p-4 sm:p-6 pb-32">
          {/* TAB 1: INÍCIO (HOME) */}
          {activeTab === 'home' && (
            <div className="space-y-8 max-w-5xl mx-auto">
              {/* Header Greeting Banner */}
              <div className="bg-gradient-to-r from-emerald-900/60 via-teal-950/80 to-[#181818] border border-emerald-500/30 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-extrabold rounded-full border border-emerald-500/30">
                      🚗 Som do Veículo em Tempo Real
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
                      Boa viagem! O que quer ouvir?
                    </h2>
                    <p className="text-sm text-slate-300 mt-1 max-w-lg">
                      Escolha qualquer ritmo ou pesquise sua música favorita para tocar direto nas caixas de som do veículo.
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('search')}
                    type="button"
                    className="px-5 py-3 bg-[#1DB954] hover:bg-emerald-400 text-black font-black text-sm rounded-full flex items-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95 shrink-0"
                  >
                    <Search className="w-5 h-5 stroke-[2.5]" />
                    <span>Buscar Qualquer Música</span>
                  </button>
                </div>
              </div>

              {/* Quick Play 6-Grid Tiles */}
              <div>
                <h3 className="text-lg font-extrabold text-white mb-4">Atalhos Rápidos de Viagem</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {DEFAULT_PRESETS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => playSpecificTrack(item)}
                      className="bg-[#282828]/60 hover:bg-[#282828] border border-[#383838]/50 rounded-2xl p-3 flex items-center gap-3 transition-all group text-left cursor-pointer hover:border-emerald-500/50"
                    >
                      <img
                        src={item.albumCover}
                        alt={item.name}
                        className="w-12 h-12 rounded-xl object-cover shadow-md shrink-0 group-hover:scale-105 transition-transform"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-white truncate">{item.name}</h4>
                        <p className="text-[11px] text-slate-400 truncate">{item.artist}</p>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-[#1DB954] text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shrink-0">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Estilos e Moods de Corrida */}
              <div>
                <h3 className="text-lg font-extrabold text-white mb-4">Estilos de Corrida</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSearchQuery(cat.query);
                        setActiveTab('search');
                        handleSearch(cat.query);
                      }}
                      className={`bg-gradient-to-br ${cat.color} p-4 rounded-2xl h-28 flex flex-col justify-between relative overflow-hidden group shadow-lg text-left hover:scale-[1.02] transition-transform cursor-pointer border border-white/10`}
                    >
                      <span className="font-extrabold text-base text-white z-10">{cat.name}</span>
                      <span className="text-xs text-white/80 font-medium z-10 flex items-center gap-1">
                        <span>Tocar estilo</span>
                        <Play className="w-3 h-3 fill-current" />
                      </span>
                      <Disc className="w-16 h-16 text-white/10 absolute -bottom-3 -right-3 group-hover:scale-125 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Tocadas Recentemente */}
              {recentlyPlayed.length > 0 && (
                <div>
                  <h3 className="text-lg font-extrabold text-white mb-4">Tocadas Recentemente no Carro</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {recentlyPlayed.slice(0, 5).map((track, idx) => (
                      <div
                        key={`${track.id}-${idx}`}
                        onClick={() => playSpecificTrack(track)}
                        className="bg-[#181818] hover:bg-[#282828] p-3 rounded-2xl transition-all cursor-pointer group border border-[#282828]"
                      >
                        <div className="relative mb-3">
                          <img
                            src={track.albumCover}
                            alt={track.name}
                            className="w-full aspect-square rounded-xl object-cover shadow-md"
                          />
                          <button
                            type="button"
                            className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#1DB954] text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-105"
                          >
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </button>
                        </div>
                        <h4 className="font-bold text-xs text-white truncate">{track.name}</h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{track.artist}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BUSCAR (SEARCH) */}
          {activeTab === 'search' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="relative">
                <Search className="w-6 h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="O que você quer ouvir no carro? (Música, artista ou estilo)..."
                  className="w-full bg-[#242424] text-white placeholder-slate-400 pl-14 pr-28 py-4 rounded-full font-bold text-sm sm:text-base border border-[#383838] focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xl"
                />
                <button
                  onClick={() => handleSearch()}
                  disabled={isSearching}
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-[#1DB954] hover:bg-emerald-400 text-black font-extrabold text-xs rounded-full transition-all cursor-pointer shadow-md"
                >
                  {isSearching ? 'Buscando...' : 'Buscar'}
                </button>
              </div>

              {/* Categorias Grid Se não houver resultados */}
              {searchResults.length === 0 && (
                <div>
                  <h3 className="text-base font-extrabold text-slate-300 mb-4">Navegar por Seções</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSearchQuery(cat.query);
                          handleSearch(cat.query);
                        }}
                        className={`bg-gradient-to-br ${cat.color} p-4 rounded-2xl h-32 flex flex-col justify-between relative overflow-hidden group shadow-lg text-left hover:scale-[1.03] transition-transform cursor-pointer border border-white/10`}
                      >
                        <span className="font-extrabold text-lg text-white z-10">{cat.name}</span>
                        <Disc className="w-20 h-20 text-white/10 absolute -bottom-4 -right-4 group-hover:scale-125 transition-transform" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Resultados da Pesquisa: Playlists */}
              {searchResultPlaylists.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="text-base font-extrabold text-emerald-400 flex items-center gap-2">
                    <Radio className="w-5 h-5" />
                    <span>Playlists Encontradas</span>
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {searchResultPlaylists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => playPlaylistContext(pl.uri, pl.name, pl.coverImage)}
                        className="bg-[#181818] hover:bg-[#282828] p-3 rounded-2xl transition-all cursor-pointer group border border-[#282828] flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative mb-3">
                            <img
                              src={pl.coverImage}
                              alt={pl.name}
                              className="w-full aspect-square rounded-xl object-cover shadow-md"
                            />
                            <button
                              type="button"
                              className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#1DB954] text-black flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all shadow-xl"
                            >
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            </button>
                          </div>
                          <h4 className="font-extrabold text-xs text-white truncate">{pl.name}</h4>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">Por {pl.owner}</p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playPlaylistContext(pl.uri, pl.name, pl.coverImage);
                          }}
                          className="mt-3 w-full py-1.5 bg-[#1DB954]/20 hover:bg-[#1DB954] text-emerald-400 hover:text-black font-extrabold text-[11px] rounded-xl transition-all border border-[#1DB954]/40 flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Tocar Playlist</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resultados da Pesquisa: Músicas */}
              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-extrabold text-emerald-400 flex items-center gap-2">
                    <Music className="w-5 h-5" />
                    <span>Músicas Encontradas</span>
                  </h3>

                  <div className="bg-[#181818] border border-[#282828] rounded-2xl overflow-hidden divide-y divide-[#282828]">
                    {searchResults.map((track) => (
                      <div
                        key={track.id}
                        className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-[#282828] transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={track.albumCover}
                            alt={track.name}
                            className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md"
                          />
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-white truncate">{track.name}</h4>
                            <p className="text-xs text-slate-400 truncate">{track.artist} • {track.album}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => playSpecificTrack(track, searchResults)}
                          type="button"
                          className="px-4 py-2 bg-[#1DB954] hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Tocar no Carro</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SUA BIBLIOTECA (LIBRARY) */}
          {activeTab === 'library' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-black text-white">Sua Biblioteca</h2>

              {/* Músicas Salvas / Curtidas */}
              <div>
                <h3 className="text-base font-extrabold text-slate-300 mb-3 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-emerald-400 fill-emerald-400" />
                  <span>Músicas Curtidas ({savedTracks.length})</span>
                </h3>

                <div className="bg-[#181818] border border-[#282828] rounded-2xl divide-y divide-[#282828]">
                  {savedTracks.length > 0 ? (
                    savedTracks.map((track) => (
                      <div
                        key={track.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-[#282828] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={track.albumCover}
                            alt={track.name}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-white truncate">{track.name}</h4>
                            <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => playSpecificTrack(track)}
                          type="button"
                          className="p-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black font-bold text-xs rounded-lg transition-colors shrink-0 flex items-center gap-1"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Tocar</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="p-4 text-xs text-slate-400 italic">Buscando músicas curtidas do Spotify...</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DISPOSITIVOS (DEVICES) */}
          {activeTab === 'devices' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-[#181818] border border-[#282828] rounded-3xl p-6 text-center space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#282828] pb-4">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <Tv className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                        <span>Dispositivos Reais do Spotify</span>
                        {statusInfo?.userProfile && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold rounded-full">
                            Conta: {statusInfo.userProfile.display_name || statusInfo.userProfile.id}
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-slate-400">
                        Buscando aparelhos conectados à conta do motorista cadastrada no sistema.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => fetchDevices()}
                    type="button"
                    className="px-3 py-1.5 bg-[#282828] hover:bg-[#333] text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Atualizar Lista</span>
                  </button>
                </div>

                <div className="space-y-2 text-left">
                  {devices.length > 0 ? (
                    devices.map((dev: any) => (
                      <div
                        key={dev.id}
                        className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                          dev.is_active
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-white shadow-md'
                            : 'bg-[#242424] border-[#383838] text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Tv className={`w-5 h-5 ${dev.is_active ? 'text-emerald-400' : 'text-slate-400'}`} />
                          <div>
                            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                              <span>{dev.name}</span>
                              {dev.is_default && (
                                <span className="px-2 py-0.5 bg-sky-500 text-slate-950 font-extrabold text-[10px] rounded-full">
                                  Padrão
                                </span>
                              )}
                              {dev.is_active && (
                                <span className="px-2 py-0.5 bg-emerald-500 text-black font-extrabold text-[10px] rounded-full">
                                  Ativo
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-slate-400 capitalize">
                              {dev.type} {dev.volume_percent !== undefined ? `• Volume ${dev.volume_percent}%` : ''}
                            </p>
                          </div>
                        </div>

                        {!dev.is_active && (
                          <button
                            onClick={() => handleTransferDevice(dev.id)}
                            type="button"
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                          >
                            Transferir Som
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-6 bg-[#242424] rounded-2xl text-center space-y-3 border border-[#333]">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
                        <Tv className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-sm text-white">Nenhum dispositivo Spotify ativo encontrado</h3>
                      <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                        Para listar seus aparelhos reais, certifique-se de que o aplicativo do <strong>Spotify</strong> está aberto e tocando em algum dispositivo (celular, som do carro via Bluetooth ou computador).
                      </p>
                      <button
                        onClick={() => fetchDevices()}
                        type="button"
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Buscar Dispositivos Reais Novamente</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LETRAS (LYRICS) */}
          {activeTab === 'lyrics' && (
            <div className="space-y-6 max-w-xl mx-auto text-center py-6">
              <div className="bg-gradient-to-b from-purple-900/40 via-[#181818] to-[#121212] border border-purple-500/30 rounded-3xl p-8 space-y-6 shadow-2xl">
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={currentTrack.albumCover}
                    alt={currentTrack.name}
                    className="w-28 h-28 rounded-2xl object-cover shadow-2xl border border-white/20"
                  />
                  <div>
                    <h3 className="text-xl font-black text-white">{currentTrack.name}</h3>
                    <p className="text-sm text-emerald-400 font-bold mt-0.5">{currentTrack.artist}</p>
                  </div>
                </div>

                <div className="space-y-4 text-slate-300 font-extrabold text-base leading-relaxed tracking-wide">
                  <p className="text-slate-500 text-xs">Letras em Tempo Real (Acompanhamento no Carro)</p>
                  <p className="text-emerald-400 text-xl font-black animate-pulse">♪ {currentTrack.name} ♪</p>
                  <p className="text-slate-200">Sinta a batida e curta a viagem no som do veículo!</p>
                  <p className="text-slate-400 text-sm">Tocando em alta fidelidade via Spotify Connect</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 3. BOTTOM STICKY SPOTIFY AUDIO PLAYER BAR */}
      <footer className="h-20 bg-[#000000] border-t border-[#282828] px-4 flex items-center justify-between shrink-0 z-30">
        {/* Left Track Info */}
        <div className="flex items-center gap-3 min-w-0 w-1/4">
          <img
            src={currentTrack.albumCover}
            alt={currentTrack.name}
            className="w-12 h-12 rounded-xl object-cover shrink-0 cursor-pointer shadow-md hover:opacity-80 transition-opacity"
            onClick={() => setIsExpandedPlayerOpen(true)}
          />
          <div className="min-w-0 hidden sm:block">
            <h4
              onClick={() => setIsExpandedPlayerOpen(true)}
              className="font-extrabold text-xs text-white truncate cursor-pointer hover:underline"
            >
              {currentTrack.name}
            </h4>
            <p className="text-[11px] text-slate-400 truncate">{currentTrack.artist}</p>
          </div>
          <button
            onClick={() => setIsLiked(!isLiked)}
            type="button"
            className={`p-1.5 rounded-full transition-colors ${
              isLiked ? 'text-emerald-500 fill-emerald-500' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Center Main Controls & Progress Bar */}
        <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-md">
          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleShuffle}
              type="button"
              className={`p-1.5 transition-colors cursor-pointer ${
                isShuffle ? 'text-emerald-500 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={handlePrevious}
              type="button"
              className="text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={handleTogglePlay}
              type="button"
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={handleNext}
              type="button"
              className="text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            <button
              onClick={handleToggleRepeat}
              type="button"
              className={`p-1.5 transition-colors cursor-pointer ${
                repeatState !== 'off' ? 'text-emerald-500 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span>{formatTime(progressMs)}</span>
            <input
              type="range"
              min={0}
              max={currentTrack.durationMs || 180000}
              value={progressMs}
              onChange={handleSeek}
              className="w-full accent-emerald-500 h-1 bg-[#484848] rounded-lg cursor-pointer"
            />
            <span>{formatTime(currentTrack.durationMs || 180000)}</span>
          </div>
        </div>

        {/* Right Tools & Volume */}
        <div className="flex items-center justify-end gap-3 w-1/4">
          <button
            onClick={() => setActiveTab('lyrics')}
            title="Letras"
            type="button"
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Mic2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            title="Dispositivos"
            type="button"
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Tv className="w-4 h-4" />
          </button>

          <div className="hidden lg:flex items-center gap-2 w-28">
            <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={handleVolumeChange}
              className="w-full accent-emerald-500 h-1 bg-[#484848] rounded-lg cursor-pointer"
            />
          </div>

          <button
            onClick={() => setIsExpandedPlayerOpen(true)}
            title="Expandir Reprodutor"
            type="button"
            className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden bg-[#000000] border-t border-[#282828] h-14 flex items-center justify-around z-30">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'home' ? 'text-emerald-500' : 'text-slate-400'
          }`}
        >
          <Music className="w-5 h-5" />
          <span>Início</span>
        </button>

        <button
          onClick={() => setActiveTab('search')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'search' ? 'text-emerald-500' : 'text-slate-400'
          }`}
        >
          <Search className="w-5 h-5" />
          <span>Buscar</span>
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'library' ? 'text-emerald-500' : 'text-slate-400'
          }`}
        >
          <ListMusic className="w-5 h-5" />
          <span>Biblioteca</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'devices' ? 'text-emerald-500' : 'text-slate-400'
          }`}
        >
          <Tv className="w-5 h-5" />
          <span>Dispositivos</span>
        </button>
      </nav>

      {/* 4. EXPANDED NOW PLAYING MODAL OVERLAY */}
      {isExpandedPlayerOpen && (
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#2a1a3a] via-[#121212] to-[#000000] p-6 flex flex-col justify-between animate-fadeIn select-none">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsExpandedPlayerOpen(false)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
            <div className="text-center">
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">
                Tocando no Carro
              </span>
              <h3 className="text-xs font-extrabold text-white">{currentTrack.album}</h3>
            </div>
            <div className="w-10"></div>
          </div>

          {/* Album Cover Big */}
          <div className="my-auto max-w-sm mx-auto w-full space-y-6 text-center">
            <img
              src={currentTrack.albumCover}
              alt={currentTrack.name}
              className="w-full aspect-square rounded-3xl object-cover shadow-2xl border border-white/10"
            />

            <div className="flex items-center justify-between text-left">
              <div>
                <h2 className="text-xl font-black text-white">{currentTrack.name}</h2>
                <p className="text-sm font-bold text-slate-400">{currentTrack.artist}</p>
              </div>

              <button
                onClick={() => setIsLiked(!isLiked)}
                className={`p-2 rounded-full ${isLiked ? 'text-emerald-500' : 'text-slate-400'}`}
              >
                <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Progress Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={currentTrack.durationMs || 180000}
                value={progressMs}
                onChange={handleSeek}
                className="w-full accent-emerald-500 h-1.5 bg-white/20 rounded-lg cursor-pointer"
              />
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>{formatTime(progressMs)}</span>
                <span>{formatTime(currentTrack.durationMs || 180000)}</span>
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleToggleShuffle}
                className={isShuffle ? 'text-emerald-400' : 'text-slate-400'}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button onClick={handlePrevious} className="text-white hover:scale-110 transition-transform">
                <SkipBack className="w-7 h-7" />
              </button>

              <button
                onClick={handleTogglePlay}
                className="w-16 h-16 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
              </button>

              <button onClick={handleNext} className="text-white hover:scale-110 transition-transform">
                <SkipForward className="w-7 h-7" />
              </button>

              <button
                onClick={handleToggleRepeat}
                className={repeatState !== 'off' ? 'text-emerald-400' : 'text-slate-400'}
              >
                <Repeat className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="text-center pt-4 border-t border-white/10 flex items-center justify-center gap-6">
            <button
              onClick={() => {
                setIsExpandedPlayerOpen(false);
                setActiveTab('lyrics');
              }}
              className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 font-bold"
            >
              <Mic2 className="w-4 h-4 text-emerald-400" />
              <span>Ver Letras</span>
            </button>

            <button
              onClick={() => {
                setIsExpandedPlayerOpen(false);
                setActiveTab('devices');
              }}
              className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 font-bold"
            >
              <Tv className="w-4 h-4 text-emerald-400" />
              <span>Dispositivos</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
