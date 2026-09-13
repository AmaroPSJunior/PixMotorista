import React from 'react';
import { ShoppingBag, Zap } from 'lucide-react';

interface TotalSummaryBarProps {
  ridePrice?: number;
  selectedServicesCount?: number;
  selectedServicesTotal?: number;
  selectedTip?: number;
  totalAmount: number;
  onScrollToPix: () => void;
  onPayClick?: () => void;
}

export const TotalSummaryBar: React.FC<TotalSummaryBarProps> = ({
  selectedServicesCount = 0,
  selectedServicesTotal = 0,
  selectedTip = 0,
  totalAmount,
  onScrollToPix,
  onPayClick,
}) => {
  if (totalAmount <= 0) return null;

  const handlePay = () => {
    if (onPayClick) {
      onPayClick();
    } else {
      onScrollToPix();
    }
  };

  // Build itemized description parts
  const itemsParts: string[] = [];
  if (selectedServicesTotal > 0) {
    itemsParts.push(`🛒 ${selectedServicesCount} serviço(s): R$ ${selectedServicesTotal.toFixed(2).replace('.', ',')}`);
  }
  if (selectedTip > 0) {
    itemsParts.push(`💚 Caixinha: R$ ${selectedTip.toFixed(2).replace('.', ',')}`);
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-xl mx-auto z-40 animate-slideUp">
      <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 shadow-2xl border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
            <ShoppingBag className="w-5 h-5 text-slate-950" />
          </div>

          <div>
            {/* Itemized summary line */}
            <div className="text-[11px] font-bold text-slate-300 flex flex-wrap gap-1 items-center">
              {itemsParts.length > 0 ? (
                itemsParts.map((part, idx) => (
                  <span key={idx} className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded border border-slate-700 text-[10px]">
                    {part}
                  </span>
                ))
              ) : (
                <span>Total a Pagar</span>
              )}
            </div>

            <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
              Total Unificado: R$ {totalAmount.toFixed(2).replace('.', ',')}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePay}
          className="bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 shrink-0 active:scale-95 cursor-pointer"
        >
          <Zap className="w-4 h-4 fill-current text-slate-950" />
          <span>Pagar via Pix / Mercado Pago</span>
        </button>
      </div>
    </div>
  );
};
