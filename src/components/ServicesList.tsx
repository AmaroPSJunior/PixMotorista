import React, { useState } from 'react';
import {
  Fan,
  MapPin,
  Clock,
  Briefcase,
  ShoppingBag,
  Zap,
  Music,
  Wifi,
  Plus,
  Minus,
  Check,
  Sparkles,
  Tag,
  Coffee,
  Baby,
  Lock,
  Unlock,
  Wrench,
  Package,
  Pencil,
  Settings,
} from 'lucide-react';
import { AdditionalService } from '../types';
import { normalizeServiceId } from '../domain/serviceIds';

interface ServicesListProps {
  services: AdditionalService[];
  selectedServiceIds: string[];
  productQuantities?: Record<string, number>;
  purchasedProducts?: Record<string, number>;
  unlockedServiceIds?: string[];
  onToggleService: (serviceId: string) => void;
  onUpdateProductQuantity?: (serviceId: string, delta: number) => void;
  isDriverView?: boolean;
  onOpenDriverEditModal?: () => void;
}

// Icon dictionary helper
export const renderServiceIcon = (iconName: string, className: string = 'w-5 h-5') => {
  const name = iconName.toLowerCase();
  switch (name) {
    case 'wifi':
    case 'wi-fi':
    case 'internet':
      return <Wifi className={className} />;
    case 'fan':
    case 'ar':
    case 'wind':
      return <Fan className={className} />;
    case 'mappin':
    case 'parada':
    case 'map':
      return <MapPin className={className} />;
    case 'clock':
    case 'espera':
    case 'time':
      return <Clock className={className} />;
    case 'briefcase':
    case 'luggage':
    case 'mala':
      return <Briefcase className={className} />;
    case 'shoppingbag':
    case 'agua':
    case 'snack':
      return <ShoppingBag className={className} />;
    case 'zap':
    case 'carregador':
    case 'bateria':
      return <Zap className={className} />;
    case 'music':
    case 'som':
    case 'playlist':
      return <Music className={className} />;
    case 'coffee':
      return <Coffee className={className} />;
    case 'baby':
      return <Baby className={className} />;
    default:
      return <Sparkles className={className} />;
  }
};

// Helper to resolve item type (Serviço vs Produto)
const getItemType = (service: AdditionalService): 'servico' | 'produto' => {
  if (service.itemType) return service.itemType;
  const id = service.id.toLowerCase();
  if (
    id === 'wifi' ||
    id === 'spotify_music' ||
    id === 'charger' ||
    service.category === 'cortesia' ||
    service.category === 'conforto' ||
    service.category === 'espera'
  ) {
    return 'servico';
  }
  return 'produto';
};

  export const ServicesList: React.FC<ServicesListProps> = ({
  services,
  selectedServiceIds,
  productQuantities = {},
  purchasedProducts = {},
  unlockedServiceIds = [],
  onToggleService,
  onUpdateProductQuantity,
  isDriverView = false,
  onOpenDriverEditModal,
}) => {
  const [activeTabFilter, setActiveTabFilter] = useState<'todos' | 'servico' | 'produto'>('todos');

  // Show active services for passengers, or ALL services for driver so driver can edit/manage hidden items
  const relevantServices = isDriverView
    ? services
    : services.filter((item) => item.isActive !== false);

  // Filtered by selected category tab and sorted so ALL serviços appear first, followed by ALL produtos
  const displayServices = [...relevantServices]
    .filter((item) => {
      if (activeTabFilter === 'todos') return true;
      return getItemType(item) === activeTabFilter;
    })
    .sort((a, b) => {
      const typeA = getItemType(a);
      const typeB = getItemType(b);
      if (typeA !== typeB) {
        return typeA === 'servico' ? -1 : 1;
      }
      return 0;
    });

  const handleUpdateQty = (serviceId: string, delta: number) => {
    if (onUpdateProductQuantity) {
      onUpdateProductQuantity(serviceId, delta);
    } else {
      onToggleService(serviceId);
    }
  };

  const handleCardClick = (service: AdditionalService, isUnlocked: boolean) => {
    const isService = getItemType(service) === 'servico';
    if (isService) {
      if (isUnlocked && !isDriverView) {
        return; // Non-clickable for passengers once activated
      }
      onToggleService(service.id);
    } else {
      // Products can always be added / incremented by clicking
      handleUpdateQty(service.id, 1);
    }
  };

  const servicosCount = relevantServices.filter((s) => getItemType(s) === 'servico').length;
  const produtosCount = relevantServices.filter((s) => getItemType(s) === 'produto').length;

  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Catálogo de Serviços e Produtos
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Recursos do veículo e produtos disponíveis a bordo
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDriverView && onOpenDriverEditModal && (
            <button
              type="button"
              onClick={onOpenDriverEditModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Abrir editor de serviços e produtos"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Editar Produtos e Serviços</span>
            </button>
          )}

          {selectedServiceIds.length > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold self-start sm:self-auto border border-emerald-200">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>{selectedServiceIds.length} item(ns) adicionado(s)</span>
            </div>
          )}
        </div>
      </div>

      {/* Category Tabs: Todos, Serviços, Produtos */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTabFilter('todos')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer shrink-0 ${
            activeTabFilter === 'todos'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          Todos ({relevantServices.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTabFilter('servico')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTabFilter === 'servico'
              ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
              : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>🛠️ Serviços ({servicosCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabFilter('produto')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTabFilter === 'produto'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>📦 Produtos ({produtosCount})</span>
        </button>
      </div>

      {/* Services & Products List */}
      <div className="space-y-3">
        {displayServices.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Nenhum item encontrado nesta categoria.
          </div>
        ) : (
          displayServices.map((service) => {
            const itemType = getItemType(service);
            const isService = itemType === 'servico';
            const isMusic = service.id === 'spotify_music' || service.id === '2' || service.iconName.toLowerCase() === 'music';
            const isWifi = service.id === 'wifi' || service.id === '1' || service.iconName.toLowerCase() === 'wifi';
            const isCharger = service.id === 'charger' || service.id === '3' || service.iconName.toLowerCase() === 'zap' || service.title.toLowerCase().includes('carregador');

            const isSelected = selectedServiceIds.includes(service.id);
            const isUnlocked =
              unlockedServiceIds.includes(service.id) ||
              (isMusic && (unlockedServiceIds.includes('spotify_music') || unlockedServiceIds.includes('2'))) ||
              (isWifi && (unlockedServiceIds.includes('wifi') || unlockedServiceIds.includes('1'))) ||
              (isCharger && (unlockedServiceIds.includes('charger') || unlockedServiceIds.includes('3')));
            const isFree = service.price === 0;
            const isPassengerUnlocked = isService && isUnlocked && !isDriverView;

            // Product specific variables
            const purchasedQty = !isService ? (purchasedProducts[service.id] || 0) : 0;
            const selectedQty = !isService
              ? (productQuantities[service.id] || (isSelected ? 1 : 0))
              : (isSelected ? 1 : 0);

            return (
              <div
                key={service.id}
                data-service-id={service.id}
                onClick={() => handleCardClick(service, isUnlocked)}
                className={`group relative p-3.5 sm:p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isPassengerUnlocked
                    ? 'bg-emerald-50/70 border-emerald-300 opacity-75 pointer-events-none select-none'
                    : isUnlocked
                    ? 'bg-emerald-50/90 border-emerald-400 shadow-xs ring-1 ring-emerald-300 cursor-pointer'
                    : selectedQty > 0 || isSelected
                    ? 'bg-emerald-50/70 border-emerald-400 shadow-xs cursor-pointer'
                    : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/80 hover:border-slate-300 cursor-pointer'
                }`}
              >
                {/* Left side: Icon + Title + Category Badge + Description */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isUnlocked
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : selectedQty > 0 || isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isService
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {renderServiceIcon(service.iconName, 'w-5 h-5')}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-900 leading-snug truncate">
                        {service.title}
                      </h3>

                      {/* Category Badge: Serviço vs Produto */}
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                          isService
                            ? 'bg-sky-100 text-sky-800 border-sky-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        {isService ? '🛠️ Serviço' : '📦 Produto'}
                      </span>

                      {service.isActive === false && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 border border-slate-300 uppercase">
                          Oculto
                        </span>
                      )}

                      {/* Status Badges */}
                      {isService ? (
                        isUnlocked ? (
                          <span className="shrink-0 text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                            <Unlock className="w-3 h-3 text-emerald-600" /> Liberado
                          </span>
                        ) : !isFree && !isDriverView ? (
                          <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-amber-500" /> Requer Liberação
                          </span>
                        ) : service.isPopular ? (
                          <span className="shrink-0 text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Popular
                          </span>
                        ) : null
                      ) : (
                        <>
                          {purchasedQty > 0 && (
                            <span className="shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" /> Comprado ({purchasedQty}x)
                            </span>
                          )}
                          {selectedQty > 0 && (
                            <span className="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-300 inline-flex items-center gap-1">
                              🛒 {selectedQty}x no pedido
                            </span>
                          )}
                          {purchasedQty === 0 && selectedQty === 0 && service.isPopular && (
                            <span className="shrink-0 text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              Popular
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                      {service.description}
                    </p>
                  </div>
                </div>

                {/* Right side: Price Tag + Action Controls */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    {isService && isUnlocked ? (
                      <div>
                        <span className="inline-block text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-300">
                          ATIVADO
                        </span>
                      </div>
                    ) : isFree ? (
                      <span className="inline-block text-xs font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                        CORTESIA
                      </span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="text-sm sm:text-base font-extrabold text-slate-900">
                          R$ {service.price.toFixed(2).replace('.', ',')}
                        </span>
                        {!isService && selectedQty > 1 && (
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                            Total: R$ {(service.price * selectedQty).toFixed(2).replace('.', ',')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isDriverView && onOpenDriverEditModal && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDriverEditModal();
                        }}
                        className="w-8 h-8 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center transition-all cursor-pointer"
                        title="Editar título, descrição, preço ou tipo deste item"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Action Controls: Services vs Products */}
                    {isService ? (
                      <button
                        type="button"
                        disabled={isPassengerUnlocked}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(service, isUnlocked);
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          isUnlocked
                            ? isDriverView
                              ? 'bg-emerald-600 hover:bg-rose-600 text-white shadow-xs cursor-pointer'
                              : 'bg-emerald-600 text-white shadow-xs pointer-events-none'
                            : isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-200/80 group-hover:bg-slate-300 text-slate-600'
                        }`}
                        aria-label={isUnlocked ? 'Item Ativado' : isSelected ? 'Remover' : 'Adicionar'}
                      >
                        {isUnlocked ? (
                          <Check className="w-4 h-4" />
                        ) : isSelected ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      /* Product controls with quantity selector and Buy Again button */
                      selectedQty === 0 ? (
                        purchasedQty > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateQty(service.id, 1);
                            }}
                            className="px-2.5 py-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 shadow-xs transition-all cursor-pointer active:scale-95"
                            title="Comprar mais unidades deste produto"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Comprar Novamente</span>
                            <span className="sm:hidden">+ 1</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateQty(service.id, 1);
                            }}
                            className="w-8 h-8 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold transition-all cursor-pointer active:scale-95"
                            aria-label="Adicionar ao Pedido"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )
                      ) : (
                        <div
                          className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateQty(service.id, -1);
                            }}
                            className="w-7 h-7 rounded-md bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                            title="Diminuir quantidade"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-xs font-black text-slate-900 min-w-[22px] text-center">
                            {selectedQty}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateQty(service.id, 1);
                            }}
                            className="w-7 h-7 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                            title="Aumentar quantidade"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
