import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Server,
  Terminal,
} from 'lucide-react';
import { fetchMercadoPagoStatus, MercadoPagoStatusResponse } from '../lib/mercadopago';

interface MercadoPagoSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MercadoPagoSettingsModal: React.FC<MercadoPagoSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [status, setStatus] = useState<MercadoPagoStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const loadStatus = async () => {
      setIsLoading(true);
      try {
        const next = await fetchMercadoPagoStatus();
        if (active) setStatus(next);
      } catch (error) {
        console.warn('Erro ao consultar status do Mercado Pago:', error);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadStatus();
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const webhookUrl =
    status?.webhookUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/api/mercadopago/webhook`
      : '');

  const handleCopyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-white">
                Mercado Pago
              </h2>
              <p className="text-xs text-slate-400">
                Credenciais protegidas no servidor
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Server className="w-4 h-4 text-sky-400" />
                Status da integração
              </span>
              {isLoading ? (
                <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
              ) : status?.hasAccessToken ? (
                <span className="text-xs font-extrabold px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Pix real ativo
                </span>
              ) : (
                <span className="text-xs font-extrabold px-2.5 py-1 bg-amber-950 text-amber-400 border border-amber-800 rounded-lg flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Não configurado
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {status?.hasAccessToken
                ? 'A credencial está configurada no ambiente seguro do servidor.'
                : 'Configure MERCADO_PAGO_ACCESS_TOKEN no ambiente do servidor para habilitar Pix real.'}
            </p>
          </div>

          <div className="bg-sky-950/30 rounded-2xl p-4 border border-sky-800/50 space-y-2">
            <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Segurança das credenciais
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              O Access Token não pode mais ser digitado, lido ou salvo pelo navegador.
              Ele deve existir apenas como variável de ambiente do servidor.
            </p>
            <div className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 font-mono text-[11px] text-slate-300">
              MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-sky-400" />
              URL do Webhook
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-300 truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyWebhookUrl}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  copiedUrl
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                }`}
              >
                {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedUrl ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-2">
            <h3 className="text-xs font-extrabold text-white flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              Produção
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Em produção, falhas da API do Mercado Pago retornam erro explícito.
              QR Codes simulados e o endpoint de simulação ficam indisponíveis.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
