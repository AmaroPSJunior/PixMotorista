import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  collection,
  writeBatch,
  onSnapshot,
  deleteDoc,
  getDocs,
  getDocFromServer,
  setLogLevel,
  query,
  where,
} from 'firebase/firestore';

// Suppress non-critical Firestore internal gRPC stream log messages (e.g. idle disconnects)
try {
  setLogLevel('error');
} catch (e) {
  // Ignore in case setLogLevel fails in certain environments
}
import firebaseConfig from '../../firebase-applet-config.json';
import { DriverProfile, AdditionalService, PassengerSession, SessionSettings } from '../types';
import { DEFAULT_DRIVER_PROFILE, DEFAULT_SERVICES } from '../data/defaultData';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with persistent offline cache resilience
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      ...(firebaseConfig.firestoreDatabaseId ? { databaseId: firebaseConfig.firestoreDatabaseId } : {}),
    });
  } catch (e) {
    return firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  }
})();

// Validate connection gracefully
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'driver_profiles', 'connection_test'));
  } catch (error) {
    if (error instanceof Error && (error.message.includes('offline') || error.message.includes('unavailable'))) {
      console.warn('Firestore operating in offline/resilient cache mode.');
    }
  }
}
testFirestoreConnection();

const DRIVER_DOC_ID = 'main_profile';

// Subscribe to real-time driver profile changes (supports email-scoped sync for multi-device Google account persistence)
export function subscribeDriverProfile(
  onUpdate: (profile: DriverProfile) => void,
  googleEmail?: string
) {
  const cleanEmail = (googleEmail || '').trim().toLowerCase();
  const targetDocId = cleanEmail ? getCleanEmailDocId(cleanEmail) : DRIVER_DOC_ID;
  const docRef = doc(db, 'driver_profiles', targetDocId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate(parseDriverProfileDoc(data, cleanEmail));
      } else if (cleanEmail) {
        // Fallback to main_profile if email-specific document does not exist yet
        getDoc(doc(db, 'driver_profiles', DRIVER_DOC_ID)).then((mainSnap) => {
          if (mainSnap.exists()) {
            onUpdate(parseDriverProfileDoc(mainSnap.data(), cleanEmail));
          } else {
            onUpdate(DEFAULT_DRIVER_PROFILE);
          }
        }).catch(() => {
          onUpdate(DEFAULT_DRIVER_PROFILE);
        });
      } else {
        onUpdate(DEFAULT_DRIVER_PROFILE);
      }
    },
    (error) => {
      console.warn('Firestore driver profile error:', error);
    }
  );
}

/**
 * Recursively removes any keys with `undefined` values from an object or array.
 * Firestore `setDoc`, `updateDoc`, and `addDoc` throw an explicit error if any field is `undefined`.
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeFirestoreData) as unknown as T;
  }

  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestoreData(value);
      }
    }
    return cleaned as T;
  }

  return obj;
}

export function getCleanEmailDocId(email: string): string {
  const clean = email.trim().toLowerCase();
  return 'email_' + clean.replace(/[^a-z0-9_]/g, '_');
}

export function parseDriverProfileDoc(data: any, fallbackEmail: string): DriverProfile {
  return {
    name: data.name || '',
    carModel: data.carModel || '',
    carColor: data.carColor || '',
    licensePlate: data.licensePlate || '',
    photoUrl: data.photoUrl || '',
    pixKey: data.pixKey || '',
    pixKeyType: data.pixKeyType || 'email',
    randomPixKey: data.randomPixKey || '',
    customQrCodeUrl: data.customQrCodeUrl || '',
    customPublicUrl: data.customPublicUrl || '',
    receiverName: data.receiverName || '',
    city: data.city || '',
    greetingMessage: data.greetingMessage || '',
    googleAuthenticated: Boolean(data.googleAuthenticated),
    googleEmail: data.googleEmail || fallbackEmail,
    authUid: data.authUid || '',
    showEmailKey: data.showEmailKey !== undefined ? Boolean(data.showEmailKey) : false,
    showRandomKey: data.showRandomKey !== undefined ? Boolean(data.showRandomKey) : true,
    showCopyPasteCode: data.showCopyPasteCode !== undefined ? Boolean(data.showCopyPasteCode) : true,
    showQrCode: data.showQrCode !== undefined ? Boolean(data.showQrCode) : true,
    useCustomQrCodeImage: Boolean(data.useCustomQrCodeImage),
    wifiQrCodeUrl: data.wifiQrCodeUrl || '',
    showSpotifyController: data.showSpotifyController !== false,
    allowPassengerMusicControl: Boolean(data.allowPassengerMusicControl),
    spotifyDriverPlaylist: data.spotifyDriverPlaylist || '',
    printSheetLayout: data.printSheetLayout || undefined,
    printPaperSize: data.printPaperSize || undefined,
    printPaperOrientation: data.printPaperOrientation || undefined,
    printElementScale: data.printElementScale || undefined,
    printCardSpacing: data.printCardSpacing || undefined,
    printCustomLabels: data.printCustomLabels || undefined,
  };
}

// Save driver profile to Firestore (both main_profile and per-google-email document)
export async function saveDriverProfile(profile: DriverProfile) {
  try {
    const payload = sanitizeFirestoreData({
      ...profile,
      updatedAt: new Date().toISOString(),
    });

    // 1. Always update main_profile document for real-time active passenger view
    const mainDocRef = doc(db, 'driver_profiles', DRIVER_DOC_ID);
    await setDoc(mainDocRef, payload, { merge: true });

    // 2. If googleEmail is set, ALSO save to persistent per-account document
    if (profile.googleEmail) {
      const emailDocId = getCleanEmailDocId(profile.googleEmail);
      const accountDocRef = doc(db, 'driver_profiles', emailDocId);
      await setDoc(accountDocRef, payload, { merge: true });
    }
  } catch (error) {
    console.error('Error saving driver profile to Firestore:', error);
  }
}

// Fetch existing driver profile from Firestore by Google email if previously registered
export async function fetchDriverProfileByEmail(email: string): Promise<DriverProfile | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  const emailDocId = getCleanEmailDocId(cleanEmail);

  try {
    const emailSnap = await getDoc(doc(db, 'driver_profiles', emailDocId));
    if (emailSnap.exists()) {
      const data = emailSnap.data();
      if (data && (data.name || data.pixKey || data.carModel || data.photoUrl)) {
        return parseDriverProfileDoc(data, cleanEmail);
      }
    }
  } catch (error) {
    // Legacy account documents may be unreadable until the authenticated owner migrates them.
    console.warn('Driver account profile unavailable; trying public profile fallback:', error);
  }

  try {
    const mainSnap = await getDoc(doc(db, 'driver_profiles', DRIVER_DOC_ID));
    if (mainSnap.exists()) {
      const data = mainSnap.data();
      const existingEmail = (data.googleEmail || '').trim().toLowerCase();
      const existingPixEmail = (data.pixKeyType === 'email' ? data.pixKey || '' : '').trim().toLowerCase();

      if ((existingEmail && existingEmail === cleanEmail) || (existingPixEmail && existingPixEmail === cleanEmail)) {
        return parseDriverProfileDoc(data, cleanEmail);
      }
    }
  } catch (error) {
    console.warn('Error checking public driver profile:', error);
  }

  return null;
}

// Subscribe to real-time services changes
export function subscribeServices(onUpdate: (services: AdditionalService[]) => void) {
  const colRef = collection(db, 'services');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (!snapshot.empty) {
        const servicesList: AdditionalService[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          const defaultType: 'servico' | 'produto' = (d.id === 'wifi' || d.id === 'spotify_music' || d.id === 'charger' || d.id === 'extra_stop') ? 'servico' : 'produto';
          servicesList.push({
            id: d.id,
            title: data.title || '',
            description: data.description || '',
            price: Number(data.price) || 0,
            iconName: data.iconName || 'Tag',
            category: data.category || 'cortesia',
            itemType: (data.itemType as 'servico' | 'produto') || defaultType,
            isActive: data.isActive !== false,
            isPopular: data.isPopular !== undefined ? Boolean(data.isPopular) : false,
          });
        });
        const defaultOrder = ['wifi', 'spotify_music', 'charger', 'extra_stop', 'agua', 'snacks'];
        servicesList.sort((a, b) => {
          const indexA = defaultOrder.indexOf(a.id);
          const indexB = defaultOrder.indexOf(b.id);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.id.localeCompare(b.id);
        });
        onUpdate(servicesList);
      } else {
        // Public readers must never seed/write the catalog.
        onUpdate(DEFAULT_SERVICES);
      }
    },
    (error) => {
      console.warn('Firestore services error:', error);
    }
  );
}

// Save all services to Firestore and sync deletions
export async function saveAllServices(services: AdditionalService[]) {
  try {
    const colRef = collection(db, 'services');
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);

    const activeIds = new Set(services.map((s) => s.id));

    // Delete documents from Firestore that are no longer in the services array
    snapshot.forEach((d) => {
      if (!activeIds.has(d.id)) {
        batch.delete(d.ref);
      }
    });

    // Add or update current services in Firestore
    services.forEach((s) => {
      const docRef = doc(db, 'services', s.id);
      const defaultType: 'servico' | 'produto' = (s.id === 'wifi' || s.id === 'spotify_music' || s.id === 'charger' || s.id === 'extra_stop') ? 'servico' : 'produto';
      batch.set(docRef, sanitizeFirestoreData({
        id: s.id,
        title: s.title || '',
        description: s.description || '',
        price: Number(s.price) || 0,
        iconName: s.iconName || 'Tag',
        category: s.category || 'cortesia',
        itemType: s.itemType || defaultType,
        isActive: s.isActive !== false,
        isPopular: Boolean(s.isPopular),
        updatedAt: new Date().toISOString(),
      }));
    });

    await batch.commit();
  } catch (error) {
    console.error('Error saving services to Firestore:', error);
  }
}

// Delete service from Firestore
export async function deleteServiceDoc(id: string) {
  try {
    const docRef = doc(db, 'services', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting service from Firestore:', error);
  }
}

// Subscribe to real-time status updates of a Mercado Pago Pix Payment
export function subscribePixPayment(paymentId: string, onUpdate: (payment: any) => void) {
  if (!paymentId) return () => {};
  const docRef = doc(db, 'pix_payments', paymentId);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data());
      }
    },
    (error) => {
      console.warn('Firestore pix_payments error:', error);
    }
  );
}

// Default session settings
export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  autoExpireMinutes: 30,
  allowMultiPassengerMode: false,
  defaultSingleSession: true,
  defaultUnlockedServices: [],
};

// Subscribe to real-time passenger session settings
export function subscribeSessionSettings(onUpdate: (settings: SessionSettings) => void) {
  const docRef = doc(db, 'session_settings', 'main_config');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          autoExpireMinutes: Number(data.autoExpireMinutes) || 30,
          allowMultiPassengerMode: Boolean(data.allowMultiPassengerMode),
          defaultSingleSession: data.defaultSingleSession !== false,
          defaultUnlockedServices: Array.isArray(data.defaultUnlockedServices)
            ? data.defaultUnlockedServices
            : [],
        });
      } else {
        onUpdate(DEFAULT_SESSION_SETTINGS);
      }
    },
    (error) => {
      console.warn('Firestore session_settings error:', error);
    }
  );
}

// Save session settings to Firestore
export async function saveSessionSettings(settings: SessionSettings) {
  try {
    const docRef = doc(db, 'session_settings', 'main_config');
    await setDoc(
      docRef,
      sanitizeFirestoreData({
        ...settings,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving session settings:', error);
  }
}

// Subscribe to real-time list of all passenger sessions
export function subscribePassengerSessions(
  onUpdate: (sessions: PassengerSession[]) => void,
  options: { driverMode?: boolean; authUid?: string | null } = {}
) {
  const colRef = collection(db, 'passenger_sessions');
  const source = options.driverMode
    ? colRef
    : options.authUid
      ? query(colRef, where('authUid', '==', options.authUid))
      : null;

  if (!source) {
    onUpdate([]);
    return () => {};
  }

  return onSnapshot(
    source,
    (snapshot) => {
      const list: PassengerSession[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          passengerName: data.passengerName || 'Passageiro',
          browserId: data.browserId || '',
          createdAt: data.createdAt || new Date().toISOString(),
          lastActiveAt: data.lastActiveAt || new Date().toISOString(),
          status: data.status || 'active',
          unlockedServices: Array.isArray(data.unlockedServices) ? data.unlockedServices : [],
          purchasedProducts: (data.purchasedProducts && typeof data.purchasedProducts === 'object') ? data.purchasedProducts : {},
          hasMusicUnlocked: Boolean(data.hasMusicUnlocked),
          paidAmount: Number(data.paidAmount) || 0,
          paymentId: data.paymentId || '',
          notes: data.notes || '',
          isRidePaid: Boolean(data.isRidePaid),
          paidRideAmount: Number(data.paidRideAmount) || 0,
          ridePrice: data.ridePrice !== undefined ? Number(data.ridePrice) : 0,
          driverEmail: data.driverEmail || '',
          authUid: data.authUid || '',
        });
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Firestore passenger_sessions error:', error);
    }
  );
}

// Save or create a passenger session in Firestore
export async function savePassengerSession(session: PassengerSession) {
  try {
    const docRef = doc(db, 'passenger_sessions', session.id);
    await setDoc(
      docRef,
      sanitizeFirestoreData({
        ...session,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving passenger session:', error);
  }
}

// Expire previous active passenger sessions when a new passenger registers
export async function closeAllPreviousPassengerSessionsExcept(
  keepSessionId: string,
  driverEmail?: string,
  authUid?: string
) {
  try {
    const colRef = collection(db, 'passenger_sessions');
    const source = authUid ? query(colRef, where('authUid', '==', authUid)) : colRef;
    const snap = await getDocs(source);
    const batch = writeBatch(db);
    const targetDriver = (driverEmail || '').trim().toLowerCase();

    snap.forEach((d) => {
      const data = d.data();
      const sessionDriver = (data.driverEmail || '').trim().toLowerCase();
      const matchesDriver = !targetDriver || !sessionDriver || sessionDriver === targetDriver || sessionDriver === 'arcamos.j@gmail.com';

      if (d.id !== keepSessionId && data.status === 'active' && matchesDriver) {
        batch.update(d.ref, {
          status: 'expired',
          expiredAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    await batch.commit();
  } catch (error) {
    console.error('Error expiring previous passenger sessions:', error);
  }
}

// Update status of a specific passenger session
export async function updatePassengerSessionStatus(
  sessionId: string,
  status: 'active' | 'expired' | 'closed'
) {
  try {
    const docRef = doc(db, 'passenger_sessions', sessionId);
    await setDoc(
      docRef,
      {
        status,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating passenger session status:', error);
  }
}

// Toggle or unlock a service for a passenger session
export async function toggleSessionServiceUnlock(
  sessionId: string,
  serviceId: string,
  currentUnlockedServices: string[] = [],
  unlock: boolean = true
) {
  try {
    const docRef = doc(db, 'passenger_sessions', sessionId);
    let updatedList = [...currentUnlockedServices];

    // Canonical key mapping for backward compatibility
    const targetKeys =
      serviceId === 'spotify_music' || serviceId === '2'
        ? ['spotify_music', '2']
        : serviceId === 'wifi' || serviceId === '1'
        ? ['wifi', '1']
        : serviceId === 'charger' || serviceId === '3'
        ? ['charger', '3']
        : [serviceId];

    if (unlock) {
      targetKeys.forEach((key) => {
        if (!updatedList.includes(key)) {
          updatedList.push(key);
        }
      });
    } else {
      updatedList = updatedList.filter((id) => !targetKeys.includes(id));
    }

    const hasMusic =
      updatedList.includes('spotify_music') || updatedList.includes('2');

    await setDoc(
      docRef,
      {
        unlockedServices: updatedList,
        hasMusicUnlocked: hasMusic,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error unlocking session service:', error);
  }
}

export interface MercadoPagoConfigData {
  accessToken: string;
  publicKey?: string;
  useRealPixInDev?: boolean;
}

export function subscribeMercadoPagoConfig(onUpdate: (config: MercadoPagoConfigData) => void) {
  const docRef = doc(db, 'mercadopago_config', 'main_config');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          accessToken: data.accessToken || '',
          publicKey: data.publicKey || '',
          useRealPixInDev: data.useRealPixInDev !== false,
        });
      } else {
        onUpdate({
          accessToken: '',
          publicKey: '',
          useRealPixInDev: true,
        });
      }
    },
    (error) => {
      console.warn('Firestore mercadopago_config error:', error);
    }
  );
}

export async function saveMercadoPagoConfig(config: MercadoPagoConfigData) {
  try {
    const docRef = doc(db, 'mercadopago_config', 'main_config');
    await setDoc(
      docRef,
      sanitizeFirestoreData({
        ...config,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving Mercado Pago config:', error);
  }
}

export async function recordPurchasedProductsToSession(
  sessionId: string,
  newProductsMap: Record<string, number>,
  currentPurchasedProducts: Record<string, number> = {}
) {
  try {
    const docRef = doc(db, 'passenger_sessions', sessionId);
    const updatedMap = { ...currentPurchasedProducts };
    Object.entries(newProductsMap).forEach(([id, qty]) => {
      if (qty > 0) {
        updatedMap[id] = (updatedMap[id] || 0) + qty;
      }
    });

    await setDoc(
      docRef,
      {
        purchasedProducts: updatedMap,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error recording purchased products to session:', error);
  }
}


