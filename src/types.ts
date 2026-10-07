import { normalizeServiceId } from './domain/serviceIds';

export interface DraggableItemPosition {
  x: number;
  y: number;
}

export type PrintSheetLayoutMap = Record<string, DraggableItemPosition>;

export interface DriverProfile {
  name: string;
  photoUrl: string;
  carModel: string;
  carColor: string;
  licensePlate: string;
  pixKey: string;
  pixKeyType: 'email' | 'cpf' | 'phone' | 'random';
  randomPixKey?: string;
  customQrCodeUrl?: string;
  customPublicUrl?: string;
  receiverName: string;
  city: string;
  greetingMessage?: string;
  googleAuthenticated?: boolean;
  googleEmail?: string;
  authUid?: string;
  // Visibilidade de opções para o passageiro (chavinhas/toggles)
  showEmailKey?: boolean;
  showRandomKey?: boolean;
  showCopyPasteCode?: boolean;
  showQrCode?: boolean;
  useCustomQrCodeImage?: boolean;
  wifiQrCodeUrl?: string;
  // Layout personalizado arrastável para folha de impressão (A4, A5, A3, Carta, Placa, Cartão)
  printSheetLayout?: PrintSheetLayoutMap;
  printPaperSize?: 'credit_card' | 'seat_sign' | 'a4_full' | 'a5_half' | 'a3_large' | 'letter_full';
  printPaperOrientation?: 'portrait' | 'landscape';
  printElementScale?: number;
  printCardSpacing?: number;
  printCustomLabels?: Record<string, string>;
  // Spotify e Controle de Som do Carro
  showSpotifyController?: boolean;
  allowPassengerMusicControl?: boolean;
  spotifyDriverPlaylist?: string;
}

export interface AdditionalService {
  id: string;
  title: string;
  description: string;
  price: number;
  iconName: string;
  isPopular?: boolean;
  category?: 'conforto' | 'conveniencia' | 'espera' | 'bagagem' | 'cortesia';
  itemType?: 'servico' | 'produto'; // Categoriza se é Serviço (Recurso do veículo) ou Produto (Consumível)
  isActive?: boolean;
}

export interface SelectedService {
  serviceId: string;
  quantity: number;
}

export interface MercadoPagoPayment {
  paymentId: string;
  amount: number;
  description: string;
  status: 'pending' | 'approved' | 'authorized' | 'in_process' | 'in_mediation' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
  statusDetail?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  payerEmail?: string;
  serviceId?: string;
  rideId?: string;
  passengerSessionId?: string;
  serviceIds?: string[];
  productQuantities?: Record<string, number>;
  paymentActivated?: boolean;
  activatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  isRealMercadoPago?: boolean;
  message?: string;
}

export type RideStatus = 'created' | 'active' | 'completed' | 'expired' | 'cancelled';
export type RidePaymentStatus = 'unpaid' | 'pending' | 'paid';

export interface Ride {
  id: string;
  driverUid: string;
  driverEmail: string;
  status: RideStatus;
  paymentStatus: RidePaymentStatus;
  price: number;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  expiresAt?: string;
  defaultUnlockedServices: string[];
  passengerSessionId?: string;
  paymentId?: string;
  paidAmount?: number;
}

export interface PassengerSession {
  id: string;
  passengerName: string;
  browserId: string;
  createdAt: string;
  lastActiveAt: string;
  status: 'active' | 'expired' | 'closed';
  unlockedServices: string[]; // e.g. ['spotify_music', 'wifi', '1', '2']
  purchasedProducts?: Record<string, number>; // e.g. { 'agua': 2, 'snacks': 1 }
  hasMusicUnlocked?: boolean;
  paidAmount?: number;
  paymentId?: string;
  notes?: string;
  isRidePaid?: boolean;
  paidRideAmount?: number;
  ridePrice?: number;
  driverEmail?: string;
  driverUid?: string;
  rideId?: string;
  authUid?: string;
}

export interface SessionSettings {
  autoExpireMinutes: number; // e.g. 15, 30, 60, 120
  allowMultiPassengerMode: boolean; // default false
  defaultSingleSession: boolean; // default true
  defaultUnlockedServices?: string[];
}

export const getItemType = (service: { id: string; title: string; iconName: string; category?: string; itemType?: 'servico' | 'produto'; type?: 'servico' | 'produto' }): 'servico' | 'produto' => {
  if (service.itemType) return service.itemType;
  if (service.type) return service.type;
  if (service.category === 'servico' || service.category === 'produto') return service.category as 'servico' | 'produto';

  const id = normalizeServiceId(service.id);
  const isService =
    id === 'wifi' ||
    id === 'spotify_music' ||
    id === 'charger' ||
    (service.iconName && service.iconName.toLowerCase() === 'wifi') ||
    (service.iconName && service.iconName.toLowerCase() === 'music') ||
    (service.iconName && service.iconName.toLowerCase() === 'zap') ||
    service.title.toLowerCase().includes('wifi') ||
    service.title.toLowerCase().includes('carregador') ||
    service.title.toLowerCase().includes('música');

  return isService ? 'servico' : 'produto';
};

