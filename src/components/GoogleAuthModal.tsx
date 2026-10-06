import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { signInDriverWithGoogle } from '../lib/auth';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (googleUser: { uid: string; name: string; email: string; photoUrl: string }) => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const googleUser = await signInDriverWithGoogle();
      onSuccess(googleUser);
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code.includes('popup-closed-by-user')) {
        setError('Login cancelado. Tente novamente quando quiser acessar o painel.');
      } else if (code.includes('popup-blocked')) {
        setError('O navegador bloqueou a janela de login. Libere pop-ups e tente novamente.');
      } else {
        setError(err?.message || 'Não foi possível autenticar com o Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 flex flex-col items-center relative">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 border border-slate-200 shadow-xs">
          <svg className="w-7 h-7" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
        </div>

        <h2 className="text-xl font-black text-slate-900 tracking-tight text-center">
          Acesso do Motorista
        </h2>
        <p className="text-xs text-slate-500 mt-1 text-center max-w-xs leading-relaxed">
          Entre com sua Conta Google. O painel só será liberado após autenticação real pelo Firebase.
        </p>

        {error && (
          <div className="w-full mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full mt-5 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-70"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Continuar com Google</span>
            </>
          )}
        </button>

        <div className="mt-4 flex items-center justify-center gap-1 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Autenticação Firebase + Google</span>
        </div>
      </div>
    </div>
  );
};
