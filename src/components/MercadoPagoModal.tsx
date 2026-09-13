import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { MercadoPagoPayment } from '../types';
import {
  createMercadoPagoPixPayment,
  checkMercadoPagoPaymentStatus,
  simulateMercadoPagoWebhook,
  fetchMercadoPagoStatus,
  MercadoPagoStatusResponse,
} from '../lib/mercadopago';
import { subscribePixPayment } from '../lib/firebase';
import { playPaymentSuccessSound } from '../utils/audio';

interface MercadoPagoModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  description?: string;
  selectedServicesCount?: number;
  onPaymentSuccess?: (payment: MercadoPagoPayment) => void;
}

export const MercadoPagoModal: React.FC<MercadoPagoModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  description = 'Serviços de Corrida Moto / Extras',
  selectedServicesCount = 0,
  onPaymentSuccess,
}) => {
  const [payment, setPayment] = useState<MercadoPagoPayment | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [mpStatus, setMpStatus] = useState<MercadoPagoStatusResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [hasPlayedSound, setHasPlayedSound] = useState<boolean>(false);

  const isApproved = payment?.status === 'approved' || Boolean(payment?.paymentActivated);

  // Play confirmation chime sound as soon as payment is approved
  useEffect(() => {
    if (isApproved && !hasPlayedSound) {
      playPaymentSuccessSound();
      setHasPlayedSound(true);
    }
  }, [isApproved, hasPlayedSound]);

  // 1. Fetch Mercado Pago Status and generate Pix charge on open
  useEffect(() => {
    if (!isOpen) {
      setPayment(null);
      setError(null);
      setHasPlayedSound(false);
      return;
    }

    let isMounted = true;

    async function initPixCharge() {
      setIsLoading(true);
      setError(null);

      try {
        const statusRes = await fetchMercadoPagoStatus();
        if (isMounted) setMpStatus(statusRes);

        // Generate Mercado Pago Pix Payment
        const newPayment = await createMercadoPagoPixPayment({
          amount: totalAmount > 0 ? totalAmount : 5.0,
          description,
          payer: {
            email: 'passageiro@exemplo.com',
            firstName: 'Passageiro',
            lastName: 'MotoTaxi',
          },
        });

        if (isMounted) {
          setPayment(newPayment);

          // Generate QR code data URL if base64 not directly returned
          if (newPayment.qrCodeBase64) {
            setQrCodeDataUrl(`data:image/png;base64,${newPayment.qrCodeBase64}`);
          } else if (newPayment.qrCode) {
            QRCode.toDataURL(newPayment.qrCode, { margin: 2, width: 300 })
              .then((url) => {
                if (isMounted) setQrCodeDataUrl(url);
              })
              .catch(() => {});
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Erro ao gerar pagamento Mercado Pago Pix.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initPixCharge();

    return () => {
      isMounted = false;
    };
  }, [isOpen, totalAmount, description]);

  // 2. Real-time Firebase Firestore Subscription for instant Webhook updates
  useEffect(() => {
    if (!payment?.paymentId) return;

    // Firestore listener for real-time Webhook activation
    const unsubscribe = subscribePixPayment(payment.paymentId, (updatedPayment) => {
      if (updatedPayment) {
        setPayment((prev) => ({ ...prev, ...updatedPayment }));
        if (updatedPayment.status === 'approved' || updatedPayment.paymentActivated) {
          if (onPaymentSuccess) {
            onPaymentSuccess(updatedPayment);
          }
        }
      }
    });

    // Fallback polling every 3 seconds to check Mercado Pago API status
    const pollInterval = setInterval(async () => {
      try {
        if (payment.status === 'pending') {
          const updated = await checkMercadoPagoPaymentStatus(payment.paymentId);
          if (updated) {
            setPayment((prev) => ({ ...prev, ...updated }));
            if (updated.status === 'approved' || updated.paymentActivated) {
              if (onPaymentSuccess) {
                onPaymentSuccess(updated);
              }
            }
          }
        }
      } catch (e) {
        // Silent fail polling
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [payment?.paymentId, payment?.status, onPaymentSuccess]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (payment?.qrCode) {
      navigator.clipboard.writeText(payment.qrCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleSimulateWebhook = async () => {
    if (!payment?.paymentId) return;
    setIsSimulating(true);
    try {
      const res = await simulateMercadoPagoWebhook(payment.paymentId, 'approved');
      if (res?.payment) {
        setPayment(res.payment);
        if (onPaymentSuccess) onPaymentSuccess(res.payment);
      }
    } catch (e) {
      alert('Erro ao simular webhook Mercado Pago.');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg text-white">
                  Pagamento Pix
                </h2>
                {!mpStatus?.hasAccessToken && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                    Modo Demo
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Amount Badge */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium block">
                Valor Total a Pagar
              </span>
              <div className="text-2xl font-black text-white mt-0.5">
                R$ {totalAmount.toFixed(2).replace('.', ',')}
              </div>
            </div>
            {selectedServicesCount > 0 && (
              <span className="text-xs font-semibold px-3 py-1 bg-sky-950 text-sky-400 border border-sky-800/60 rounded-xl">
                {selectedServicesCount} {selectedServicesCount === 1 ? 'Serviço' : 'Serviços'}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-10 h-10 text-sky-400 animate-spin mx-auto" />
              <p className="text-sm text-slate-300 font-semibold">
                Gerando cobrança no Mercado Pago...
              </p>
              <p className="text-xs text-slate-500">Conectando via API do Mercado Pago</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <div className="text-sm font-bold text-rose-300">{error}</div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all"
              >
                Tentar Novamente
              </button>
            </div>
          ) : isApproved ? (
            /* SUCCESS CELEBRATION VIEW */
            <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-3xl p-6 text-center space-y-4 animate-scaleUp">
              <div className="w-16 h-16 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider bg-emerald-950 px-3 py-1 rounded-full border border-emerald-800 inline-block mb-1">
                  Pix Aprovado
                </span>
                <h3 className="text-xl font-extrabold text-white">
                  Pagamento Confirmado!
                </h3>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-98"
                >
                  Concluir e Voltar
                </button>
              </div>
            </div>
          ) : (
            /* PENDING PAYMENT VIEW WITH QR CODE & COPY CODE */
            <div className="space-y-4">
              {/* Credentials Warning Notice if live credentials throw unauthorized error */}
              {payment?.authError && (
                <div className="bg-amber-950/60 border border-amber-500/40 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-extrabold text-amber-300">
                      Modo Demonstrativo Ativado
                    </div>
                    <div className="text-[11px] leading-relaxed text-amber-200/90">
                      O Access Token do Mercado Pago no servidor retornou um aviso da API (<code className="bg-slate-900 text-amber-300 px-1 rounded font-mono">{payment.apiErrorDetail || 'Unauthorized use of live credentials'}</code>).
                      O QR Code abaixo foi gerado em <strong>Modo de Teste Demonstrativo</strong> para garantir o teste da aplicação.
                    </div>
                  </div>
                </div>
              )}

              {/* Status Webhook Waiting Banner */}
              <div className="bg-sky-950/40 border border-sky-800/60 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-sky-200">
                <Clock className="w-5 h-5 text-sky-400 shrink-0 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sky-300">
                    Aguardando Confirmação Pix...
                  </div>
                  <div className="text-[11px] text-sky-400/80 truncate">
                    Assim que você pagar, o Webhook do Mercado Pago aprova em segundos!
                  </div>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col items-center justify-center">
                {qrCodeDataUrl ? (
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-md">
                    <img
                      src={qrCodeDataUrl}
                      alt="Mercado Pago Pix QR Code"
                      className="w-56 h-56 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-56 h-56 bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  </div>
                )}
                <span className="text-[11px] text-slate-400 mt-2 font-medium">
                  Escaneie o QR Code com o aplicativo do seu banco
                </span>
              </div>

              {/* Pix Copia e Cola Code */}
              {payment?.qrCode && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-sky-400" />
                    <span>Pix Copia e Cola (Código do Mercado Pago)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={payment.qrCode}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 truncate focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        copiedCode
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                      }`}
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar Código</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Simulation Box for Dev/Tester */}
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold flex items-center gap-1 text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Teste de Webhook</span>
                  </span>
                  <span className="text-[10px] text-slate-500">ID: {payment?.paymentId}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Quer testar a reação em tempo real do aplicativo sem abrir o app do banco? Clique para disparar uma confirmação de webhook simulada:
                </p>
                <button
                  type="button"
                  onClick={handleSimulateWebhook}
                  disabled={isSimulating}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-xs rounded-xl border border-sky-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  {isSimulating ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                  ) : (
                    <Zap className="w-4 h-4 text-sky-400 fill-current" />
                  )}
                  <span>Simular Notificação de Webhook Aprovado</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-center text-[11px] text-slate-500 shrink-0">
          Pagamento Pix Instantâneo
        </div>
      </div>
    </div>
  );
};
