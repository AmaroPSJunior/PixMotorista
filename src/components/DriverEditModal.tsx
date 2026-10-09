import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Plus,
  Trash2,
  Pencil,
  RotateCcw,
  User,
  Mail,
  Car,
  MapPin,
  Tag,
  DollarSign,
  Check,
  Key,
  Upload,
  QrCode,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Printer,
  Wifi,
  Mic,
  MicOff,
  Disc,
  Music,
  Zap,
  Terminal,
  Server,
  HelpCircle,
  Copy,
  ShieldCheck,
} from 'lucide-react';
import { DriverProfile, AdditionalService } from '../types';
import { normalizeDriverPixLayout } from '../domain/driverPixLayout';
import { getPublicPassengerUrl } from '../utils/urlHelper';
import { fetchMercadoPagoStatus, MercadoPagoStatusResponse } from '../lib/mercadopago';

interface DriverEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: DriverProfile;
  services: AdditionalService[];
  onSaveDriver: (updatedDriver: DriverProfile) => void;
  onSaveServices: (updatedServices: AdditionalService[]) => void;
  onResetDefaults: () => void;
  onOpenPrintModal?: () => void;
  onOpenMercadoPagoModal?: () => void;
}

export const DriverEditModal: React.FC<DriverEditModalProps> = ({
  isOpen,
  onClose,
  driver,
  services,
  onSaveDriver,
  onSaveServices,
  onResetDefaults,
  onOpenPrintModal,
  onOpenMercadoPagoModal,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'services'>('profile');

  // Form states
  const [profileForm, setProfileForm] = useState<DriverProfile>({ ...driver });
  const [servicesForm, setServicesForm] = useState<AdditionalService[]>([
    ...services,
  ]);

  // Voice dictation states
  const [isListeningName, setIsListeningName] = useState(false);
  const [isListeningReceiver, setIsListeningReceiver] = useState(false);

  // Mercado Pago status state
  const [mpStatus, setMpStatus] = useState<MercadoPagoStatusResponse | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState<boolean>(false);

  const checkMercadoPagoStatus = async () => {
    try {
      const res = await fetchMercadoPagoStatus();
      setMpStatus(res);
    } catch (e) {
      console.warn('Erro ao checar status do Mercado Pago:', e);
    }
  };

  const handleStartDictation = (field: 'name' | 'receiverName') => {
    const SpeechRecognitionWindow =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognitionWindow) {
      alert('Seu navegador não possui suporte para ditado por voz. Tente usar o Google Chrome.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionWindow();
      recognition.lang = 'pt-BR';
      recognition.interimResults = true;
      recognition.continuous = false;

      if (field === 'name') setIsListeningName(true);
      if (field === 'receiverName') setIsListeningReceiver(true);

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');

        if (transcript) {
          setProfileForm((prev) => ({
            ...prev,
            [field]: transcript,
          }));
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Erro no reconhecimento de voz:', err);
        if (field === 'name') setIsListeningName(false);
        if (field === 'receiverName') setIsListeningReceiver(false);
      };

      recognition.onend = () => {
        if (field === 'name') setIsListeningName(false);
        if (field === 'receiverName') setIsListeningReceiver(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Falha ao iniciar ditado por voz:', err);
      if (field === 'name') setIsListeningName(false);
      if (field === 'receiverName') setIsListeningReceiver(false);
    }
  };

  // Spotify API Integration states
  const [spotifyStatus, setSpotifyStatus] = useState<any>(null);
  const [isConnectingSpotify, setIsConnectingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  const checkSpotifyStatus = async () => {
    try {
      const res = await fetch('/api/spotify/status');
      if (res.ok) {
        const data = await res.json();
        setSpotifyStatus(data);
      }
    } catch (e) {
      console.warn('Erro ao checar status do Spotify:', e);
    }
  };

  // Synchronize internal form states with latest Firestore database props whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setProfileForm({ ...driver });
      setServicesForm([...services]);
      checkSpotifyStatus();
      checkMercadoPagoStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
        checkSpotifyStatus();
        setSpotifyError(null);
        setIsConnectingSpotify(false);
      } else if (event.data?.type === 'SPOTIFY_AUTH_ERROR') {
        setSpotifyError(event.data.error || 'Falha ao conectar com o Spotify.');
        setIsConnectingSpotify(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectSpotify = async () => {
    setIsConnectingSpotify(true);
    setSpotifyError(null);
    try {
      const res = await fetch('/api/spotify/auth-url');
      const data = await res.json();
      if (!res.ok || data.needsConfig) {
        setSpotifyError(
          data.error ||
            'SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET precisam estar definidos no ambiente do servidor.'
        );
        setIsConnectingSpotify(false);
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
    } catch (e: any) {
      setSpotifyError(e.message || 'Erro ao iniciar autorização do Spotify.');
      setIsConnectingSpotify(false);
    }
  };

  const handleDisconnectSpotify = async () => {
    try {
      await fetch('/api/spotify/disconnect', { method: 'POST' });
      checkSpotifyStatus();
    } catch (e) {
      console.warn('Erro ao desconectar Spotify:', e);
    }
  };

  // New service item state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newIcon, setNewIcon] = useState('Fan');
  const [newCategory, setNewCategory] = useState<any>('conforto');
  const [newItemType, setNewItemType] = useState<'servico' | 'produto'>('servico');
  const [serviceFilterTab, setServiceFilterTab] = useState<'todos' | 'servico' | 'produto'>('todos');

  // Editing existing service item state
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editIcon, setEditIcon] = useState('Fan');
  const [editItemType, setEditItemType] = useState<'servico' | 'produto'>('servico');

  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleQrCodeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setProfileForm((prev) => ({
          ...prev,
          customQrCodeUrl: reader.result as string,
          useCustomQrCodeImage: true,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDriverPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setProfileForm((prev) => ({
          ...prev,
          photoUrl: reader.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleWifiQrCodeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setProfileForm((prev) => ({
          ...prev,
          wifiQrCodeUrl: reader.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateRandomKey = () => {
    const uuid =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    setProfileForm((prev) => ({ ...prev, randomPixKey: uuid }));
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveDriver(profileForm);
    onSaveServices(servicesForm);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleAddService = () => {
    if (!newTitle.trim()) return;
    const newItem: AdditionalService = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      description: newDesc.trim() || 'Item personalizado do motorista.',
      price: parseFloat(newPrice.replace(',', '.')) || 0,
      iconName: newIcon,
      category: newCategory,
      itemType: newItemType,
      isActive: true,
    };

    const updated = [...servicesForm, newItem];
    setServicesForm(updated);
    onSaveServices(updated);
    setNewTitle('');
    setNewDesc('');
    setNewPrice('');
  };

  const handleToggleItemType = (id: string) => {
    const updated = servicesForm.map((s) => {
      if (s.id !== id) return s;
      const currentType = s.itemType || (s.id === 'wifi' || s.id === 'spotify_music' || s.id === 'charger' ? 'servico' : 'produto');
      const nextType = currentType === 'servico' ? 'produto' : 'servico';
      return { ...s, itemType: nextType };
    });
    setServicesForm(updated);
    onSaveServices(updated);
  };

  const handleStartEditService = (srv: AdditionalService) => {
    setEditingServiceId(srv.id);
    setEditTitle(srv.title);
    setEditDesc(srv.description);
    setEditPrice(srv.price.toString());
    setEditIcon(srv.iconName || 'Fan');
    const type = srv.itemType || (srv.id === 'wifi' || srv.id === 'spotify_music' || srv.id === 'charger' ? 'servico' : 'produto');
    setEditItemType(type);
  };

  const handleSaveEditedService = () => {
    if (!editingServiceId) return;
    const updated = servicesForm.map((s) => {
      if (s.id !== editingServiceId) return s;
      return {
        ...s,
        title: editTitle.trim() || s.title,
        description: editDesc.trim() || s.description,
        price: parseFloat(editPrice.replace(',', '.')) || 0,
        iconName: editIcon,
        itemType: editItemType,
      };
    });
    setServicesForm(updated);
    onSaveServices(updated);
    setEditingServiceId(null);
  };

  const handleCancelEditService = () => {
    setEditingServiceId(null);
  };

  const handleToggleServiceActive = (id: string) => {
    const updated = servicesForm.map((s) =>
      s.id === id ? { ...s, isActive: s.isActive === false ? true : false } : s
    );
    setServicesForm(updated);
    onSaveServices(updated);
  };

  const handleRemoveService = (id: string) => {
    const updated = servicesForm.filter((s) => s.id !== id);
    setServicesForm(updated);
    onSaveServices(updated);
  };

  const handleUpdateServicePrice = (id: string, priceStr: string) => {
    const val = parseFloat(priceStr.replace(',', '.')) || 0;
    const updated = servicesForm.map((s) => (s.id === id ? { ...s, price: val } : s));
    setServicesForm(updated);
    onSaveServices(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>Configurações do Motorista</span>
            </h2>
            <p className="text-xs text-slate-400">
              Personalize sua chave Pix, dados do carro e lista de adicionais
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all ${
              activeTab === 'profile'
                ? 'border-emerald-600 text-emerald-800 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            1. Perfil & Pix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all ${
              activeTab === 'services'
                ? 'border-emerald-600 text-emerald-800 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. Tabela de Serviços ({servicesForm.length})
          </button>
        </div>

        {/* Modal Content Form */}
        <form onSubmit={handleSaveAll} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'profile' ? (
            <div className="space-y-4 text-xs">
              {/* Option to Print Headrest Sign */}
              {onOpenPrintModal && (
                <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 text-indigo-300">
                      <Printer className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-white">Placa para Encosto do Banco</h4>
                      <p className="text-[11px] text-slate-300 mt-0.5">Imprima a placa com QR Code e chave Pix</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPrintModal();
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir Placa</span>
                  </button>
                </div>
              )}

              <div data-testid="driver-pix-layout-setting" className="rounded-2xl bg-slate-950 p-4 text-white border border-sky-600/40 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-sky-400/20 flex items-center justify-center text-sky-300">
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 id="driver-pix-layout-label" className="text-sm font-black">Painel PIX automotivo</h3>
                      <p className="text-xs text-slate-300 mt-1">
                        {normalizeDriverPixLayout(profileForm.driverPixLayout) === 'automotive'
                          ? 'Novo layout para a central do carro'
                          : 'Layout atual do motorista'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-labelledby="driver-pix-layout-label"
                    aria-checked={normalizeDriverPixLayout(profileForm.driverPixLayout) === 'automotive'}
                    onClick={() => setProfileForm((previous) => ({
                      ...previous,
                      driverPixLayout: normalizeDriverPixLayout(previous.driverPixLayout) === 'automotive'
                        ? 'legacy'
                        : 'automotive',
                    }))}
                    className={`h-12 w-20 shrink-0 rounded-full p-1.5 flex items-center transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky-300 ${
                      normalizeDriverPixLayout(profileForm.driverPixLayout) === 'automotive' ? 'bg-sky-400' : 'bg-slate-600'
                    }`}
                  >
                    <span className={`h-9 w-9 rounded-full bg-white shadow-md transition-transform ${
                      normalizeDriverPixLayout(profileForm.driverPixLayout) === 'automotive' ? 'translate-x-8' : ''
                    }`} />
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  A escolha vale para a visão do motorista. O passageiro continua com a tela atual. Toque em Salvar Alterações para aplicar.
                </p>
              </div>

              {/* Requirement #1: Email Pix Key */}
              <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200/80 space-y-2">
                <label className="block font-extrabold text-emerald-900 text-xs">
                  Chave Pix E-mail *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={profileForm.pixKey}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, pixKey: e.target.value })
                    }
                    placeholder="seu.email@pix.com.br"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-emerald-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Pix Key Field */}
              <div className="bg-indigo-50/80 p-3.5 rounded-2xl border border-indigo-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-extrabold text-indigo-900 text-xs flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-indigo-600" />
                    <span>Chave Pix (Opcional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomKey}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-100/80 hover:bg-indigo-200/80 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Gerar Nova</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={profileForm.randomPixKey || ''}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, randomPixKey: e.target.value })
                  }
                  placeholder="Ex: 9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d"
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-indigo-700">
                  A chave Pix serve como alternativa para o passageiro realizar o pagamento.
                </p>
              </div>

              {/* Upload QR Code Image */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <label className="block font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <span>Imagem Customizada do QR Code Pix (Upload)</span>
                </label>

                {profileForm.customQrCodeUrl ? (
                  <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                    <img
                      src={profileForm.customQrCodeUrl}
                      alt="QR Code do Motorista"
                      className="w-16 h-16 object-contain rounded-lg border border-slate-200"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800 block truncate">
                        Imagem do QR Code Cadastrada
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold">
                        Sua imagem será exibida para o passageiro
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setProfileForm((prev) => ({
                          ...prev,
                          customQrCodeUrl: '',
                        }))
                      }
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-bold text-xs"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl bg-white cursor-pointer transition-all text-center">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-700">
                      Clique para subir a imagem do QR Code
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Formatos aceitos: PNG, JPG ou WEBP (Max 5MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQrCodeImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Public URL Config Field */}
              <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200/80 space-y-2">
                <label className="block font-extrabold text-emerald-950 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4 text-emerald-600" />
                    <span>Link Público do QR Code (Sem Login)</span>
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    Acesso Aberto
                  </span>
                </label>
                <input
                  type="text"
                  value={profileForm.customPublicUrl || ''}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, customPublicUrl: e.target.value })
                  }
                  placeholder={getPublicPassengerUrl()}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-emerald-800 leading-tight">
                  📌 <strong>Acesso Livre para Qualquer Passageiro:</strong> O QR Code gerado direcionará o celular de qualquer passageiro diretamente para este link sem pedir login do Google. (Deixe em branco para usar o link automático oficial).
                </p>
              </div>

              {/* Wi-Fi Configuration Section */}
              <div className="bg-sky-50/90 p-3.5 rounded-2xl border border-sky-200 space-y-3">
                <label className="block font-extrabold text-sky-950 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-sky-600" />
                    <span>Configurações do Wi-Fi do Veículo</span>
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nome da Rede Wi-Fi (SSID):
                    </label>
                    <input
                      type="text"
                      value={profileForm.wifiSsid || ''}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, wifiSsid: e.target.value })
                      }
                      placeholder="Wi-Fi 5G Veículo"
                      className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Senha de Acesso:
                    </label>
                    <input
                      type="text"
                      value={profileForm.wifiPassword || ''}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, wifiPassword: e.target.value })
                      }
                      placeholder="conectado5g"
                      className="w-full px-3 py-2 bg-white border border-sky-300 rounded-xl text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Imagem Personalizada do QR Code Wi-Fi (Opcional):
                  </label>
                  {profileForm.wifiQrCodeUrl ? (
                    <div className="flex items-center justify-between p-2.5 bg-white border border-sky-300 rounded-xl">
                      <div className="flex items-center gap-2">
                        <img
                          src={profileForm.wifiQrCodeUrl}
                          alt="QR Code Wi-Fi"
                          className="w-10 h-10 object-contain rounded border border-slate-200"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          Imagem do QR Code Wi-Fi Carregada
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setProfileForm((prev) => ({
                            ...prev,
                            wifiQrCodeUrl: '',
                          }))
                        }
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-bold text-xs cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 p-2.5 border border-dashed border-sky-300 hover:border-sky-500 rounded-xl bg-white cursor-pointer transition-all text-center">
                      <Upload className="w-4 h-4 text-sky-600" />
                      <span className="text-xs font-bold text-slate-700">
                        Subir Imagem do QR Code do Wi-Fi
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            alert('A imagem deve ter no máximo 5MB.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') {
                              setProfileForm((prev) => ({
                                ...prev,
                                wifiQrCodeUrl: reader.result as string,
                              }));
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1">
                    Se não enviar imagem, o sistema gerará o QR Code automaticamente com o Nome e Senha fornecidos acima.
                  </p>
                </div>
              </div>

              {/* Visibility Controls for Passenger ("Chavinhas") */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3 shadow-sm border border-slate-800">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-extrabold text-xs text-white">
                    Visibilidade para o Passageiro (Habilitar / Desabilitar)
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {/* Switch 1: Email Key */}
                  <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                    <div className="pr-2">
                      <span className="font-bold text-xs text-slate-100 block">
                        Chave Pix (E-mail)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Exibir opção de copiar chave de e-mail na tela do passageiro
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setProfileForm((prev) => ({
                          ...prev,
                          showEmailKey: prev.showEmailKey === false ? true : false,
                        }))
                      }
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
                        profileForm.showEmailKey !== false ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    >
                      <span
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          profileForm.showEmailKey !== false ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Switch 2: Pix Key */}
                  <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                    <div className="pr-2">
                      <span className="font-bold text-xs text-slate-100 block">
                        Chave Pix
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Exibir opção de copiar a chave Pix
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setProfileForm((prev) => ({
                          ...prev,
                          showRandomKey: prev.showRandomKey === false ? true : false,
                        }))
                      }
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
                        profileForm.showRandomKey !== false ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    >
                      <span
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          profileForm.showRandomKey !== false ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Switch 3: Spotify Music Controller */}
                  <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                    <div className="pr-2">
                      <span className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                        <span className="text-emerald-400 font-extrabold">🎵 Spotify</span> Controle de Música
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Exibir reprodutor e estilos musicais no app do passageiro
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setProfileForm((prev) => ({
                          ...prev,
                          showSpotifyController: prev.showSpotifyController === false ? true : false,
                        }))
                      }
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
                        profileForm.showSpotifyController !== false ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}
                    >
                      <span
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          profileForm.showSpotifyController !== false ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Spotify API Integration Panel */}
                <div className="bg-slate-900/90 p-4 rounded-2xl border border-emerald-500/30 space-y-3 mt-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                        <Disc className="w-5 h-5 animate-spin-slow" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-white flex items-center gap-2">
                          Integração com API do Spotify
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Conecte sua conta do Spotify para disponibilizar o controle de músicas no carro
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                        spotifyStatus?.isIntegrated
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {spotifyStatus?.isIntegrated ? '🟢 Conectado' : '🔴 Não Conectado'}
                    </span>
                  </div>

                  {/* Connected vs Disconnected details */}
                  {spotifyStatus?.isIntegrated ? (
                    <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {spotifyStatus?.userProfile?.images?.[0]?.url ? (
                          <img
                            src={spotifyStatus.userProfile.images[0].url}
                            alt="Profile"
                            className="w-8 h-8 rounded-full border border-emerald-500 object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                            {spotifyStatus?.userProfile?.display_name?.[0] || 'S'}
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {spotifyStatus?.userProfile?.display_name || 'Conta Spotify Conectada'}
                          </span>
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> API do Spotify Vinculada e Ativa
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDisconnectSpotify}
                        className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition-colors"
                      >
                        Desconectar
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 space-y-2.5">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Sua conta do Spotify ainda não está vinculada. Ao conectar sua conta do Spotify aqui, qualquer pessoa com o link da corrida poderá selecionar faixas, avançar músicas e alterar o estilo musical do som do carro sem precisar se logar.
                      </p>

                      {spotifyError && (
                        <div className="bg-rose-950/80 border border-rose-800/80 p-2.5 rounded-lg text-rose-200 text-xs leading-relaxed">
                          <strong className="block text-rose-400 font-bold mb-0.5">⚠️ Erro na Conexão:</strong>
                          {spotifyError}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleConnectSpotify}
                        disabled={isConnectingSpotify}
                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
                      >
                        <Disc className="w-4 h-4" />
                        {isConnectingSpotify ? 'Conectando ao Spotify...' : 'Conectar Conta do Spotify do Motorista'}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    <span>Acesso liberado aos passageiros no link</span>
                    <span className="text-emerald-400 font-semibold">Sem necessidade de login para o passageiro</span>
                  </div>
                </div>

                {/* Mercado Pago API Integration Panel */}
                <div className="bg-slate-900/90 p-4 rounded-2xl border border-sky-500/30 space-y-3 mt-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                        <Zap className="w-5 h-5 fill-current" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-white flex items-center gap-2">
                          Integração API Mercado Pago (Pix & Webhook)
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Cobrança Pix oficial e notificação automática em tempo real
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                        mpStatus?.hasAccessToken
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {mpStatus?.hasAccessToken ? '🟢 API Oficial Ativa' : '🟡 Modo Demo'}
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 space-y-2.5 text-xs text-slate-300">
                    <p className="leading-relaxed">
                      {mpStatus?.hasAccessToken
                        ? 'Sua conta do Mercado Pago está configurada e recebendo cobranças Pix oficiais diretamente.'
                        : 'Para ativar o recebimento direto na sua conta do Mercado Pago, insira suas credenciais (MERCADO_PAGO_ACCESS_TOKEN) nas variáveis de ambiente do seu projeto.'}
                    </p>

                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] space-y-1">
                      <div className="text-slate-400 font-sans font-bold text-[10px] uppercase tracking-wider">
                        Variáveis de Ambiente Recomendadas:
                      </div>
                      <div className="text-sky-300">MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-..."</div>
                      <div className="text-slate-400">MERCADO_PAGO_PUBLIC_KEY = "APP_USR-..." (opcional)</div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap sm:flex-nowrap">
                      <div className="text-[10px] text-slate-400 truncate">
                        Webhook: <code className="text-sky-400 font-mono">/api/mercadopago/webhook</code>
                      </div>
                      {onOpenMercadoPagoModal && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenMercadoPagoModal();
                          }}
                          className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md shrink-0 cursor-pointer"
                        >
                          Ver Guia e Copiar URL do Webhook
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Driver Photo Section */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <label className="block font-extrabold text-slate-800 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Foto do Perfil do Motorista</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Fazer Upload ou usar URL
                  </span>
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                  <div className="relative shrink-0">
                    {profileForm.photoUrl ? (
                      <img
                        src={profileForm.photoUrl}
                        alt="Foto do motorista"
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-xs bg-slate-100"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-slate-400">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 text-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Carregar Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleDriverPhotoUpload}
                          className="hidden"
                        />
                      </label>

                      {profileForm.photoUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setProfileForm((prev) => ({ ...prev, photoUrl: '' }))
                          }
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl transition-colors flex items-center gap-1 text-xs border border-rose-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <input
                        type="url"
                        value={profileForm.photoUrl || ''}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, photoUrl: e.target.value })
                        }
                        placeholder="ou cole aqui o link (URL) da foto"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Caso o Google não forneça sua foto de perfil automaticamente, você pode fazer upload de um arquivo de imagem do seu aparelho ou colar a URL da foto.
                </p>
              </div>

              {/* Wi-Fi QR Code Section */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <label className="block font-extrabold text-slate-800 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-indigo-600" />
                    <span>QR Code do Wi-Fi (Acesso à Internet)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Fazer Upload ou usar URL
                  </span>
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                  <div className="relative shrink-0">
                    {profileForm.wifiQrCodeUrl ? (
                      <img
                        src={profileForm.wifiQrCodeUrl}
                        alt="QR Code do Wi-Fi"
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-xs bg-slate-100"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-slate-400">
                        <Wifi className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 text-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Carregar QR Wi-Fi</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleWifiQrCodeUpload}
                          className="hidden"
                        />
                      </label>

                      {profileForm.wifiQrCodeUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setProfileForm((prev) => ({ ...prev, wifiQrCodeUrl: '' }))
                          }
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl transition-colors flex items-center gap-1 text-xs border border-rose-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <input
                        type="url"
                        value={profileForm.wifiQrCodeUrl || ''}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, wifiQrCodeUrl: e.target.value })
                        }
                        placeholder="ou cole aqui o link (URL) do QR Code Wi-Fi"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Envie a imagem do QR Code do Wi-Fi do veículo. Na placa impressa, ele será exibido ao lado do QR Code da página com a legenda &quot;wi-fi para pagamentos&quot;.
                </p>
              </div>

              {/* Driver name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">
                      Nome Completo do Motorista
                    </label>
                    <button
                      type="button"
                      onClick={() => handleStartDictation('name')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                        isListeningName
                          ? 'bg-rose-600 text-white animate-pulse shadow-xs'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                      }`}
                      title="Ditar nome por voz com o microfone"
                    >
                      {isListeningName ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          <span>Ouvindo...</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ditar Nome</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, name: e.target.value })
                    }
                    placeholder="Digite ou dite o nome"
                    className={`w-full p-2.5 bg-slate-50 border rounded-xl font-medium text-slate-900 transition-colors ${
                      isListeningName
                        ? 'border-rose-500 ring-2 ring-rose-300/50 bg-rose-50/30'
                        : 'border-slate-200'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">
                      Nome Favorecido no Banco
                    </label>
                    <button
                      type="button"
                      onClick={() => handleStartDictation('receiverName')}
                      className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                        isListeningReceiver
                          ? 'bg-rose-600 text-white animate-pulse shadow-xs'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                      }`}
                      title="Ditar favorecido por voz com o microfone"
                    >
                      {isListeningReceiver ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          <span>Ouvindo...</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ditar</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={profileForm.receiverName}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        receiverName: e.target.value,
                      })
                    }
                    placeholder="Ex: CARLOS E SILVA"
                    className={`w-full p-2.5 bg-slate-50 border rounded-xl font-medium text-slate-900 transition-colors ${
                      isListeningReceiver
                        ? 'border-rose-500 ring-2 ring-rose-300/50 bg-rose-50/30'
                        : 'border-slate-200'
                    }`}
                  />
                </div>
              </div>

              {/* Vehicle & City */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Modelo do Veículo
                  </label>
                  <input
                    type="text"
                    value={profileForm.carModel}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        carModel: e.target.value,
                      })
                    }
                    placeholder="Ex: Onix, HB20, Nissan Kicks"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cor do Veículo
                  </label>
                  <input
                    type="text"
                    value={profileForm.carColor}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        carColor: e.target.value,
                      })
                    }
                    placeholder="Prata / Preto / Branco"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Placa do Veículo
                  </label>
                  <input
                    type="text"
                    value={profileForm.licensePlate}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        licensePlate: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="ABC-1234"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                  />
                </div>
              </div>

              {/* City and Google Photo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cidade Principal
                  </label>
                  <input
                    type="text"
                    value={profileForm.city}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, city: e.target.value })
                    }
                    placeholder="SÃO PAULO"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Foto de Perfil (Conta Google)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={profileForm.photoUrl}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          photoUrl: e.target.value,
                        })
                      }
                      placeholder="URL da foto Google..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Greeting Message */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mensagem de Boas-Vindas aos Passageiros (Opcional)
                </label>
                <input
                  type="text"
                  value={profileForm.greetingMessage || ''}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, greetingMessage: e.target.value })
                  }
                  placeholder="Ex: Seja bem-vindo! É um prazer atendê-lo durante a corrida."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                />
              </div>
            </div>
          ) : (
            /* Services & Products Editor Tab */
            <div className="space-y-4 text-xs">
              {/* Categorization Notice */}
              <div className="bg-sky-50 border border-sky-200 p-3 rounded-2xl text-sky-950 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5 text-sky-900">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>Regra de Categorização: Serviços vs Produtos</span>
                </div>
                <p className="text-[11px] leading-relaxed text-sky-800">
                  • 🛠️ <b>Serviços (Recursos do Veículo):</b> Itens que ativam/desativam funcionalidades (ex: Wi-Fi 5G, Som/Spotify, Carregador Turbo, Ar Condicionado).<br />
                  • 📦 <b>Produtos (Consumíveis):</b> Itens físicos entregues ao passageiro (ex: Água Gelada, Snacks, Refrigerante, Balas).
                </p>
              </div>

              {/* Category Filter Buttons */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setServiceFilterTab('todos')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      serviceFilterTab === 'todos'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    Todos ({servicesForm.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilterTab('servico')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      serviceFilterTab === 'servico'
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-sky-50 text-sky-800 border-sky-200'
                    }`}
                  >
                    🛠️ Serviços
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilterTab('produto')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      serviceFilterTab === 'produto'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    📦 Produtos
                  </button>
                </div>

                <span className="text-slate-500 font-semibold text-[11px]">
                  {servicesForm.length} cadastrados
                </span>
              </div>

              {/* List of services to edit */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {servicesForm
                  .filter((srv) => {
                    if (serviceFilterTab === 'todos') return true;
                    const type = srv.itemType || (srv.id === 'wifi' || srv.id === 'spotify_music' || srv.id === 'charger' ? 'servico' : 'produto');
                    return type === serviceFilterTab;
                  })
                  .map((srv) => {
                    const isActive = srv.isActive !== false;
                    const itemType = srv.itemType || (srv.id === 'wifi' || srv.id === 'spotify_music' || srv.id === 'charger' ? 'servico' : 'produto');
                    const isService = itemType === 'servico';
                    const isEditingThis = editingServiceId === srv.id;

                    if (isEditingThis) {
                      return (
                        <div key={srv.id} className="p-3 border-2 border-emerald-500 bg-white rounded-xl space-y-2 shadow-sm">
                          <div className="flex items-center justify-between font-bold text-emerald-800 text-xs">
                            <span>✏️ Editando: {srv.title}</span>
                            <button type="button" onClick={handleCancelEditService} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Título do Item</label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-xs text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Tipo de Categoria</label>
                              <select
                                value={editItemType}
                                onChange={(e) => setEditItemType(e.target.value as 'servico' | 'produto')}
                                className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-xs text-slate-800"
                              >
                                <option value="servico">🛠️ Categoria: Serviço</option>
                                <option value="produto">📦 Categoria: Produto</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Descrição Curta</label>
                            <input
                              type="text"
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Preço (R$)</label>
                              <input
                                type="text"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-xs text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Ícone</label>
                              <select
                                value={editIcon}
                                onChange={(e) => setEditIcon(e.target.value)}
                                className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-medium"
                              >
                                <option value="Fan">Ícone Ar/Vento</option>
                                <option value="MapPin">Ícone Parada</option>
                                <option value="Clock">Ícone Tempo</option>
                                <option value="Briefcase">Ícone Mala</option>
                                <option value="ShoppingBag">Ícone Bebida/Snack</option>
                                <option value="Zap">Ícone Celular</option>
                                <option value="Music">Ícone Música</option>
                                <option value="Coffee">Ícone Café/Snack</option>
                                <option value="Baby">Ícone Infantil</option>
                              </select>
                            </div>
                            <div className="flex items-end gap-1">
                              <button
                                type="button"
                                onClick={handleSaveEditedService}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" /> Salvar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={srv.id}
                        className={`p-3 border rounded-xl flex items-center justify-between gap-3 transition-colors ${
                          isActive
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-slate-100/70 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="font-bold text-slate-900 truncate">
                              {srv.title}
                            </div>

                            {/* Badge to toggle category type */}
                            <button
                              type="button"
                              onClick={() => handleToggleItemType(srv.id)}
                              className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider cursor-pointer transition-all ${
                                isService
                                  ? 'bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200'
                                  : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                              }`}
                              title="Clique para alternar entre Serviço e Produto"
                            >
                              {isService ? '🛠️ Serviço' : '📦 Produto'}
                            </button>

                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {isActive ? 'Ativo' : 'Oculto'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {srv.description}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Edit Item button */}
                          <button
                            type="button"
                            onClick={() => handleStartEditService(srv)}
                            className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar título, descrição, preço e ícone"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Toggle switch (chavinha) */}
                          <button
                            type="button"
                            onClick={() => handleToggleServiceActive(srv.id)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              isActive ? 'bg-emerald-600' : 'bg-slate-300'
                            }`}
                            title={
                              isActive
                                ? 'Ativo (clique para ocultar da página)'
                                : 'Oculto (clique para exibir na página)'
                            }
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                isActive ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>

                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                            <span className="text-slate-400 font-bold">R$</span>
                            <input
                              type="text"
                              value={srv.price}
                              onChange={(e) =>
                                handleUpdateServicePrice(srv.id, e.target.value)
                              }
                              className="w-12 font-bold text-slate-900 focus:outline-none text-right"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveService(srv.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remover este item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Add New Service/Product Box */}
              <div className="border-t border-slate-200 pt-3 bg-slate-50/80 p-3.5 rounded-2xl border">
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>Adicionar Novo Serviço ou Produto</span>
                </h4>

                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Título (ex: Parada em Fast Food / Refrigerante)"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="sm:col-span-2 p-2 bg-white border border-slate-200 rounded-lg font-medium"
                    />

                    {/* Category Selector dropdown */}
                    <select
                      value={newItemType}
                      onChange={(e) => setNewItemType(e.target.value as 'servico' | 'produto')}
                      className="p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                    >
                      <option value="servico">🛠️ Categoria: Serviço</option>
                      <option value="produto">📦 Categoria: Produto</option>
                    </select>
                  </div>

                  <input
                    type="text"
                    placeholder="Descrição curta para o passageiro"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-700"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Valor R$ (ex: 7.50)"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-900"
                    />

                    <select
                      value={newIcon}
                      onChange={(e) => setNewIcon(e.target.value)}
                      className="p-2 bg-white border border-slate-200 rounded-lg font-medium"
                    >
                      <option value="Fan">Ícone Ar/Vento</option>
                      <option value="MapPin">Ícone Parada</option>
                      <option value="Clock">Ícone Tempo</option>
                      <option value="Briefcase">Ícone Mala</option>
                      <option value="ShoppingBag">Ícone Bebida/Snack</option>
                      <option value="Zap">Ícone Celular</option>
                      <option value="Music">Ícone Música</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleAddService}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg px-3 py-2 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Action buttons */}
          <div className="border-t border-slate-200 pt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onResetDefaults}
              className="text-slate-500 hover:text-slate-800 text-xs font-semibold underline flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 text-xs transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all flex items-center gap-2 ${
                  savedSuccess ? 'bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Salvo com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-emerald-400" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
