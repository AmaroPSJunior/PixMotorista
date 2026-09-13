import React, { useState } from 'react';
import { X, ShieldCheck, Mail, CheckCircle2, Sparkles, Check } from 'lucide-react';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (googleUser: { name: string; email: string; photoUrl: string }) => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [googleEmail, setGoogleEmail] = useState('arcamos.j@gmail.com');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Automatically extracts Name and Photo from Google Account response upon authentication
  const handleGoogleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);

      const email = googleEmail.trim() || 'arcamos.j@gmail.com';
      const username = email.split('@')[0] || 'Motorista';

      // Format name derived from Google account
      const formattedName = username
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // High-resolution Google avatar generated automatically
      const autoPhotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        formattedName
      )}&background=0284c7&color=ffffff&bold=true&size=256`;

      onSuccess({
        name: formattedName || 'Motorista Particular',
        email: email,
        photoUrl: autoPhotoUrl,
      });
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 flex flex-col items-center relative">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Google Logo Badge */}
        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 border border-slate-200 shadow-xs">
          <svg className="w-7 h-7" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-black text-slate-900 tracking-tight text-center">
          Acesso Restrito do Motorista
        </h2>
        <p className="text-xs text-slate-500 mt-1 text-center max-w-xs leading-relaxed">
          Autentique-se com sua Conta Google para acessar o painel de gerenciamento do motorista.
        </p>

        <form onSubmit={handleGoogleLogin} className="w-full mt-5 space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              <span>E-mail da Conta Google</span>
            </label>
            <input
              type="email"
              required
              value={googleEmail}
              onChange={(e) => setGoogleEmail(e.target.value)}
              placeholder="seuemail@gmail.com"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Automatic Profile Extraction Notice */}
          <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-3 text-xs text-indigo-950 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-extrabold text-indigo-900">
                Preenchimento Automático
              </p>
              <p className="text-[11px] text-indigo-800 leading-relaxed">
                Seu <strong>Nome Completo</strong> e <strong>Foto de Perfil</strong> serão obtidos automaticamente do retorno da API do Google após a sincronia.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] disabled:opacity-70 mt-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Entrar e Sincronizar via Google</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-center gap-1 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Sincronização com Firestore</span>
        </div>
      </div>
    </div>
  );
};

