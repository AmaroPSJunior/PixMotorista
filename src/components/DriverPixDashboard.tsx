import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, CircleAlert, Copy, CreditCard, QrCode, RefreshCw, Settings2, ShieldCheck } from 'lucide-react';
import type { DriverProfile } from '../types';
import { formatPixAmount } from '../domain/driverPixLayout';
import { generatePixBRCodePayload } from '../utils/pixPayload';

interface DriverPixDashboardProps {
  driver: DriverProfile;
  chargeAmount: number;
  rideAmount: number;
  passengerName?: string;
  ridePaid: boolean;
  selectedServicesCount: number;
  selectedTip: number;
  onCharge: (amount: number) => void;
  onOpenSettings: () => void;
}

export const DriverPixDashboard: React.FC<DriverPixDashboardProps> = ({
  driver, chargeAmount, rideAmount, passengerName, ridePaid, selectedServicesCount,
  selectedTip, onCharge, onOpenSettings,
}) => {
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const pixKey = driver.pixKey || driver.randomPixKey || '';
  const customQr = driver.customQrCodeUrl || '';
  const safeAmount = Number.isFinite(chargeAmount) && chargeAmount > 0 ? chargeAmount : 0;

  const pixPayload = useMemo(() => {
    if (!pixKey || customQr) return '';
    try {
      return generatePixBRCodePayload({
        pixKey,
        receiverName: driver.receiverName || driver.name,
        city: driver.city || 'SAO PAULO',
        amount: safeAmount || undefined,
      });
    } catch {
      return '';
    }
  }, [pixKey, customQr, driver.receiverName, driver.name, driver.city, safeAmount]);

  useEffect(() => {
    let active = true;
    setQrImage('');
    setQrError(false);
    if (pixPayload) {
      QRCode.toDataURL(pixPayload, {
        width: 380, margin: 2, errorCorrectionLevel: 'M',
        color: { dark: '#071521', light: '#ffffff' },
      }).then((url) => {
        if (active) setQrImage(url);
      }).catch(() => {
        if (active) setQrError(true);
      });
    }
    return () => { active = false; };
  }, [pixPayload]);

  const handleCopy = async () => {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <section data-testid="driver-pix-automotive" aria-labelledby="driver-pix-title"
      className="rounded-[2rem] border border-sky-400/30 bg-[#0b2332] text-white shadow-2xl shadow-slate-950/20 overflow-hidden">
      <div className="px-5 sm:px-8 py-5 border-b border-slate-600/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black tracking-widest text-sky-300 uppercase">Pix • Central do carro</p>
          <h2 id="driver-pix-title" className="text-2xl sm:text-3xl font-black mt-1">Pagamento sem complicação</h2>
        </div>
        <span className="rounded-full px-4 py-2 bg-emerald-400/15 text-emerald-200 font-bold text-sm border border-emerald-400/40">
          <ShieldCheck className="w-5 h-5 inline-block mr-1.5 align-middle" aria-hidden="true" />
          Confira a confirmação no app
        </span>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
        <div className="p-5 sm:p-8 space-y-6 md:border-r border-slate-600/60">
          <div>
            <p className="text-base sm:text-lg font-bold text-slate-300">Adicionais para cobrar</p>
            <div data-testid="driver-pix-amount" className="text-5xl sm:text-6xl font-black tracking-tight tabular-nums mt-2 text-white">
              {formatPixAmount(safeAmount)}
            </div>
            <p className="text-base text-slate-300 mt-3">
              {selectedServicesCount > 0 || selectedTip > 0
                ? `${selectedServicesCount} ${selectedServicesCount === 1 ? 'item selecionado' : 'itens selecionados'}${selectedTip > 0 ? ' • caixinha incluída' : ''}`
                : 'Selecione um adicional ou uma caixinha para gerar uma cobrança.'}
            </p>
          </div>

          {(passengerName || rideAmount > 0) && (
            <div className="rounded-2xl bg-slate-900/70 border border-slate-600 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-300">Corrida {passengerName ? `• ${passengerName}` : ''}</p>
                {rideAmount > 0 && <p className="text-xl font-black mt-1">{formatPixAmount(rideAmount)}</p>}
              </div>
              <span className={`px-3 py-2 rounded-xl text-sm font-black ${ridePaid ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'}`}>
                {ridePaid ? 'Corrida paga' : 'Corrida pendente'}
              </span>
              <p className="w-full text-sm text-slate-300">A cobrança da corrida é gerenciada na seção Passageiros, abaixo.</p>
            </div>
          )}

          <button type="button" data-testid="driver-pix-charge" disabled={safeAmount <= 0}
            onClick={() => onCharge(safeAmount)}
            className="w-full min-h-20 rounded-2xl px-5 bg-sky-400 text-slate-950 text-xl sm:text-2xl font-black flex items-center justify-center gap-3 disabled:bg-slate-600 disabled:text-slate-200 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-4 focus-visible:outline-white active:scale-[0.99]">
            <CreditCard className="w-8 h-8 shrink-0" aria-hidden="true" />
            {safeAmount > 0 ? 'Gerar cobrança Pix' : 'Sem valor para cobrar'}
          </button>
          <p className="text-sm text-slate-300 leading-relaxed">Faça ajustes e confirme os pagamentos somente com o veículo parado.</p>
        </div>

        <div className="bg-[#061724] p-5 sm:p-8 flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex items-center gap-2 text-lg font-black self-start">
            <QrCode className="w-6 h-6 text-sky-300" aria-hidden="true" /> Pix direto
          </div>
          {customQr || qrImage ? (
            <div className="bg-white rounded-3xl p-3 w-full max-w-[18rem]">
              <img data-testid="driver-pix-qr" src={customQr || qrImage} alt="QR Code Pix para o passageiro escanear"
                className="w-full aspect-square object-contain" />
            </div>
          ) : pixPayload && !qrError ? (
            <div role="status" className="bg-white/10 rounded-3xl w-full max-w-[18rem] aspect-square flex items-center justify-center">
              <RefreshCw className="w-10 h-10 animate-spin" aria-label="Preparando QR Code" />
            </div>
          ) : (
            <div className="w-full max-w-[18rem] min-h-44 rounded-3xl border border-amber-400/60 bg-amber-400/10 p-5 flex flex-col items-center justify-center gap-3">
              <CircleAlert className="w-9 h-9 text-amber-300" aria-hidden="true" />
              <p className="font-bold text-lg">{qrError ? 'QR Code indisponível' : 'Configure sua chave Pix'}</p>
              <button type="button" onClick={onOpenSettings}
                className="min-h-14 rounded-xl bg-sky-400 px-5 text-slate-950 font-black flex items-center gap-2">
                <Settings2 className="w-5 h-5" aria-hidden="true" /> Abrir configurações
              </button>
            </div>
          )}
          {(customQr || pixPayload) && (
            <p className="text-sm leading-relaxed text-slate-300">
              {customQr
                ? 'QR cadastrado pelo motorista. Confira o valor no app do banco antes de aceitar.'
                : safeAmount > 0
                  ? `QR direto com ${formatPixAmount(safeAmount)}. A confirmação deve ser verificada no banco.`
                  : 'QR direto sem valor definido. Confira a confirmação no banco.'}
            </p>
          )}
          {pixPayload && !customQr && (
            <button type="button" onClick={handleCopy}
              className="w-full max-w-[18rem] min-h-14 px-4 rounded-2xl border-2 border-sky-300 text-sky-100 text-base font-black flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-4 focus-visible:outline-white">
              {copyState === 'copied' ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
              {copyState === 'copied' ? 'Código copiado' : copyState === 'failed' ? 'Falha ao copiar. Tente novamente' : 'Copiar código Pix'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
