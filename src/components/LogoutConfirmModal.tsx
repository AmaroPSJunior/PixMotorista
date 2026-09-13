import React from 'react';
import { X, LogOut, AlertTriangle, ShieldOff } from 'lucide-react';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userEmail?: string;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userEmail,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 flex flex-col items-center relative text-center">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning / LogOut Icon Badge */}
        <div className="w-14 h-14 bg-rose-100/90 border border-rose-200/90 rounded-2xl flex items-center justify-center mb-3 shadow-xs text-rose-600">
          <LogOut className="w-7 h-7 text-rose-600" />
        </div>

        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Sair da Conta Google?
        </h2>

        {userEmail && (
          <div className="mt-1 px-3 py-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 truncate max-w-full">
            <span className="text-slate-400 font-normal">Conta:</span>
            <span className="truncate">{userEmail}</span>
          </div>
        )}

        <p className="text-xs text-slate-600 mt-3 leading-relaxed">
          Tem certeza de que deseja realizar o logoff da sua conta de motorista neste dispositivo?
        </p>

        {/* Info box explaining effect */}
        <div className="w-full mt-4 bg-rose-50/80 border border-rose-200/80 rounded-2xl p-3 text-left flex items-start gap-2.5 text-xs text-rose-950">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-extrabold text-rose-900">Desconexão do Dispositivo</p>
            <p className="text-[11px] text-rose-800 leading-relaxed">
              O aplicativo voltará para o <strong>Modo Passageiro</strong> neste aparelho. Para acessar novamente as configurações do motorista, será necessário fazer login via Google.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-2xl transition-colors active:scale-[0.98]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
          >
            <ShieldOff className="w-4 h-4" />
            <span>Sim, Sair</span>
          </button>
        </div>
      </div>
    </div>
  );
};
