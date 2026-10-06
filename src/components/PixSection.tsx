import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode, Mail, Zap, RefreshCw, AlertCircle, Key, Image as ImageIcon, HelpCircle, ShieldCheck } from 'lucide-react';
import { DriverProfile } from '../types';
import { generatePixBRCodePayload } from '../utils/pixPayload';

interface PixSectionProps {
  driver: DriverProfile;
  totalAmount?: number;
  ridePrice?: number;
  selectedServicesTotal?: number;
  selectedTip?: number;
  selectedServicesCount?: number;
  onClearTotal?: () => void;
  viewMode?: 'driver' | 'passenger';
  onUpdateDriver?: (updatedDriver: DriverProfile) => void;
  onPayClick?: (amount: number) => void;
}

export const PixSection: React.FC<PixSectionProps> = ({
  driver,
  totalAmount = 0,
  ridePrice = 0,
  selectedServicesTotal = 0,
  selectedTip = 0,
  selectedServicesCount = 0,
  onClearTotal,
  viewMode = 'passenger',
  onUpdateDriver,
  onPayClick,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  const [qrMode, setQrMode] = useState<'brcode' | 'direct'>('brcode');
  const [customTip, setCustomTip] = useState<number>(0);

  const finalAmount = totalAmount + customTip;

  // Visibility flags for keys
  const showEmailKey = Boolean(driver.showEmailKey);
  const showRandomKey = driver.showRandomKey !== false;

  // Active Pix key used for auto-generating the QR Code if no custom image is uploaded
  const activePixKey = driver.pixKey || driver.randomPixKey || driver.googleEmail || '';

  // Determine whether driver uploaded a custom QR Code image
  const hasCustomQr = Boolean(driver.customQrCodeUrl);

  // Generate Pix payload string (BR Code standard)
  const brCodePayload = React.useMemo(() => {
    if (!activePixKey) return '';
    try {
      return generatePixBRCodePayload({
        pixKey: activePixKey,
        receiverName: driver.receiverName || driver.name,
        city: driver.city || 'SAO PAULO',
        amount: finalAmount > 0 ? finalAmount : undefined,
      });
    } catch (e) {
      return activePixKey;
    }
  }, [activePixKey, driver.receiverName, driver.city, driver.name, finalAmount]);

  // Generate QR code data URL whenever payload or mode changes
  useEffect(() => {
    let isMounted = true;
    const textToEncode = brCodePayload || activePixKey;

    if (!textToEncode) return;

    QRCode.toDataURL(textToEncode, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a', // Slate 900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating QR Code', err);
      });

    return () => {
      isMounted = false;
    };
  }, [brCodePayload, activePixKey]);

  const handleCopyText = (text: string, keyType: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyType);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(brCodePayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2500);
  };

  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 mb-6 space-y-4">
      {/* Dynamic Amount Banner if passenger selected services/tips/ride price */}
      {finalAmount > 0 && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-950 animate-fadeIn">
          <div>
            <span className="text-xs font-bold text-emerald-800 block uppercase tracking-wider">
              Valor Total Unificado do Pix:
            </span>
            <div className="text-2xl font-black text-emerald-950">
              R$ {finalAmount.toFixed(2).replace('.', ',')}
            </div>

            {/* Detailed Itemized Breakdown Tags */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] font-extrabold">
              {selectedServicesTotal > 0 && (
                <span className="bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs">
                  <span>🛒 Serviços a Bordo ({selectedServicesCount}):</span>
                  <span className="text-teal-950 font-black">R$ {selectedServicesTotal.toFixed(2).replace('.', ',')}</span>
                </span>
              )}
              {((selectedTip > 0) || customTip > 0) && (
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs">
                  <span>💚 Caixinha:</span>
                  <span className="text-emerald-950 font-black">R$ {((selectedTip || 0) + customTip).toFixed(2).replace('.', ',')}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onPayClick?.(finalAmount > 0 ? finalAmount : totalAmount)}
              className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-md shadow-sky-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Pagar no Mercado Pago</span>
            </button>

            <button
              onClick={() => {
                setCustomTip(0);
                if (onClearTotal) onClearTotal();
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline font-medium px-2 py-1 cursor-pointer"
            >
              Redefinir
            </button>
          </div>
        </div>
      )}

      {/* QR Code Card Display (Custom image uploaded by driver OR auto-generated from driver's key) */}
      <div className="bg-slate-50 rounded-2xl p-3 sm:p-4 border border-slate-200/60 flex flex-col items-center justify-center text-center w-full space-y-2">
        <div className="relative bg-white p-3 sm:p-4 rounded-2xl shadow-xs border border-slate-200/80 w-full flex flex-col items-center justify-center">
          {hasCustomQr ? (
            <img
              src={driver.customQrCodeUrl}
              alt="QR Code Pix do Motorista"
              className="w-full max-w-sm sm:max-w-md h-auto aspect-square rounded-xl object-contain"
            />
          ) : activePixKey ? (
            qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt="QR Code Pix"
                className="w-full max-w-sm sm:max-w-md h-auto aspect-square rounded-xl object-contain"
              />
            ) : (
              <div className="w-full max-w-sm aspect-square bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            )
          ) : (
            <div className="w-full max-w-sm aspect-square bg-slate-100 rounded-xl flex flex-col items-center justify-center p-4 text-center text-slate-400">
              <QrCode className="w-10 h-10 mb-2 text-slate-300" />
              <span className="text-sm font-semibold text-slate-600">Aguardando Chave Pix</span>
              <span className="text-xs text-slate-400 mt-1 leading-tight">Motorista ainda não cadastrou a chave Pix</span>
            </div>
          )}
        </div>

        {/* QR Code Value Info Badge */}
        {activePixKey && !hasCustomQr && (
          <div className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {finalAmount > 0
                ? `QR Code gerado para R$ ${finalAmount.toFixed(2).replace('.', ',')} (Valor Total)`
                : 'QR Code para transferência livre (sem valor pré-definido)'}
            </span>
          </div>
        )}
      </div>

      {/* Pix Keys Display Section */}
      <div className="space-y-3">
        {/* Chave E-mail Key Card (if showEmailKey is true) */}
        {showEmailKey && (
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
                <Mail className="w-3.5 h-3.5 text-slate-600" />
                <span>Chave Pix (E-mail):</span>
              </div>
              {driver.pixKey ? (
                <>
                  <div className="font-mono text-sm sm:text-base font-bold text-slate-900 truncate tracking-tight select-all">
                    {driver.pixKey}
                  </div>
                  {driver.receiverName && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Favorecido: <strong className="text-slate-700">{driver.receiverName}</strong>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs font-semibold text-slate-500">
                  Chave E-mail não configurada
                </div>
              )}
            </div>

            <button
              onClick={() => handleCopyText(driver.pixKey, 'email')}
              disabled={!driver.pixKey}
              className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm ${
                !driver.pixKey
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : copiedKey === 'email'
                  ? 'bg-emerald-600 text-white scale-102'
                  : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-98'
              }`}
            >
              {copiedKey === 'email' ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Chave Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-emerald-400" />
                  <span>Copiar E-mail</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Chave Pix Card (if showRandomKey is true) */}
        {showRandomKey && driver.randomPixKey && (
          <div className="bg-indigo-50/70 rounded-xl p-3.5 border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-medium mb-1">
                <Key className="w-3.5 h-3.5 text-indigo-600" />
                <span>Chave Pix:</span>
              </div>
              <div className="font-mono text-xs sm:text-sm font-bold text-slate-900 truncate tracking-tight select-all">
                {driver.randomPixKey}
              </div>
            </div>

            <button
              onClick={() => handleCopyText(driver.randomPixKey!, 'random')}
              className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm ${
                copiedKey === 'random'
                  ? 'bg-emerald-600 text-white scale-102'
                  : 'bg-indigo-900 hover:bg-indigo-800 text-white active:scale-98'
              }`}
            >
              {copiedKey === 'random' ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Chave Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-indigo-300" />
                  <span>Copiar Chave Pix</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>

      {/* How to Pay Instructions Section - Placed right below the copy key button */}
      <div className="pt-3 border-t border-slate-200/80 mt-2">
        <h3 className="text-xs font-bold text-slate-800 mb-2.5 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-600" />
          <span>Como realizar o pagamento?</span>
        </h3>

        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
          <li className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <span>Abra o app do seu banco e acesse a opção <strong>Pix</strong>.</span>
          </li>
          <li className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <span>Escolha <strong>Escanear QR Code</strong> ou cole a chave Pix.</span>
          </li>
          <li className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <span>Confirme o valor e finalize o pagamento ao motorista.</span>
          </li>
        </ol>
      </div>


    </section>
  );
};
