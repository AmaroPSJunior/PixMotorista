import React, { useEffect, useState } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Server,
  Terminal,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { fetchMercadoPagoStatus, MercadoPagoStatusResponse } from '../lib/mercadopago';
import { subscribeMercadoPagoConfig, saveMercadoPagoConfig } from '../lib/firebase';

interface MercadoPagoSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MercadoPagoSettingsModal: React.FC<MercadoPagoSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [status, setStatus] = useState<MercadoPagoStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Form State for Driver Mercado Pago Credentials
  const [accessTokenInput, setAccessTokenInput] = useState<string>('');
  const [publicKeyInput, setPublicKeyInput] = useState<string>('');
  const [useRealPixInDev, setUseRealPixInDev] = useState<boolean>(true);
  const [showToken, setShowToken] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Subscribe to saved config in Firestore
    const unsub = subscribeMercadoPagoConfig((config) => {
      setAccessTokenInput(config.accessToken || '');
      setPublicKeyInput(config.publicKey || '');
      setUseRealPixInDev(config.useRealPixInDev !== false);
    });

    async function loadStatus() {
      setIsLoading(true);
      try {
        const res = await fetchMercadoPagoStatus();
        setStatus(res);
      } catch (e) {
        console.warn('Erro ao consultar status MP:', e);
      } finally {
        setIsLoading(false);
      }
    }

    loadStatus();

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const webhookUrl = status?.webhookUrl || (typeof window !== 'undefined' ? `${window.location.origin}/api/mercadopago/webhook` : '');

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccessMessage(null);

    const configData = {
      accessToken: accessTokenInput.trim(),
      publicKey: publicKeyInput.trim(),
      useRealPixInDev,
    };

    try {
      // 1. Save in Firestore
      await saveMercadoPagoConfig(configData);

      // 2. Post to backend server
      await fetch('/api/mercadopago/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });

      // 3. Refresh status
      const newStatus = await fetchMercadoPagoStatus();
      setStatus(newStatus);

      setSaveSuccessMessage('Credenciais do Mercado Pago salvas e ativadas com sucesso!');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Erro ao salvar credenciais do Mercado Pago:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-white">
                Configuração Mercado Pago & Webhook
              </h2>
              <p className="text-xs text-slate-400">
                Ative cobranças Pix reais na visão do motorista
              </p>
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

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Status Overview Card */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Server className="w-4 h-4 text-sky-400" />
                <span>Status da Credencial de Produção</span>
              </span>
              {isLoading ? (
                <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
              ) : status?.hasAccessToken ? (
                <span className="text-xs font-extrabold px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Pix Real Ativo ({status.mode === 'production' ? 'Produção' : 'Sandbox'})</span>
                </span>
              ) : (
                <span className="text-xs font-extrabold px-2.5 py-1 bg-amber-950 text-amber-400 border border-amber-800 rounded-lg flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Modo Demonstrativo</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {status?.hasAccessToken
                ? 'O Mercado Pago está configurado! As cobranças Pix geradas usam diretamente a sua conta oficial do Mercado Pago.'
                : 'Insira o seu Access Token do Mercado Pago abaixo para ativar cobranças e recebimento de Pix real na conta do motorista.'}
            </p>
          </div>

          {/* Form Section: Configure Access Token & Test Mode */}
          <form onSubmit={handleSaveCredentials} className="bg-slate-950/90 rounded-2xl p-4 border border-sky-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-extrabold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-sky-400" />
                <span>Credenciais da Conta do Mercado Pago</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                Visão do Motorista
              </span>
            </div>

            {/* Access Token Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 block">
                Access Token do Mercado Pago <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={accessTokenInput}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  placeholder="APP_USR-1234567890... ou TEST-1234567890..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Chave de acesso obtida no Mercado Pago Developers (inicia com <code className="text-amber-300">APP_USR-</code> para produção ou <code className="text-amber-300">TEST-</code> para testes).
              </p>
            </div>

            {/* Public Key Optional Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 block">
                Public Key (Opcional)
              </label>
              <input
                type="text"
                value={publicKeyInput}
                onChange={(e) => setPublicKeyInput(e.target.value)}
                placeholder="APP_USR-... ou TEST-..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Checkbox Toggle: Pix Real em Ambiente de Teste */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={useRealPixInDev}
                  onChange={(e) => setUseRealPixInDev(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-sky-500 bg-slate-900"
                />
                <div>
                  <span className="text-xs font-extrabold text-white group-hover:text-sky-300 transition-colors block">
                    ⚡ Ativar Pix Real mesmo em ambiente de teste (Preview)
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Gera QR Codes Pix oficiais diretamente no Mercado Pago mesmo ao testar no navegador.
                  </span>
                </div>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-between">
              {saveSuccessMessage ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-950/90 px-3 py-2 rounded-xl border border-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{saveSuccessMessage}</span>
                </div>
              ) : (
                <div />
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Salvar Credenciais do Mercado Pago</span>
              </button>
            </div>
          </form>

          {/* Webhook Endpoint Configuration Box */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-sky-400" />
                <span>URL do Webhook Mercado Pago (Sua Aplicação)</span>
              </span>
              <span className="text-[10px] text-sky-400 font-extrabold bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                POST /api/mercadopago/webhook
              </span>
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
                {copiedUrl ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar URL</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Cole esta URL no painel do Mercado Pago em <strong>Seu painel &gt; Webhooks / Notificações de IPN</strong> para receber confirmações automáticas em tempo real.
            </p>
          </div>

          {/* Instructions Guide */}
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 space-y-4">
            <h3 className="text-xs font-extrabold text-white flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>Instruções Passo a Passo para Obter seu Access Token:</span>
            </h3>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-medium">
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-sky-400 block">1. Obter Credenciais de Produção:</span>
                <p>
                  Acesse o painel de desenvolvedor:{' '}
                  <a
                    href="https://www.mercadopago.com.br/developers/panel"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 underline font-bold inline-flex items-center gap-1 hover:text-sky-300"
                  >
                    mercadopago.com.br/developers/panel
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </p>
                <p className="text-slate-400 text-[11px] mt-1">
                  Crie ou selecione uma aplicação, vá em <strong>Credenciais de Produção</strong> e copie o <strong>Access Token</strong> (inicia com <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded">APP_USR-</code>).
                </p>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="font-bold text-sky-400 block">2. Nota Importante do Mercado Pago:</span>
                <p className="text-slate-400 text-[11px]">
                  O Mercado Pago proíbe pagamentos efetuados pela mesma conta recebedora (pagar a si próprio com o mesmo e-mail/conta). Para testar o pagamento Pix real, utilize o aplicativo de um banco ou conta pagadora diferente da conta do Mercado Pago do motorista.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Mercado Pago Pix Integration & Firestore Sync
          </span>
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
