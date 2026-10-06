import { useEffect, useState } from 'react';

export interface RideSessionState {
  ridePrice: number;
  isRidePaid: boolean;
  paidRideAmount: number;
  selectedServiceIds: string[];
  productQuantities: Record<string, number>;
  purchasedProducts: Record<string, number>;
  selectedTip: number;
  unlockedServices: string[];
}

const STORAGE_KEY = 'pix_ride_session_v2';

const readLegacyState = (): RideSessionState => {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      return {
        ridePrice: 0,
        isRidePaid: false,
        paidRideAmount: 0,
        selectedServiceIds: [],
        productQuantities: {},
        purchasedProducts: {},
        selectedTip: 0,
        unlockedServices: [],
        ...JSON.parse(current),
      };
    }

    return {
      ridePrice: Number(localStorage.getItem('pix_local_ride_price') || 0),
      isRidePaid: localStorage.getItem('pix_local_ride_paid') === 'true',
      paidRideAmount: Number(localStorage.getItem('pix_local_paid_ride_amount') || 0),
      selectedServiceIds: [],
      productQuantities: {},
      purchasedProducts: JSON.parse(localStorage.getItem('pix_local_purchased_products') || '{}'),
      selectedTip: 0,
      unlockedServices: JSON.parse(localStorage.getItem('pix_local_unlocked_services') || '[]'),
    };
  } catch {
    return {
      ridePrice: 0,
      isRidePaid: false,
      paidRideAmount: 0,
      selectedServiceIds: [],
      productQuantities: {},
      purchasedProducts: {},
      selectedTip: 0,
      unlockedServices: [],
    };
  }
};

export function useRideSession() {
  const [session, setSession] = useState<RideSessionState>(readLegacyState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Local persistence is best-effort; Firestore remains authoritative for shared state.
    }
  }, [session]);

  const setField = <K extends keyof RideSessionState>(
    key: K,
    value: RideSessionState[K] | ((previous: RideSessionState[K]) => RideSessionState[K])
  ) => {
    setSession((previous) => {
      const nextValue =
        typeof value === 'function'
          ? (value as (previous: RideSessionState[K]) => RideSessionState[K])(previous[key])
          : value;
      return { ...previous, [key]: nextValue };
    });
  };

  const reset = () =>
    setSession({
      ridePrice: 0,
      isRidePaid: false,
      paidRideAmount: 0,
      selectedServiceIds: [],
      productQuantities: {},
      purchasedProducts: {},
      selectedTip: 0,
      unlockedServices: [],
    });

  return {
    session,
    setSession,
    ridePrice: session.ridePrice,
    setRidePrice: (value: number | ((previous: number) => number)) => setField('ridePrice', value),
    localRidePaidState: session.isRidePaid,
    setLocalRidePaidState: (value: boolean | ((previous: boolean) => boolean)) => setField('isRidePaid', value),
    localPaidRideAmount: session.paidRideAmount,
    setLocalPaidRideAmount: (value: number | ((previous: number) => number)) => setField('paidRideAmount', value),
    selectedServiceIds: session.selectedServiceIds,
    setSelectedServiceIds: (
      value: string[] | ((previous: string[]) => string[])
    ) => setField('selectedServiceIds', value),
    productQuantities: session.productQuantities,
    setProductQuantities: (
      value: Record<string, number> | ((previous: Record<string, number>) => Record<string, number>)
    ) => setField('productQuantities', value),
    localPurchasedProducts: session.purchasedProducts,
    setLocalPurchasedProducts: (
      value:
        | Record<string, number>
        | ((previous: Record<string, number>) => Record<string, number>)
    ) => setField('purchasedProducts', value),
    selectedTip: session.selectedTip,
    setSelectedTip: (value: number | ((previous: number) => number)) => setField('selectedTip', value),
    localUnlockedServices: session.unlockedServices,
    setLocalUnlockedServices: (
      value: string[] | ((previous: string[]) => string[])
    ) => setField('unlockedServices', value),
    resetRideSession: reset,
  };
}
