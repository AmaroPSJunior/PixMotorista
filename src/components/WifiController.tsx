import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Wifi, QrCode as QrCodeIcon, X, Settings } from 'lucide-react';
import { DriverProfile } from '../types';

interface WifiControllerProps {
  driver: DriverProfile;
  isUnlocked: boolean;
  isDriverView: boolean;
  onOpenDriverConfig?: () => void;
}

export const WifiController: React.FC<WifiControllerProps> = ({
  driver,
  isUnlocked,
  isDriverView,
  onOpenDriverConfig,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const ssid = driver.wifiSsid || 'Wi-Fi 5G Veículo';
  const password = driver.wifiPassword || 'conectado5g';

  useEffect(() => {
    // If custom uploaded QR code image exists, use it!
    if (driver.wifiQrCodeUrl) {
      setQrCodeUrl(driver.wifiQrCodeUrl);
      return;
    }

    // Standard Wi-Fi QR Code format: WIFI:S:<SSID>;T:WPA;P:<PASSWORD>;;
    const wifiPayload = `WIFI:S:${ssid};T:WPA;P:${password};;`;
    QRCode.toDataURL(wifiPayload, {
      width: 400,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('Erro ao gerar QR Code do Wi-Fi:', err));
  }, [driver.wifiQrCodeUrl, ssid, password]);

  // If Wi-Fi is not unlocked and not in driver view, show a small preview banner
  if (!isUnlocked && !isDriverView) {
    return null;
  }

  return (
    <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-4 sm:p-5 text-white shadow-lg space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center shrink-0">
            <Wifi className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-white">Wi-Fi 5G do Veículo</h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                LIBERADO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Conexão sem fio de alta velocidade para usar durante o trajeto.
            </p>
          </div>
        </div>

        {isDriverView && onOpenDriverConfig && (
          <button
            type="button"
            onClick={onOpenDriverConfig}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
            title="Configurar Nome e Senha do Wi-Fi"
          >
            <Settings className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Configurar</span>
          </button>
        )}
      </div>

      {/* Centered QR Code Content */}
      <div className="flex flex-col items-center justify-center bg-slate-950 p-4 rounded-xl border border-slate-800 w-full">
        {qrCodeUrl ? (
          <div
            onClick={() => setIsQrModalOpen(true)}
            className="group relative cursor-pointer flex flex-col items-center w-full"
          >
            <img
              src={qrCodeUrl}
              alt="QR Code do Wi-Fi"
              className="w-full aspect-square object-contain rounded-xl border border-slate-700 group-hover:scale-[1.01] transition-transform bg-white p-2 shadow-md"
            />
            <span className="text-xs text-sky-400 font-bold mt-2.5 flex items-center gap-1 group-hover:underline">
              <QrCodeIcon className="w-3.5 h-3.5" /> Ampliar QR Code
            </span>
          </div>
        ) : (
          <div className="w-full aspect-square rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
            <Wifi className="w-12 h-12 animate-pulse" />
          </div>
        )}
        <span className="text-xs text-slate-400 mt-2.5 text-center font-medium">
          📷 Aponte a câmera do celular para se conectar automaticamente
        </span>
      </div>

      {/* Expanded QR Code Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center mx-auto">
              <Wifi className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">QR Code de Conexão Wi-Fi</h3>
              <p className="text-xs text-slate-400 mt-1">
                Aponte a câmera do seu smartphone para se conectar automaticamente à rede do veículo.
              </p>
            </div>

            {qrCodeUrl && (
              <div className="bg-white p-4 rounded-2xl inline-block border-2 border-sky-500 shadow-xl mx-auto">
                <img src={qrCodeUrl} alt="QR Code Ampliado" className="w-56 h-56 object-contain mx-auto" />
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
