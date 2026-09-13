import React from 'react';
import { Heart, Smile } from 'lucide-react';

interface TipSectionProps {
  selectedTip: number;
  onSelectTip: (tipAmount: number) => void;
}

export const TipSection: React.FC<TipSectionProps> = ({
  selectedTip,
  onSelectTip,
}) => {
  const tipPresets = [2, 5, 10, 15];

  return (
    <section className="bg-gradient-to-br from-amber-50 to-orange-50/60 rounded-2xl p-4 shadow-sm border border-amber-200/80 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
          <Heart className="w-4 h-4 fill-amber-500 text-amber-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 leading-tight">
            Gostou do atendimento?
          </h3>
          <p className="text-xs text-slate-600">
            Deixe uma caixinha/gorjeta voluntária para o motorista
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-3">
        {tipPresets.map((amount) => {
          const isSelected = selectedTip === amount;
          return (
            <button
              key={amount}
              type="button"
              onClick={() => onSelectTip(isSelected ? 0 : amount)}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${
                isSelected
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs scale-102'
                  : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/60'
              }`}
            >
              + R$ {amount}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            if (selectedTip > 0 && !tipPresets.includes(selectedTip)) {
              onSelectTip(0);
            } else {
              const val = prompt('Informe o valor da caixinha (ex: 8):');
              if (val) {
                const parsed = parseFloat(val.replace(',', '.'));
                if (!isNaN(parsed) && parsed > 0) {
                  onSelectTip(parsed);
                }
              }
            }
          }}
          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${
            selectedTip > 0 && !tipPresets.includes(selectedTip)
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/60'
          }`}
        >
          {selectedTip > 0 && !tipPresets.includes(selectedTip)
            ? `+ R$ ${selectedTip.toFixed(2).replace('.', ',')}`
            : 'Outro'}
        </button>
      </div>
    </section>
  );
};
