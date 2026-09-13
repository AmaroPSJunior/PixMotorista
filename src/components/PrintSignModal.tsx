import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  X,
  Printer,
  QrCode,
  Mail,
  Car,
  ShieldCheck,
  Wifi,
  Music,
  Zap,
  CreditCard,
  Layout,
  Smartphone,
  Sparkles,
  Upload,
  Trash2,
  Move,
  Save,
  Check,
  FileText,
  Download,
  Sliders,
  Grid,
  Eye,
  EyeOff,
  Copy,
  Type,
  ZoomIn,
  RotateCcw,
  SmartphoneNfc,
} from 'lucide-react';
import { DriverProfile, AdditionalService, DraggableItemPosition } from '../types';
import { generatePixBRCodePayload } from '../utils/pixPayload';
import { getPublicPassengerUrl } from '../utils/urlHelper';
import { generateBrandedQrCode } from '../utils/qrCodeGenerator';

interface PrintSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: DriverProfile;
  services: AdditionalService[];
  onSaveDriver?: (updatedDriver: DriverProfile) => void;
}

export type PaperSizeType = 'a4_full' | 'a5_half' | 'a3_large' | 'letter_full' | 'seat_sign' | 'credit_card';
export type PaperOrientationType = 'portrait' | 'landscape';

const PAPER_CONFIGS: Record<PaperSizeType, { name: string; widthMm: number; heightMm: number; description: string }> = {
  a4_full: { name: 'Folha A4', widthMm: 210, heightMm: 297, description: '210 x 297 mm • Padrão A4' },
  a5_half: { name: 'Folha A5 (Metade)', widthMm: 148, heightMm: 210, description: '148 x 210 mm • Metade A4' },
  a3_large: { name: 'Folha A3 (Cartaz)', widthMm: 297, heightMm: 420, description: '297 x 420 mm • Poster Grande' },
  letter_full: { name: 'Folha Carta (Letter)', widthMm: 216, heightMm: 279, description: '216 x 279 mm • Formato Letter' },
  seat_sign: { name: 'Placa de Encosto A5', widthMm: 148, heightMm: 210, description: '148 x 210 mm • Para Banco' },
  credit_card: { name: 'Cartão de Visita', widthMm: 85.6, heightMm: 53.9, description: '85.6 x 53.9 mm • Formato Bolso' },
};

const DEFAULT_LABELS: Record<string, string> = {
  header_title: 'Motorista Particular',
  qr_pix: 'PAGAMENTO PIX',
  qr_wifi: 'WI-FI DO VEÍCULO',
  qr_spotify: 'MÚSICA SPOTIFY',
  qr_wifi_unlock: 'SENHA & REDE WI-FI',
  qr_charger_unlock: 'CARREGADOR CELULAR',
  qr_main_app: 'PAINEL DO PASSAGEIRO',
  footer_banner: 'Tenha uma excelente viagem!',
};

const DEFAULT_A4_LAYOUT: Record<string, DraggableItemPosition> = {
  header_title: { x: 3, y: 2 },
  qr_pix: { x: 3, y: 15 },
  qr_wifi: { x: 52, y: 15 },
  qr_spotify: { x: 3, y: 43 },
  qr_wifi_unlock: { x: 52, y: 43 },
  qr_charger_unlock: { x: 3, y: 71 },
  qr_main_app: { x: 52, y: 71 },
};

const DEFAULT_A5_LAYOUT: Record<string, DraggableItemPosition> = {
  header_title: { x: 3, y: 2 },
  qr_pix: { x: 3, y: 16 },
  qr_wifi: { x: 52, y: 16 },
  qr_spotify: { x: 3, y: 44 },
  qr_wifi_unlock: { x: 52, y: 44 },
  qr_charger_unlock: { x: 3, y: 72 },
  qr_main_app: { x: 52, y: 72 },
};

const DEFAULT_LANDSCAPE_LAYOUT: Record<string, DraggableItemPosition> = {
  header_title: { x: 3, y: 3 },
  qr_pix: { x: 3, y: 22 },
  qr_wifi: { x: 35, y: 22 },
  qr_spotify: { x: 67, y: 22 },
  qr_wifi_unlock: { x: 3, y: 60 },
  qr_charger_unlock: { x: 35, y: 60 },
  qr_main_app: { x: 67, y: 60 },
};

const DEFAULT_CARD_LAYOUT: Record<string, DraggableItemPosition> = {
  header_title: { x: 3, y: 3 },
  qr_wifi: { x: 3, y: 24 },
  qr_pix: { x: 52, y: 24 },
  footer_banner: { x: 3, y: 82 },
};

export const PrintSignModal: React.FC<PrintSignModalProps> = ({
  isOpen,
  onClose,
  driver,
  services,
  onSaveDriver,
}) => {
  const [paperSize, setPaperSize] = useState<PaperSizeType>(
    (driver.printPaperSize as PaperSizeType) || 'a4_full'
  );
  const [paperOrientation, setPaperOrientation] = useState<PaperOrientationType>(
    (driver.printPaperOrientation as PaperOrientationType) || 'portrait'
  );
  const [elementScale, setElementScale] = useState<number>(driver.printElementScale || 1.0);
  const [cardSpacing, setCardSpacing] = useState<number>(driver.printCardSpacing || 12);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(() => ({
    ...DEFAULT_LABELS,
    ...(driver.printCustomLabels || {}),
  }));

  const [showControls, setShowControls] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'paper' | 'size_spacing' | 'labels' | 'actions'>('paper');

  // QR Code Data URLs
  const [wifiQrCodeDataUrl, setWifiQrCodeDataUrl] = useState<string>('');
  const [pixQrCodeDataUrl, setPixQrCodeDataUrl] = useState<string>('');
  const [spotifyQrCodeDataUrl, setSpotifyQrCodeDataUrl] = useState<string>('');
  const [wifiUnlockQrCodeDataUrl, setWifiUnlockQrCodeDataUrl] = useState<string>('');
  const [chargerUnlockQrCodeDataUrl, setChargerUnlockQrCodeDataUrl] = useState<string>('');
  const [mainAppQrCodeDataUrl, setMainAppQrCodeDataUrl] = useState<string>('');

  const [copiedPublicUrl, setCopiedPublicUrl] = useState<boolean>(false);

  // Draggable Positions
  const [layoutPositions, setLayoutPositions] = useState<Record<string, DraggableItemPosition>>(() => {
    return driver.printSheetLayout || DEFAULT_A4_LAYOUT;
  });

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isSavedToast, setIsSavedToast] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const publicPassengerUrl = getPublicPassengerUrl(driver.customPublicUrl);

  // Sync state with driver prop updates
  useEffect(() => {
    if (driver.printSheetLayout && Object.keys(driver.printSheetLayout).length > 0) {
      setLayoutPositions(driver.printSheetLayout);
    }
    if (driver.printPaperSize) {
      setPaperSize(driver.printPaperSize as PaperSizeType);
    }
    if (driver.printPaperOrientation) {
      setPaperOrientation(driver.printPaperOrientation as PaperOrientationType);
    }
    if (driver.printElementScale) {
      setElementScale(driver.printElementScale);
    }
    if (driver.printCardSpacing) {
      setCardSpacing(driver.printCardSpacing);
    }
    if (driver.printCustomLabels) {
      setCustomLabels((prev) => ({ ...prev, ...driver.printCustomLabels }));
    }
  }, [driver]);

  useEffect(() => {
    if (!isOpen) return;

    if (driver.wifiQrCodeUrl) {
      setWifiQrCodeDataUrl(driver.wifiQrCodeUrl);
    } else {
      setWifiQrCodeDataUrl('');
    }
  }, [isOpen, driver.wifiQrCodeUrl]);

  // Generate QR codes for all destinations
  useEffect(() => {
    if (!isOpen) return;

    const publicUrl = getPublicPassengerUrl(driver.customPublicUrl, driver.googleEmail);
    const appendAction = (url: string, action: string) =>
      url.includes('?') ? `${url}&action=${action}` : `${url}?action=${action}`;

    // Exclude email key from printouts - preference non-email random/CPF/phone key
    const printPixKey = (driver.randomPixKey && driver.randomPixKey.trim())
      ? driver.randomPixKey
      : (driver.pixKey && !driver.pixKey.includes('@') ? driver.pixKey : '');

    const pixPayload = generatePixBRCodePayload({
      pixKey: printPixKey || '',
      receiverName: driver.receiverName || driver.name,
      city: driver.city || 'SAO PAULO',
    });

    generateBrandedQrCode(pixPayload, 'pix')
      .then(setPixQrCodeDataUrl)
      .catch(console.error);

    generateBrandedQrCode(appendAction(publicUrl, 'unlock_spotify'), 'spotify')
      .then(setSpotifyQrCodeDataUrl)
      .catch(console.error);

    generateBrandedQrCode(appendAction(publicUrl, 'unlock_wifi'), 'wifi')
      .then(setWifiUnlockQrCodeDataUrl)
      .catch(console.error);

    generateBrandedQrCode(appendAction(publicUrl, 'unlock_charger'), 'charger')
      .then(setChargerUnlockQrCodeDataUrl)
      .catch(console.error);

    generateBrandedQrCode(publicUrl, 'main_app')
      .then(setMainAppQrCodeDataUrl)
      .catch(console.error);
  }, [isOpen, driver]);

  // Custom Wifi Image Upload
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
        const newUrl = reader.result;
        setWifiQrCodeDataUrl(newUrl);
        if (onSaveDriver) {
          onSaveDriver({
            ...driver,
            wifiQrCodeUrl: newUrl,
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Drag mechanics for cards
  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDragId(id);
    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDragId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = ((e.clientX - rect.left) / rect.width) * 100;
    const relativeY = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp coordinates to stay within sheet canvas
    const maxClampedX = paperOrientation === 'landscape' ? 70 : 60;
    const clampedX = Math.max(0, Math.min(maxClampedX, relativeX));
    const clampedY = Math.max(0, Math.min(88, relativeY));

    setLayoutPositions((prev) => ({
      ...prev,
      [activeDragId]: {
        x: Math.round(clampedX * 10) / 10,
        y: Math.round(clampedY * 10) / 10,
      },
    }));
  };

  const handlePointerUp = () => {
    if (!activeDragId) return;
    setActiveDragId(null);
    saveAllSettingsToDriver();
  };

  const saveAllSettingsToDriver = () => {
    if (onSaveDriver) {
      onSaveDriver({
        ...driver,
        printSheetLayout: layoutPositions,
        printPaperSize: paperSize,
        printPaperOrientation: paperOrientation,
        printElementScale: elementScale,
        printCardSpacing: cardSpacing,
        printCustomLabels: customLabels,
      });
    }
  };

  const handleManualSave = () => {
    saveAllSettingsToDriver();
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2500);
  };

  const handleAutoOrganizeGrid = () => {
    let gridLayout = DEFAULT_A4_LAYOUT;

    if (paperOrientation === 'landscape') {
      gridLayout = DEFAULT_LANDSCAPE_LAYOUT;
    } else if (paperSize === 'a5_half' || paperSize === 'seat_sign') {
      gridLayout = DEFAULT_A5_LAYOUT;
    } else if (paperSize === 'credit_card') {
      gridLayout = DEFAULT_CARD_LAYOUT;
    }

    setLayoutPositions(gridLayout);

    if (onSaveDriver) {
      onSaveDriver({
        ...driver,
        printSheetLayout: gridLayout,
        printPaperSize: paperSize,
        printPaperOrientation: paperOrientation,
        printElementScale: elementScale,
        printCardSpacing: cardSpacing,
        printCustomLabels: customLabels,
      });
    }
  };

  const handlePaperSizeChange = (newSize: PaperSizeType) => {
    setPaperSize(newSize);
    let defaultScale = 1.0;
    if (newSize === 'a5_half' || newSize === 'seat_sign') defaultScale = 0.85;
    if (newSize === 'credit_card') defaultScale = 0.75;
    if (newSize === 'a3_large') defaultScale = 1.3;

    setElementScale(defaultScale);

    let defaultGrid = DEFAULT_A4_LAYOUT;
    if (paperOrientation === 'landscape') {
      defaultGrid = DEFAULT_LANDSCAPE_LAYOUT;
    } else if (newSize === 'a5_half' || newSize === 'seat_sign') {
      defaultGrid = DEFAULT_A5_LAYOUT;
    } else if (newSize === 'credit_card') {
      defaultGrid = DEFAULT_CARD_LAYOUT;
    }

    setLayoutPositions(defaultGrid);

    if (onSaveDriver) {
      onSaveDriver({
        ...driver,
        printSheetLayout: defaultGrid,
        printPaperSize: newSize,
        printPaperOrientation: paperOrientation,
        printElementScale: defaultScale,
        printCardSpacing: cardSpacing,
        printCustomLabels: customLabels,
      });
    }
  };

  const handleOrientationChange = (newOrientation: PaperOrientationType) => {
    setPaperOrientation(newOrientation);

    let defaultGrid = DEFAULT_A4_LAYOUT;
    if (newOrientation === 'landscape') {
      defaultGrid = DEFAULT_LANDSCAPE_LAYOUT;
    } else if (paperSize === 'a5_half' || paperSize === 'seat_sign') {
      defaultGrid = DEFAULT_A5_LAYOUT;
    } else if (paperSize === 'credit_card') {
      defaultGrid = DEFAULT_CARD_LAYOUT;
    }

    setLayoutPositions(defaultGrid);

    if (onSaveDriver) {
      onSaveDriver({
        ...driver,
        printSheetLayout: defaultGrid,
        printPaperSize: paperSize,
        printPaperOrientation: newOrientation,
        printElementScale: elementScale,
        printCardSpacing: cardSpacing,
        printCustomLabels: customLabels,
      });
    }
  };

  const handleLabelChange = (id: string, text: string) => {
    const updated = { ...customLabels, [id]: text };
    setCustomLabels(updated);
  };

  const handleDownloadPdf = async () => {
    if (!containerRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(containerRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const conf = PAPER_CONFIGS[paperSize];
      
      const pdf = new jsPDF({
        orientation: paperOrientation,
        unit: 'mm',
        format: paperSize === 'credit_card' ? [85.6, 53.9] : (paperSize === 'a3_large' ? 'a3' : (paperSize === 'a5_half' || paperSize === 'seat_sign' ? 'a5' : 'a4')),
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Impressao_${conf.name.replace(/\s+/g, '_')}_${paperOrientation}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Ocorreu um erro ao gerar o PDF. Tente usar a opção Imprimir do navegador.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const paperConf = PAPER_CONFIGS[paperSize];

  // Dynamic aspect ratio & max width for container based on orientation
  const getAspectClass = () => {
    if (paperSize === 'credit_card') {
      return paperOrientation === 'landscape' ? 'aspect-[1.58/1] max-w-md' : 'aspect-[1/1.58] max-w-xs';
    }
    if (paperSize === 'letter_full') {
      return paperOrientation === 'landscape' ? 'aspect-[1.294/1] max-w-3xl' : 'aspect-[1/1.294] max-w-2xl';
    }
    if (paperSize === 'a3_large') {
      return paperOrientation === 'landscape' ? 'aspect-[1.414/1] max-w-4xl' : 'aspect-[1/1.414] max-w-3xl';
    }
    if (paperSize === 'a5_half' || paperSize === 'seat_sign') {
      return paperOrientation === 'landscape' ? 'aspect-[1.414/1] max-w-xl' : 'aspect-[1/1.414] max-w-md';
    }
    // A4 Default
    return paperOrientation === 'landscape' ? 'aspect-[1.414/1] max-w-3xl' : 'aspect-[1/1.414] max-w-2xl';
  };

  const cardWidthClass = paperOrientation === 'landscape' ? '30%' : '45%';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col w-screen h-screen overflow-hidden select-none animate-fadeIn print:p-0 print:static print:bg-white print:block">
      
      {/* Dynamic CSS Print Media Style for Orientation */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize === 'credit_card' ? '85.6mm 53.9mm' : paperSize === 'a3_large' ? 'A3' : paperSize === 'a5_half' || paperSize === 'seat_sign' ? 'A5' : 'A4'} ${paperOrientation};
            margin: 0;
          }
        }
      `}</style>

      {/* ========================================================= */}
      {/* FLOATING TOP STUDIO NAVBAR (Hidden on Print) */}
      {/* ========================================================= */}
      {showControls && (
        <div className="absolute top-2 sm:top-3 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-2xl rounded-2xl p-2 sm:px-4 sm:py-2 flex items-center justify-between gap-2 max-w-5xl text-white print:hidden">
          
          {/* Header Title & Paper Badge */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div className="hidden md:block">
              <div className="font-extrabold text-xs text-white flex items-center gap-1.5">
                <span>Estúdio de Impressão</span>
                <span className="text-[10px] bg-indigo-900/80 text-indigo-300 font-bold px-1.5 py-0.5 rounded border border-indigo-700/50 uppercase">
                  {paperOrientation === 'landscape' ? 'Horizontal' : 'Vertical'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                {paperOrientation === 'landscape' ? `${paperConf.heightMm} x ${paperConf.widthMm} mm` : `${paperConf.widthMm} x ${paperConf.heightMm} mm`}
              </div>
            </div>
          </div>

          {/* Quick Tab Selector Pills */}
          <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800/90 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('paper')}
              className={`py-1 px-2.5 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 shrink-0 ${
                activeTab === 'paper' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Folha & Orientação</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('size_spacing')}
              className={`py-1 px-2.5 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 shrink-0 ${
                activeTab === 'size_spacing' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Escala & Espaço</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('labels')}
              className={`py-1 px-2.5 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 shrink-0 ${
                activeTab === 'labels' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Legendas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('actions')}
              className={`py-1 px-2.5 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 shrink-0 ${
                activeTab === 'actions' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Ações</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Clean View Toggle Button */}
            <button
              type="button"
              onClick={() => setShowControls(false)}
              className="p-1.5 sm:p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-all"
              title="Modo Visão Limpa (Ocultar painéis)"
            >
              <EyeOff className="w-4 h-4 text-emerald-400" />
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Baixar PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 transition-all shadow-md active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Re-open controls button when controls are hidden */}
      {!showControls && (
        <button
          type="button"
          onClick={() => setShowControls(true)}
          className="fixed top-3 right-3 z-50 bg-slate-900/90 text-emerald-400 border border-emerald-500/50 shadow-2xl px-3 py-2 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-slate-800 transition-all print:hidden"
        >
          <Eye className="w-4 h-4" />
          <span>Painel do Estúdio</span>
        </button>
      )}

      {/* ========================================================= */}
      {/* FLOATING BOTTOM CONTROL DRAWER (Interactive Studio Controls) */}
      {/* ========================================================= */}
      {showControls && (
        <div className="absolute bottom-2 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-2xl rounded-2xl p-3 sm:px-4 sm:py-3 flex flex-col gap-3 max-w-4xl text-white print:hidden">
          
          {/* TAB 1: PAPER SELECTION & ORIENTATION TOGGLE */}
          {activeTab === 'paper' && (
            <div className="flex flex-col gap-2.5">
              
              {/* Orientation Switcher Row */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Orientação da Folha:
                </span>

                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleOrientationChange('portrait')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      paperOrientation === 'portrait'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Vertical (Retrato)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOrientationChange('landscape')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      paperOrientation === 'landscape'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layout className="w-3.5 h-3.5 rotate-90" />
                    <span>Horizontal (Paisagem)</span>
                  </button>
                </div>
              </div>

              {/* Paper Format Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
                {(Object.keys(PAPER_CONFIGS) as PaperSizeType[]).map((key) => {
                  const item = PAPER_CONFIGS[key];
                  const isSelected = paperSize === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePaperSizeChange(key)}
                      className={`p-2 rounded-xl text-left border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="font-extrabold text-xs truncate">{item.name}</div>
                      <div className="text-[9px] opacity-75 truncate">
                        {paperOrientation === 'landscape' ? `${item.heightMm}x${item.widthMm}mm` : `${item.widthMm}x${item.heightMm}mm`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SIZE & SPACING ADJUSTERS */}
          {activeTab === 'size_spacing' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Element Scale Adjuster */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Tamanho dos Cards ({Math.round(elementScale * 100)}%):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setElementScale(1.0)}
                    className="text-[10px] text-indigo-400 hover:underline"
                  >
                    Resetar (100%)
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-bold">Pequeno</span>
                  <input
                    type="range"
                    min="0.6"
                    max="1.5"
                    step="0.05"
                    value={elementScale}
                    onChange={(e) => setElementScale(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 font-bold">Grande</span>
                </div>
              </div>

              {/* Card Spacing Adjuster */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Espaçamento ({cardSpacing}px):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCardSpacing(12)}
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Resetar (12px)
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-bold">Junto</span>
                  <input
                    type="range"
                    min="4"
                    max="36"
                    step="2"
                    value={cardSpacing}
                    onChange={(e) => setCardSpacing(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 font-bold">Afastado</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM LABELS EDITING */}
          {activeTab === 'labels' && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                Edite os Textos e Legendas Exibidos na Impressão:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-950 rounded-xl border border-slate-800 scrollbar-thin">
                {Object.keys(DEFAULT_LABELS).map((id) => (
                  <div key={id} className="flex flex-col gap-0.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase truncate">
                      {id.replace('qr_', '').replace('_', ' ')}
                    </label>
                    <input
                      type="text"
                      value={customLabels[id] || ''}
                      onChange={(e) => handleLabelChange(id, e.target.value)}
                      className="bg-slate-900 text-white font-bold text-xs p-1.5 rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: LAYOUT ACTIONS & DB SAVING */}
          {activeTab === 'actions' && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoOrganizeGrid}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
                >
                  <Grid className="w-4 h-4 text-emerald-400" />
                  <span>Organizar em Grade ({paperOrientation === 'landscape' ? '3 Colunas' : '2 Colunas'})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const defaultGrid = paperOrientation === 'landscape' ? DEFAULT_LANDSCAPE_LAYOUT : DEFAULT_A4_LAYOUT;
                    setLayoutPositions(defaultGrid);
                    setCustomLabels(DEFAULT_LABELS);
                    setElementScale(1.0);
                    setCardSpacing(12);
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-4 h-4 text-slate-400" />
                  <span>Restaurar Padrão</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualSave}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  {isSavedToast ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Salvo no Banco de Dados!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar Posições no Banco</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* STUDIO CANVAS (Interactive Print Sheet Workspace 100% Screen) */}
      {/* ========================================================= */}
      <div className="w-full h-full flex-1 overflow-auto p-2 sm:p-6 pt-16 sm:pt-20 pb-28 sm:pb-32 flex items-center justify-center bg-slate-950 print:p-0 print:m-0 print:bg-white print:overflow-visible">
        
        {/* Printable Sheet Box */}
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative w-full ${getAspectClass()} bg-white border-4 border-slate-900 rounded-3xl p-3 sm:p-4 shadow-2xl overflow-hidden touch-none select-none print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0 print:aspect-auto`}
          style={{ padding: `${cardSpacing}px` }}
        >
          {/* Print margin guide border line */}
          <div className="absolute inset-2 border border-dashed border-slate-300 rounded-2xl pointer-events-none print:border-slate-200" />

          {/* 1. HEADER BANNER */}
          <div
            key="header_title"
            style={{
              position: 'absolute',
              left: `${layoutPositions.header_title?.x ?? 3}%`,
              top: `${layoutPositions.header_title?.y ?? 2}%`,
              width: '94%',
              transform: `scale(${elementScale})`,
              transformOrigin: 'top left',
            }}
            onPointerDown={(e) => handlePointerDown('header_title', e)}
            className={`bg-slate-900 text-white p-2.5 sm:p-3 rounded-2xl border-2 border-slate-800 shadow-md cursor-grab active:cursor-grabbing transition-shadow z-10 ${
              activeDragId === 'header_title' ? 'ring-4 ring-emerald-500 shadow-2xl z-30 scale-[1.01]' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {driver.photoUrl ? (
                  <img src={driver.photoUrl} alt={driver.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-emerald-400 shrink-0" />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 border border-emerald-500 shrink-0">
                    <Car className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-black text-xs sm:text-sm text-white leading-tight truncate">
                    {driver.name || customLabels.header_title}
                  </h2>
                  <p className="text-[9px] sm:text-[10px] text-slate-300 font-medium truncate">
                    {driver.carModel} {driver.carColor ? `(${driver.carColor})` : ''} {driver.licensePlate ? `• ${driver.licensePlate}` : ''}
                  </p>
                </div>
              </div>
              <span className="text-[8px] sm:text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-xl flex items-center gap-1 shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                <span>A Bordo</span>
              </span>
            </div>
          </div>

          {/* 2. QR CODE PIX */}
          <div
            key="qr_pix"
            style={{
              position: 'absolute',
              left: `${layoutPositions.qr_pix?.x ?? 3}%`,
              top: `${layoutPositions.qr_pix?.y ?? 15}%`,
              width: cardWidthClass,
              transform: `scale(${elementScale})`,
              transformOrigin: 'top left',
            }}
            onPointerDown={(e) => handlePointerDown('qr_pix', e)}
            className={`bg-white border-2 border-emerald-500/80 rounded-2xl p-2 shadow-sm flex flex-col items-center text-center cursor-grab active:cursor-grabbing z-10 transition-shadow ${
              activeDragId === 'qr_pix' ? 'ring-4 ring-emerald-500 z-30 scale-[1.02]' : ''
            }`}
          >
            <div className="w-full flex items-center justify-between border-b border-emerald-100 pb-0.5 mb-1">
              <span className="text-emerald-800 font-black text-[10px] uppercase flex items-center gap-1 truncate">
                <QrCode className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">{customLabels.qr_pix || 'PAGAMENTO PIX'}</span>
              </span>
              <Move className="w-3 h-3 text-slate-400 print:hidden shrink-0" />
            </div>
            {pixQrCodeDataUrl ? (
              <img src={pixQrCodeDataUrl} alt="QR Code Pix" className="w-16 h-16 sm:w-24 sm:h-24 max-w-full aspect-square object-contain rounded-lg border border-slate-200 p-0.5 bg-white" />
            ) : (
              <div className="w-16 h-16 sm:w-24 sm:h-24 bg-slate-100 rounded-lg animate-pulse" />
            )}
            <span className="mt-1 text-[9px] sm:text-[10px] font-black text-slate-900 truncate w-full">
              Pague sua Corrida
            </span>
            {driver.randomPixKey && !driver.randomPixKey.includes('@') ? (
              <span className="text-[8px] text-slate-500 font-mono truncate w-full">{driver.randomPixKey}</span>
            ) : driver.pixKey && !driver.pixKey.includes('@') ? (
              <span className="text-[8px] text-slate-500 font-mono truncate w-full">{driver.pixKey}</span>
            ) : null}
          </div>

          {/* 3. QR CODE WI-FI */}
          <div
            key="qr_wifi"
            style={{
              position: 'absolute',
              left: `${layoutPositions.qr_wifi?.x ?? (paperOrientation === 'landscape' ? 35 : 52)}%`,
              top: `${layoutPositions.qr_wifi?.y ?? 15}%`,
              width: cardWidthClass,
              transform: `scale(${elementScale})`,
              transformOrigin: 'top left',
            }}
            onPointerDown={(e) => handlePointerDown('qr_wifi', e)}
            className={`bg-white border-2 border-indigo-500/80 rounded-2xl p-2 shadow-sm flex flex-col items-center text-center cursor-grab active:cursor-grabbing z-10 transition-shadow ${
              activeDragId === 'qr_wifi' ? 'ring-4 ring-indigo-500 z-30 scale-[1.02]' : ''
            }`}
          >
            <div className="w-full flex items-center justify-between border-b border-indigo-100 pb-0.5 mb-1">
              <span className="text-indigo-800 font-black text-[10px] uppercase flex items-center gap-1 truncate">
                <Wifi className="w-3 h-3 text-indigo-600 shrink-0" />
                <span className="truncate">{customLabels.qr_wifi || 'WI-FI VEÍCULO'}</span>
              </span>
              <Move className="w-3 h-3 text-slate-400 print:hidden shrink-0" />
            </div>
            {wifiQrCodeDataUrl || wifiUnlockQrCodeDataUrl ? (
              <img src={wifiQrCodeDataUrl || wifiUnlockQrCodeDataUrl} alt="QR Code Wi-Fi" className="w-16 h-16 sm:w-24 sm:h-24 max-w-full aspect-square object-contain rounded-lg border border-slate-200 p-0.5 bg-white" />
            ) : (
              <label className="w-16 h-16 sm:w-24 sm:h-24 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50 cursor-pointer p-1">
                <Upload className="w-4 h-4 text-indigo-600 mb-0.5" />
                <span className="text-[8px] font-bold text-indigo-900">QR Wi-Fi</span>
                <input type="file" accept="image/*" onChange={handleWifiQrCodeUpload} className="hidden" />
              </label>
            )}
            <span className="mt-1 text-[9px] sm:text-[10px] font-black text-slate-900 truncate w-full">
              Conectar Internet
            </span>
          </div>

          {/* Additional Multi QR Code Cards for Full Paper Sheets */}
          {paperSize !== 'credit_card' && (
            <>
              {/* 4. QR CODE SPOTIFY */}
              <div
                key="qr_spotify"
                style={{
                  position: 'absolute',
                  left: `${layoutPositions.qr_spotify?.x ?? (paperOrientation === 'landscape' ? 67 : 3)}%`,
                  top: `${layoutPositions.qr_spotify?.y ?? (paperOrientation === 'landscape' ? 22 : 43)}%`,
                  width: cardWidthClass,
                  transform: `scale(${elementScale})`,
                  transformOrigin: 'top left',
                }}
                onPointerDown={(e) => handlePointerDown('qr_spotify', e)}
                className={`bg-white border-2 border-emerald-500/80 rounded-2xl p-2 shadow-sm flex flex-col items-center text-center cursor-grab active:cursor-grabbing z-10 transition-shadow ${
                  activeDragId === 'qr_spotify' ? 'ring-4 ring-emerald-500 z-30 scale-[1.02]' : ''
                }`}
              >
                <div className="w-full flex items-center justify-between border-b border-emerald-100 pb-0.5 mb-1">
                  <span className="text-emerald-800 font-black text-[10px] uppercase flex items-center gap-1 truncate">
                    <Music className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">{customLabels.qr_spotify || 'MÚSICA SPOTIFY'}</span>
                  </span>
                  <Move className="w-3 h-3 text-slate-400 print:hidden shrink-0" />
                </div>
                {spotifyQrCodeDataUrl ? (
                  <img src={spotifyQrCodeDataUrl} alt="QR Code Spotify" className="w-16 h-16 sm:w-24 sm:h-24 max-w-full aspect-square object-contain rounded-lg border border-slate-200 p-0.5 bg-white" />
                ) : (
                  <div className="w-16 h-16 sm:w-24 sm:h-24 bg-slate-100 rounded-lg animate-pulse" />
                )}
                <span className="mt-1 text-[9px] sm:text-[10px] font-black text-slate-900 truncate w-full">
                  Som do Carro
                </span>
              </div>

              {/* 5. QR CODE WI-FI DATA */}
              <div
                key="qr_wifi_unlock"
                style={{
                  position: 'absolute',
                  left: `${layoutPositions.qr_wifi_unlock?.x ?? (paperOrientation === 'landscape' ? 3 : 52)}%`,
                  top: `${layoutPositions.qr_wifi_unlock?.y ?? (paperOrientation === 'landscape' ? 60 : 43)}%`,
                  width: cardWidthClass,
                  transform: `scale(${elementScale})`,
                  transformOrigin: 'top left',
                }}
                onPointerDown={(e) => handlePointerDown('qr_wifi_unlock', e)}
                className={`bg-white border-2 border-cyan-500/80 rounded-2xl p-2 shadow-sm flex flex-col items-center text-center cursor-grab active:cursor-grabbing z-10 transition-shadow ${
                  activeDragId === 'qr_wifi_unlock' ? 'ring-4 ring-cyan-500 z-30 scale-[1.02]' : ''
                }`}
              >
                <div className="w-full flex items-center justify-between border-b border-cyan-100 pb-0.5 mb-1">
                  <span className="text-cyan-800 font-black text-[10px] uppercase flex items-center gap-1 truncate">
                    <Wifi className="w-3 h-3 text-cyan-600 shrink-0" />
                    <span className="truncate">{customLabels.qr_wifi_unlock || 'SENHA WI-FI'}</span>
                  </span>
                  <Move className="w-3 h-3 text-slate-400 print:hidden shrink-0" />
                </div>
                {wifiUnlockQrCodeDataUrl ? (
                  <img src={wifiUnlockQrCodeDataUrl} alt="QR Code Ativação Wi-Fi" className="w-16 h-16 sm:w-24 sm:h-24 max-w-full aspect-square object-contain rounded-lg border border-slate-200 p-0.5 bg-white" />
                ) : (
                  <div className="w-16 h-16 sm:w-24 sm:h-24 bg-slate-100 rounded-lg animate-pulse" />
                )}
                <span className="mt-1 text-[9px] sm:text-[10px] font-black text-slate-900 truncate w-full">
                  Senha & Rede
                </span>
              </div>

              {/* 6. QR CODE CARREGADOR */}
              <div
                key="qr_charger_unlock"
                style={{
                  position: 'absolute',
                  left: `${layoutPositions.qr_charger_unlock?.x ?? (paperOrientation === 'landscape' ? 35 : 3)}%`,
                  top: `${layoutPositions.qr_charger_unlock?.y ?? (paperOrientation === 'landscape' ? 60 : 71)}%`,
                  width: cardWidthClass,
                  transform: `scale(${elementScale})`,
                  transformOrigin: 'top left',
                }}
                onPointerDown={(e) => handlePointerDown('qr_charger_unlock', e)}
                className={`bg-white border-2 border-amber-500/80 rounded-2xl p-2 shadow-sm flex flex-col items-center text-center cursor-grab active:cursor-grabbing z-10 transition-shadow ${
                  activeDragId === 'qr_charger_unlock' ? 'ring-4 ring-amber-500 z-30 scale-[1.02]' : ''
                }`}
              >
                <div className="w-full flex items-center justify-between border-b border-amber-100 pb-0.5 mb-1">
                  <span className="text-amber-800 font-black text-[10px] uppercase flex items-center gap-1 truncate">
                    <Zap className="w-3 h-3 text-amber-600 shrink-0" />
                    <span className="truncate">{customLabels.qr_charger_unlock || 'CARREGADOR'}</span>
                  </span>
                  <Move className="w-3 h-3 text-slate-400 print:hidden shrink-0" />
                </div>
                {chargerUnlockQrCodeDataUrl ? (
                  <img src={chargerUnlockQrCodeDataUrl} alt="QR Code Carregador" className="w-16 h-16 sm:w-24 sm:h-24 max-w-full aspect-square object-contain rounded-lg border border-slate-200 p-0.5 bg-white" />
                ) : (
                  <div className="w-16 h-16 sm:w-24 sm:h-24 bg-slate-100 rounded-lg animate-pulse" />
                )}
                <span className="mt-1 text-[9px] sm:text-[10px] font-black text-slate-900 truncate w-full">
                  Cabo USB / iPhone
                </span>
              </div>

              {/* 7. QR CODE PAINEL PRINCIPAL */}
              <div
                key="qr_main_app"
                style={{
                  position: 'absolute',
                  left: `${layoutPositions.qr_main_app?.x ?? (paperOrientation === 'landscape' ? 67 : 52)}%`,
                  top: `${layoutPositions.qr_main_app?.y ?? (paperOrientation === 'landscape' ? 60 : 71)}%`,
                  width: cardWidthClass,
                  transform: `scale(${elementScale})`,
                  transformOrigin: 'top left',
                }}
                onPointerDown={(e) => handlePointerDown('qr_main_app', e)}
                className={`bg-white border-2 border-indigo-500/80 rounded-2xl p-2 shadow-sm flex flex-col items-center text-center cursor-grab active:cursor-grabbing z-10 transition-shadow ${
                  activeDragId === 'qr_main_app' ? 'ring-4 ring-indigo-500 z-30 scale-[1.02]' : ''
                }`}
              >
                <div className="w-full flex items-center justify-between border-b border-indigo-100 pb-0.5 mb-1">
                  <span className="text-indigo-800 font-black text-[10px] uppercase flex items-center gap-1 truncate">
                    <Smartphone className="w-3 h-3 text-indigo-600 shrink-0" />
                    <span className="truncate">{customLabels.qr_main_app || 'PAINEL COMPLETO'}</span>
                  </span>
                  <Move className="w-3 h-3 text-slate-400 print:hidden shrink-0" />
                </div>
                {mainAppQrCodeDataUrl ? (
                  <img src={mainAppQrCodeDataUrl} alt="QR Code Painel Principal" className="w-16 h-16 sm:w-24 sm:h-24 max-w-full aspect-square object-contain rounded-lg border border-slate-200 p-0.5 bg-white" />
                ) : (
                  <div className="w-16 h-16 sm:w-24 sm:h-24 bg-slate-100 rounded-lg animate-pulse" />
                )}
                <span className="mt-1 text-[9px] sm:text-[10px] font-black text-slate-900 truncate w-full">
                  Visão do Passageiro
                </span>
              </div>
            </>
          )}

          {/* Footer message banner card */}
          {paperSize === 'credit_card' && (
            <div
              key="footer_banner"
              style={{
                position: 'absolute',
                left: `${layoutPositions.footer_banner?.x ?? 3}%`,
                top: `${layoutPositions.footer_banner?.y ?? 82}%`,
                width: '94%',
                transform: `scale(${elementScale})`,
                transformOrigin: 'top left',
              }}
              onPointerDown={(e) => handlePointerDown('footer_banner', e)}
              className="pt-1 border-t border-slate-200 grid grid-cols-3 gap-1 text-[7px] font-extrabold text-slate-800 text-center bg-white cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center justify-center gap-1 bg-slate-50 p-0.5 rounded border border-slate-200">
                <Wifi className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                <span>Wi-Fi</span>
              </div>
              <div className="flex items-center justify-center gap-1 bg-slate-50 p-0.5 rounded border border-slate-200">
                <Music className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                <span>Música</span>
              </div>
              <div className="flex items-center justify-center gap-1 bg-slate-50 p-0.5 rounded border border-slate-200">
                <Zap className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                <span>Carregador</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
