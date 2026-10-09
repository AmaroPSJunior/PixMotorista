import React from 'react';
import { Check, CheckCircle2, CircleAlert, Clock3, Copy, QrCode, RefreshCw, X } from 'lucide-react';
import type { MercadoPagoPayment } from '../types';
import { driverPixPaymentPhase, formatPixAmount } from '../domain/driverPixLayout';

interface DriverPixCheckoutProps {
  payment: MercadoPagoPayment | null;
  amount: number;
  qrImage: string;
  isLoading: boolean;
  error: string | null;
  copiedCode: boolean;
  copyError: boolean;
  onCopyCode: () => void;
  onClose: () => void;
}

export const DriverPixCheckout: React.FC<DriverPixCheckoutProps> = ({
  payment, amount, qrImage, isLoading, error, copiedCode, copyError, onCopyCode, onClose,
}) => {
  const phase = driverPixPaymentPhase(payment, isLoading, error);
  const amountLabel = formatPixAmount(amount);

  return (
    <div data-testid="driver-pix-checkout" role="dialog" aria-modal="true" aria-labelledby="driver-pix-checkout-title"
      className="fixed inset-0 z-[90] bg-[#020b14]/95 p-3 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-5xl max-h-full overflow-y-auto rounded-[2rem] border border-sky-400/40 bg-[#0b2332] text-white shadow-2xl">
        <header className="p-5 sm:p-7 border-b border-slate-600 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black tracking-widest text-sky-300 uppercase">Cobrança Pix</p>
            <h2 id="driver-pix-checkout-title" className="text-2xl sm:text-3xl font-black">{amountLabel}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar cobrança Pix"
            className="min-h-14 min-w-14 rounded-2xl border border-slate-500 flex items-center justify-center focus-visible:outline focus-visible:outline-4 focus-visible:outline-white">
            <X className="w-7 h-7" aria-hidden="true" />
          </button>
        </header>

        <div aria-live="polite" className="p-5 sm:p-8">
          {phase === 'loading' && (
            <div data-testid="driver-pix-loading" role="status" className="min-h-64 flex flex-col items-center justify-center gap-5 text-center">
              <RefreshCw className="w-14 h-14 animate-spin text-sky-300" aria-hidden="true" />
              <p className="text-2xl font-black">Preparando cobrança Pix</p>
              <p className="text-base text-slate-300">Aguarde o QR Code aparecer antes de mostrar ao passageiro.</p>
            </div>
          )}

          {phase === 'confirmed' && (
            <div data-testid="driver-pix-confirmed" role="status" className="min-h-64 flex flex-col items-center justify-center gap-5 text-center">
              <CheckCircle2 className="w-20 h-20 text-emerald-300" aria-hidden="true" />
              <h3 className="text-3xl sm:text-4xl font-black">Pagamento confirmado</h3>
              <p className="text-lg text-slate-200">{amountLabel} aprovado e ativado pelo servidor.</p>
              <button type="button" onClick={onClose}
                className="min-h-16 w-full max-w-sm rounded-2xl bg-emerald-400 text-slate-950 text-xl font-black focus-visible:outline focus-visible:outline-4 focus-visible:outline-white">
                Voltar ao painel
              </button>
            </div>
          )}

          {(phase === 'error' || phase === 'cancelled') && (
            <div data-testid="driver-pix-failed" role="alert" className="min-h-64 flex flex-col items-center justify-center gap-5 text-center">
              <CircleAlert className="w-20 h-20 text-amber-300" aria-hidden="true" />
              <h3 className="text-3xl font-black">
                {phase === 'cancelled' ? 'Cobrança encerrada' : 'Não foi possível concluir'}
              </h3>
              <p className="text-lg text-slate-200 max-w-xl">
                {error || (payment?.status === 'rejected'
                  ? 'O pagamento foi recusado. Confira a situação antes de gerar outra cobrança.'
                  : 'O pagamento foi cancelado ou estornado. Confira a situação antes de tentar novamente.')}
              </p>
              <button type="button" onClick={onClose}
                className="min-h-16 w-full max-w-sm rounded-2xl bg-sky-400 text-slate-950 text-xl font-black focus-visible:outline focus-visible:outline-4 focus-visible:outline-white">
                Voltar ao painel
              </button>
            </div>
          )}

          {phase === 'idle' && (
            <div role="status" className="min-h-52 flex flex-col items-center justify-center gap-4 text-center">
              <p className="text-xl font-bold">Nenhuma cobrança ativa.</p>
              <button type="button" onClick={onClose} className="min-h-16 px-8 rounded-2xl bg-sky-400 text-slate-950 text-xl font-black">Voltar ao painel</button>
            </div>
          )}

          {phase === 'waiting' && (
            <div data-testid="driver-pix-waiting" className="grid md:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)] gap-6 sm:gap-8 items-center">
              <div className="space-y-5">
                <div role="status" className="p-5 rounded-2xl border border-sky-300/50 bg-sky-300/10 flex items-start gap-4">
                  <Clock3 className="w-9 h-9 text-sky-300 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="text-2xl font-black">Aguardando confirmação</h3>
                    <p className="text-base text-slate-200 mt-2">Mostre o QR Code ao passageiro e aguarde a confirmação do pagamento pelo servidor.</p>
                  </div>
                </div>
                <p className="text-lg font-bold">Valor desta cobrança: {amountLabel}</p>
                {payment?.qrCode && (
                  <button type="button" onClick={onCopyCode}
                    className="min-h-16 w-full rounded-2xl border-2 border-sky-300 text-white text-lg font-black flex items-center justify-center gap-3 focus-visible:outline focus-visible:outline-4 focus-visible:outline-white">
                    {copiedCode ? <Check className="w-7 h-7" aria-hidden="true" /> : <Copy className="w-7 h-7" aria-hidden="true" />}
                    {copiedCode ? 'Código copiado' : 'Copiar código Pix'}
                  </button>
                )}
                {copyError && <p role="alert" className="text-amber-200 font-bold">Não foi possível copiar. Use o QR Code.</p>}
                <p className="text-sm text-slate-300">Fechar esta tela não cancela a cobrança. Não considere o pagamento concluído até aparecer a confirmação.</p>
              </div>
              <div className="rounded-3xl bg-[#061724] border border-slate-600 p-5 flex flex-col items-center gap-4">
                {qrImage ? (
                  <div className="bg-white p-3 rounded-3xl w-full max-w-[17rem]">
                    <img src={qrImage} alt="QR Code da cobrança Mercado Pago Pix" className="w-full aspect-square object-contain" />
                  </div>
                ) : (
                  <div role="status" className="w-full max-w-[17rem] aspect-square rounded-3xl bg-white/10 flex items-center justify-center">
                    <QrCode className="w-14 h-14 text-sky-300" aria-label="Preparando QR Code" />
                  </div>
                )}
                <p className="text-base font-bold text-center">Passageiro escaneia no app do banco</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
