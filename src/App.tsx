import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PixSection } from './components/PixSection';
import { ServicesList } from './components/ServicesList';
import { TipSection } from './components/TipSection';
import { TotalSummaryBar } from './components/TotalSummaryBar';
import { DriverEditModal } from './components/DriverEditModal';
import { PrintSignModal } from './components/PrintSignModal';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { SpotifyController } from './components/SpotifyController';
import { WifiController } from './components/WifiController';
import { MercadoPagoSettingsModal } from './components/MercadoPagoSettingsModal';
import { MercadoPagoModal } from './components/MercadoPagoModal';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';
import { DEFAULT_DRIVER_PROFILE, DEFAULT_SERVICES } from './data/defaultData';
import { DriverProfile, AdditionalService, MercadoPagoPayment, PassengerSession, SessionSettings, getItemType } from './types';
import { HelpCircle, ShieldCheck, Eye, Smartphone, ArrowRight, Sparkles, LogOut, Database, Users } from 'lucide-react';
import { playPaymentSuccessSound } from './utils/audio';
import { PassengerSessionManager } from './components/PassengerSessionManager';
import { PassengerRegistrationModal } from './components/PassengerRegistrationModal';
import { getOrCreateBrowserId } from './utils/browserId';
import {
  subscribeDriverProfile,
  saveDriverProfile,
  fetchDriverProfileByEmail,
  subscribeServices,
  saveAllServices,
  subscribePassengerSessions,
  subscribeSessionSettings,
  saveSessionSettings,
  DEFAULT_SESSION_SETTINGS,
  toggleSessionServiceUnlock,
  savePassengerSession,
  recordPurchasedProductsToSession,
} from './lib/firebase';

import { isDevEnvironment, getEffectiveDriverEmail, DEFAULT_DRIVER_EMAIL } from './utils/urlHelper';
import { AuthenticatedDriver, ensurePassengerAuth, signOutDriver, subscribeDriverAuth } from './lib/auth';
import { DriverApp } from './views/DriverApp';
import { PassengerApp } from './views/PassengerApp';
import { useRideSession } from './state/useRideSession';

export default function App() {
  const isDevEnv = isDevEnvironment();

  const [driver, setDriver] = useState<DriverProfile>(DEFAULT_DRIVER_PROFILE);
  const [services, setServices] = useState<AdditionalService[]>(DEFAULT_SERVICES);

  const {
    ridePrice,
    setRidePrice,
    localRidePaidState,
    setLocalRidePaidState,
    localPaidRideAmount,
    setLocalPaidRideAmount,
    selectedServiceIds,
    setSelectedServiceIds,
    productQuantities,
    setProductQuantities,
    localPurchasedProducts,
    setLocalPurchasedProducts,
    selectedTip,
    setSelectedTip,
    localUnlockedServices,
    setLocalUnlockedServices,
  } = useRideSession();

  const saveLocalPurchasedProducts = (newMap: Record<string, number>) => {
    setLocalPurchasedProducts((prev) => {
      const updated = { ...prev };
      Object.entries(newMap).forEach(([id, qty]) => {
        updated[id] = (updated[id] || 0) + qty;
      });
      return updated;
    });
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isGoogleAuthModalOpen, setIsGoogleAuthModalOpen] = useState<boolean>(false);
  const [isLogoutConfirmModalOpen, setIsLogoutConfirmModalOpen] = useState<boolean>(false);
  const [isMercadoPagoSettingsModalOpen, setIsMercadoPagoSettingsModalOpen] = useState<boolean>(false);

  // Mercado Pago Checkout Modal State
  const [isMpModalOpen, setIsMpModalOpen] = useState<boolean>(false);
  const [mpModalAmount, setMpModalAmount] = useState<number>(0);
  const [mpModalDescription, setMpModalDescription] = useState<string>('Serviços de Corrida Moto / Extras');

  const saveLocalUnlockedServices = (newServices: string[]) => {
    setLocalUnlockedServices((prev) =>
      Array.from(new Set([...prev, ...newServices]))
    );
  };

  const [isMusicUnlocked, setIsMusicUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('pix_music_unlocked') === 'true';
  });

  // Firebase Auth is authoritative. localStorage is never used as proof of identity.
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState<boolean>(false);

  // Passenger Sessions State
  const [passengerSessions, setPassengerSessions] = useState<PassengerSession[]>([]);
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>(DEFAULT_SESSION_SETTINGS);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [passengerAuthUid, setPassengerAuthUid] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'driver' | 'passenger'>(() => {
    if (isDevEnv) {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'passenger') return 'passenger';
      }
      return 'driver';
    }
    return 'passenger';
  });

  // Passengers use Firebase Anonymous Auth so Firestore can enforce per-session ownership
  // without asking the passenger to create an account.
  useEffect(() => {
    if (viewMode !== 'passenger' || isGoogleAuthenticated) {
      setPassengerAuthUid(null);
      return;
    }

    let active = true;
    ensurePassengerAuth()
      .then((uid) => {
        if (active) setPassengerAuthUid(uid);
      })
      .catch((error) => {
        console.warn('Não foi possível iniciar a sessão segura do passageiro:', error);
        if (active) setPassengerAuthUid(null);
      });

    return () => {
      active = false;
    };
  }, [viewMode, isGoogleAuthenticated]);

  // Real-time synchronization with Firebase Firestore
  useEffect(() => {
    // Priority: URL query param (?driver=...) -> logged-in Google email -> default printed QR code (arcamos.j@gmail.com)
    const activeEmail = getEffectiveDriverEmail(driver.googleEmail);

    const unsubDriver = subscribeDriverProfile((profile) => {
      setDriver(profile);
    }, activeEmail);

    const unsubServices = subscribeServices((servicesList) => {
      setServices(servicesList);
    });

    const unsubSessions = subscribePassengerSessions(
      (sessionsList) => {
        setPassengerSessions(sessionsList);
      },
      {
        driverMode: viewMode === 'driver' && isGoogleAuthenticated,
        authUid: passengerAuthUid,
      }
    );

    const unsubSettings = subscribeSessionSettings((settings) => {
      setSessionSettings(settings);
    });

    return () => {
      unsubDriver();
      unsubServices();
      unsubSessions();
      unsubSettings();
    };
  }, [driver.googleEmail, isGoogleAuthenticated, viewMode, passengerAuthUid]);

  // Restore the authenticated driver from Firebase Auth, never from localStorage.
  useEffect(() => {
    return subscribeDriverAuth(async (authenticatedUser) => {
      if (!authenticatedUser) {
        setIsGoogleAuthenticated(false);
        localStorage.removeItem('pix_driver_google_auth');
        localStorage.removeItem('pix_driver_google_email');
        return;
      }

      setIsGoogleAuthenticated(true);
      // Email is kept only as a convenience cache/target hint; Firebase Auth remains authoritative.
      localStorage.setItem('pix_driver_google_email', authenticatedUser.email);

      const foundProfile = await fetchDriverProfileByEmail(authenticatedUser.email);
      if (foundProfile) {
        setDriver({
          ...foundProfile,
          googleAuthenticated: true,
          googleEmail: authenticatedUser.email,
          authUid: authenticatedUser.uid,
          name: foundProfile.name || authenticatedUser.name || 'Motorista Particular',
          photoUrl: foundProfile.photoUrl || authenticatedUser.photoUrl || '',
        });
      } else {
        setDriver({
          ...DEFAULT_DRIVER_PROFILE,
          name: authenticatedUser.name || 'Motorista Particular',
          photoUrl: authenticatedUser.photoUrl || '',
          googleAuthenticated: true,
          googleEmail: authenticatedUser.email,
          authUid: authenticatedUser.uid,
          pixKey: authenticatedUser.email,
          pixKeyType: 'email',
          receiverName: (authenticatedUser.name || 'Motorista Particular').toUpperCase(),
        });
      }
    });
  }, []);

  // Strict validation: match both Browser ID AND registered Passenger Name, AND verify status is active
  const currentBrowserId = getOrCreateBrowserId();
  const rawPassengerName = (
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('pix_registered_passenger_name') || ''
      : ''
  ).trim();
  const registeredName = rawPassengerName || 'Passageiro';

  const registeredSessionId =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('pix_registered_session_id') || ''
      : '';

  const currentPassengerSession = passengerSessions.find((s) => {
    if (s.status !== 'active') return false;
    if (registeredSessionId && s.id === registeredSessionId) {
      return true;
    }
    if (s.browserId !== currentBrowserId) return false;
    if (rawPassengerName && s.passengerName.trim().toLowerCase() !== rawPassengerName.toLowerCase()) {
      return false;
    }
    return true;
  });

  const displayPassengerName = currentPassengerSession?.passengerName || rawPassengerName || 'Passageiro';

  // Active passenger session unlocked services list from Firestore (authoritative)
  // Combine session-specific unlocks with global default unlocked services from sessionSettings
  const defaultUnlocked = sessionSettings.defaultUnlockedServices || [];
  const currentSessionUnlocked = currentPassengerSession
    ? Array.from(new Set([...defaultUnlocked, ...currentPassengerSession.unlockedServices]))
    : Array.from(new Set([...defaultUnlocked, ...localUnlockedServices]));

  const rawSet = new Set(currentSessionUnlocked);
  if (rawSet.has('spotify_music') || rawSet.has('2')) {
    rawSet.add('spotify_music');
    rawSet.add('2');
  }
  if (rawSet.has('wifi') || rawSet.has('1')) {
    rawSet.add('wifi');
    rawSet.add('1');
  }
  if (rawSet.has('charger') || rawSet.has('3')) {
    rawSet.add('charger');
    rawSet.add('3');
  }
  const allUnlockedServicesList = Array.from(rawSet);

  const passengerHasMusicUnlocked = Boolean(
    currentPassengerSession
      ? (currentPassengerSession.unlockedServices.includes('spotify_music') ||
         currentPassengerSession.unlockedServices.includes('2') ||
         currentPassengerSession.hasMusicUnlocked)
      : (localUnlockedServices.includes('spotify_music') || localUnlockedServices.includes('2'))
  );

  const effectiveMusicUnlocked =
    viewMode === 'driver' ? true : passengerHasMusicUnlocked;

  const passengerHasWifiUnlocked = Boolean(
    currentPassengerSession
      ? (currentPassengerSession.unlockedServices.includes('wifi') ||
         currentPassengerSession.unlockedServices.includes('1'))
      : (localUnlockedServices.includes('wifi') || localUnlockedServices.includes('1'))
  );

  const effectiveWifiUnlocked =
    viewMode === 'driver' ? true : passengerHasWifiUnlocked;

  // Firestore is authoritative for shared ride data; useRideSession is the local cache.
  useEffect(() => {
    if (
      ridePrice === 0 &&
      currentPassengerSession?.ridePrice &&
      currentPassengerSession.ridePrice > 0
    ) {
      setRidePrice(currentPassengerSession.ridePrice);
    }
  }, [currentPassengerSession?.ridePrice, ridePrice]);

  const handleUpdateRidePrice = (price: number) => {
    setRidePrice(price);
    if (currentPassengerSession) {
      savePassengerSession({
        ...currentPassengerSession,
        ridePrice: price,
      });
    }
  };

  // Save updated driver profile to Firestore
  const handleSaveDriver = (updatedDriver: DriverProfile) => {
    setDriver(updatedDriver);
    saveDriverProfile(updatedDriver);
  };

  // Save updated services catalog to Firestore
  const handleSaveServices = (updatedServices: AdditionalService[]) => {
    setServices(updatedServices);
    saveAllServices(updatedServices);
  };

  const effectivePurchasedProducts = currentPassengerSession?.purchasedProducts || localPurchasedProducts;

  const handleUpdateProductQuantity = (serviceId: string, delta: number) => {
    setProductQuantities((prev) => {
      const currentQty = prev[serviceId] || 0;
      const newQty = Math.max(0, currentQty + delta);
      const updated = { ...prev };
      if (newQty > 0) {
        updated[serviceId] = newQty;
      } else {
        delete updated[serviceId];
      }
      return updated;
    });

    setSelectedServiceIds((prev) => {
      const currentQty = (productQuantities[serviceId] || 0) + delta;
      if (currentQty > 0) {
        return prev.includes(serviceId) ? prev : [...prev, serviceId];
      } else {
        return prev.filter((id) => id !== serviceId);
      }
    });
  };

  // Toggle service selection or unlock state
  const handleToggleService = (serviceId: string) => {
    const isMusic = serviceId === 'spotify_music' || serviceId === '2';
    const isWifi = serviceId === 'wifi' || serviceId === '1';
    const isCharger = serviceId === 'charger' || serviceId === '3';

    const isCurrentlyUnlocked =
      allUnlockedServicesList.includes(serviceId) ||
      (isMusic && (allUnlockedServicesList.includes('spotify_music') || allUnlockedServicesList.includes('2'))) ||
      (isWifi && (allUnlockedServicesList.includes('wifi') || allUnlockedServicesList.includes('1'))) ||
      (isCharger && (allUnlockedServicesList.includes('charger') || allUnlockedServicesList.includes('3')));

    // In passenger view:
    // If the service is already unlocked/paid, passenger CANNOT disable it.
    // If NOT unlocked, passenger toggles selection ONLY to calculate total payment (DO NOT unlock!)
    if (viewMode === 'passenger') {
      if (isCurrentlyUnlocked) {
        return;
      }
      setSelectedServiceIds((prev) =>
        prev.includes(serviceId)
          ? prev.filter((id) => id !== serviceId)
          : [...prev, serviceId]
      );
      return;
    }

    // In driver view:
    // Driver HAS administrative override powers to toggle unlock/lock in Firestore for ALL active sessions
    const activeSessions = passengerSessions.filter((s) => s.status === 'active');
    const nextState = !isCurrentlyUnlocked;

    const defaultList = sessionSettings.defaultUnlockedServices || [];
    const keysToToggle = isMusic
      ? ['spotify_music', '2']
      : isWifi
      ? ['wifi', '1']
      : isCharger
      ? ['charger', '3']
      : [serviceId];

    let updatedDefault = [...defaultList];
    if (nextState) {
      keysToToggle.forEach((k) => {
        if (!updatedDefault.includes(k)) updatedDefault.push(k);
      });
    } else {
      updatedDefault = updatedDefault.filter((k) => !keysToToggle.includes(k));
    }

    saveSessionSettings({
      ...sessionSettings,
      defaultUnlockedServices: updatedDefault,
    });

    if (activeSessions.length > 0) {
      activeSessions.forEach((sess) => {
        toggleSessionServiceUnlock(sess.id, serviceId, sess.unlockedServices, nextState);
      });
    } else {
      // Create new active session if none exists
      const newSessionId = registeredSessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newSession: PassengerSession = {
        id: newSessionId,
        passengerName: registeredName || 'Passageiro',
        browserId: currentBrowserId,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        status: 'active',
        unlockedServices: updatedDefault,
        hasMusicUnlocked: isMusic,
      };
      savePassengerSession(newSession);
    }
  };

  // Compute if ride is already paid for this passenger session
  const isRidePaid = Boolean(
    currentPassengerSession
      ? currentPassengerSession.isRidePaid
      : localRidePaidState
  );

  const paidRideAmount = currentPassengerSession
    ? currentPassengerSession.paidRideAmount
    : localPaidRideAmount;

  const handleToggleRidePaid = () => {
    const nextState = !isRidePaid;
    setLocalRidePaidState(nextState);

    let targetSession = currentPassengerSession || passengerSessions.find((s) => s.id === activeSessionId);
    if (targetSession) {
      savePassengerSession({
        ...targetSession,
        isRidePaid: nextState,
        paidRideAmount: nextState ? (ridePrice || targetSession.paidRideAmount || 0) : 0,
      });
    }
  };

  // Calculate sum of selected services and products
  const selectedServicesTotal = services.reduce((acc, curr) => {
    const isProd = getItemType(curr) === 'produto';
    if (isProd) {
      const qty = productQuantities[curr.id] || (selectedServiceIds.includes(curr.id) ? 1 : 0);
      return acc + curr.price * qty;
    } else {
      if (selectedServiceIds.includes(curr.id)) {
        return acc + curr.price;
      }
    }
    return acc;
  }, 0);

  const totalAmount = selectedServicesTotal + selectedTip;

  const handleClearTotal = () => {
    setRidePrice(0);
    setSelectedServiceIds([]);
    setProductQuantities({});
    setSelectedTip(0);
  };

  // Requirement 3: Generate Mercado Pago QR code on click
  const handleOpenMercadoPagoModal = (amount?: number, description?: string) => {
    const finalAmt = amount !== undefined && amount > 0 ? amount : (totalAmount > 0 ? totalAmount : 2.0);
    const finalDesc = description || (selectedServiceIds.length > 0 ? 'Pagamento de Adicionais Selecionados' : 'Escolha de Músicas no Som do Veículo');
    setMpModalAmount(finalAmt);
    setMpModalDescription(finalDesc);
    setIsMpModalOpen(true);
  };

  // Requirement 1 & 2: Unlock services (Wi-Fi, Spotify, etc.) and record purchased products on payment
  const handlePaymentSuccess = async (payment: MercadoPagoPayment) => {
    playPaymentSuccessSound();

    const servicesToUnlock: string[] = [];
    const productsToPurchase: Record<string, number> = {};

    const desc = (payment.description || mpModalDescription || '').toLowerCase();
    const isWifiPayment =
      desc.includes('wi-fi') ||
      desc.includes('wifi') ||
      desc.includes('internet') ||
      payment.serviceId === '1' ||
      payment.serviceId === 'wifi';

    const isMusicPayment =
      desc.includes('música') ||
      desc.includes('spotify') ||
      desc.includes('som') ||
      payment.serviceId === '2' ||
      payment.serviceId === 'spotify_music';

    if (isWifiPayment) {
      servicesToUnlock.push('wifi', '1');
    }

    if (isMusicPayment) {
      servicesToUnlock.push('spotify_music', '2');
    }

    // Separate selected items into Services (unlockable) vs Products (purchasable by quantity)
    if (selectedServiceIds.length > 0) {
      selectedServiceIds.forEach((id) => {
        const found = services.find((s) => s.id === id);
        if (found && getItemType(found) === 'produto') {
          const qty = productQuantities[id] || 1;
          productsToPurchase[id] = (productsToPurchase[id] || 0) + qty;
        } else {
          servicesToUnlock.push(id);
          if (id === 'wifi' || id === '1') servicesToUnlock.push('wifi', '1');
          if (id === 'spotify_music' || id === '2') servicesToUnlock.push('spotify_music', '2');
        }
      });
    }

    const uniqueServicesToUnlock = Array.from(new Set(servicesToUnlock));

    let targetSession = currentPassengerSession || passengerSessions.find((s) => s.id === activeSessionId);

    // Save purchased products if any
    if (Object.keys(productsToPurchase).length > 0) {
      saveLocalPurchasedProducts(productsToPurchase);
      if (targetSession) {
        recordPurchasedProductsToSession(
          targetSession.id,
          productsToPurchase,
          targetSession.purchasedProducts || {}
        );
      }
    }

    if (uniqueServicesToUnlock.length > 0) {
      // Save locally for instant client UI response
      saveLocalUnlockedServices(uniqueServicesToUnlock);

      // Sync with Firestore active session
      if (targetSession) {
        uniqueServicesToUnlock.forEach((sId) => {
          toggleSessionServiceUnlock(
            targetSession.id,
            sId,
            targetSession.unlockedServices,
            true
          );
        });
      } else {
        // Create new session in Firestore if no active session exists
        const authUid = await ensurePassengerAuth();
        const newSessionId = registeredSessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newSession: PassengerSession = {
          id: newSessionId,
          passengerName: registeredName || 'Passageiro',
          browserId: currentBrowserId,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          status: 'active',
          unlockedServices: uniqueServicesToUnlock,
          purchasedProducts: productsToPurchase,
          hasMusicUnlocked:
            uniqueServicesToUnlock.includes('spotify_music') || uniqueServicesToUnlock.includes('2'),
          paidAmount: payment.amount || 0,
          paymentId: payment.paymentId || '',
          authUid,
        };
        savePassengerSession(newSession);
        try {
          localStorage.setItem('pix_registered_session_id', newSessionId);
        } catch (e) {
          console.error(e);
        }
      }
    }

    // Reset selection cart after payment
    setSelectedServiceIds([]);
    setProductQuantities({});

    // Mark ride as paid ONLY IF ridePrice was explicitly set (> 0) OR if description explicitly specifies ride/corrida
    const isExplicitRidePayment =
      ridePrice > 0 ||
      desc.includes('corrida') ||
      desc.includes('viagem') ||
      desc.includes('trajeto');

    if (isExplicitRidePayment) {
      const paidVal = ridePrice || payment.amount || 0;
      if (paidVal > 0) {
        setLocalRidePaidState(true);
        setLocalPaidRideAmount(paidVal);

        let targetSession = currentPassengerSession || passengerSessions.find((s) => s.id === activeSessionId);
        if (targetSession) {
          savePassengerSession({
            ...targetSession,
            isRidePaid: true,
            paidRideAmount: paidVal,
          });
        }
      }
    }

    // Clear selected items, ride price, and tips after successful payment
    setRidePrice(0);
    setSelectedServiceIds([]);
    setSelectedTip(0);
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar as configurações padrão iniciais no banco de dados Firestore?')) {
      saveDriverProfile(DEFAULT_DRIVER_PROFILE);
      saveAllServices(DEFAULT_SERVICES);
      setSelectedServiceIds([]);
      setSelectedTip(0);
    }
  };

  const handleScrollToPix = () => {
    const el = document.getElementById('pix-section-wrapper');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleToggleViewMode = () => {
    if (viewMode === 'passenger') {
      if (!isGoogleAuthenticated) {
        setIsGoogleAuthModalOpen(true);
      } else {
        setViewMode('driver');
      }
    } else {
      setViewMode('passenger');
    }
  };

  const handleGoogleLoginSuccess = async (googleUser: AuthenticatedDriver) => {
    setIsGoogleAuthenticated(true);
    localStorage.removeItem('pix_driver_google_auth');
    localStorage.setItem('pix_driver_google_email', googleUser.email);

    // Consult Firestore database to check if this Google account already exists
    const existingProfile = await fetchDriverProfileByEmail(googleUser.email);

    if (existingProfile) {
      // ACCOUNT ALREADY EXISTS IN DATABASE:
      // Preserve existing profile data completely without overwriting with Google API defaults
      const preservedProfile: DriverProfile = {
        ...existingProfile,
        googleAuthenticated: true,
        googleEmail: googleUser.email,
        authUid: googleUser.uid,
        name: (existingProfile.name && existingProfile.name !== 'Motorista Particular')
          ? existingProfile.name
          : (googleUser.name || 'Motorista Particular'),
        photoUrl: existingProfile.photoUrl || googleUser.photoUrl,
      };
      setDriver(preservedProfile);
      await saveDriverProfile(preservedProfile);
    } else {
      // FIRST ACCESS EVER FOR THIS GOOGLE ACCOUNT:
      const newProfile: DriverProfile = {
        ...DEFAULT_DRIVER_PROFILE,
        name: googleUser.name || 'Motorista Particular',
        photoUrl: googleUser.photoUrl || '',
        googleAuthenticated: true,
        googleEmail: googleUser.email,
        authUid: googleUser.uid,
        pixKey: googleUser.email,
        pixKeyType: 'email',
        receiverName: (googleUser.name || 'Motorista Particular').toUpperCase(),
      };
      setDriver(newProfile);
      await saveDriverProfile(newProfile);
    }

    setIsGoogleAuthModalOpen(false);
    setViewMode('driver');
  };

  const handleGoogleLogout = async () => {
    try {
      await signOutDriver();
    } finally {
      setIsGoogleAuthenticated(false);
      localStorage.removeItem('pix_driver_google_auth');
      localStorage.removeItem('pix_driver_google_email');
      setDriver(DEFAULT_DRIVER_PROFILE);
      setViewMode('passenger');
      setIsLogoutConfirmModalOpen(false);
    }
  };

  const handleOpenEditModal = () => {
    if (viewMode === 'passenger') return;
    if (!isGoogleAuthenticated) {
      setIsGoogleAuthModalOpen(true);
    } else {
      setIsEditModalOpen(true);
    }
  };

  const ExperienceApp = viewMode === 'driver' ? DriverApp : PassengerApp;

  return (
    <ExperienceApp
      header={
        <Header
          driver={driver}
          passengerName={displayPassengerName}
          onOpenEditModal={handleOpenEditModal}
          onOpenMercadoPagoModal={() => setIsMercadoPagoSettingsModalOpen(true)}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
          isDevEnv={isDevEnv}
          onGoogleLogout={() => setIsLogoutConfirmModalOpen(true)}
        />
      }
    >

      <main className="max-w-xl mx-auto px-4 mt-5 space-y-5">
        {/* Development Environment Administrative Banners */}
        {isDevEnv && (
          <>
            {viewMode === 'driver' && !driver.googleAuthenticated && (
              <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-900 animate-fadeIn">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-700 font-bold">
                    <Database className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Sincronização com Conta Google (Painel do Motorista)
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Faça o login com sua Conta Google para sincronizar seu Nome, Foto e Chaves reais no banco de dados. Os passageiros verão esses dados no link público sem precisar fazer login.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsGoogleAuthModalOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shrink-0 shadow-md active:scale-95"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Conectar Conta Google</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Central Passenger Session Management System */}
        <PassengerSessionManager
          viewMode={viewMode}
          sessions={passengerSessions}
          settings={sessionSettings}
          services={services}
          activeSessionId={activeSessionId}
          onSetActiveSessionId={setActiveSessionId}
          isDevEnv={isDevEnv}
          driverEmail={getEffectiveDriverEmail(driver.googleEmail)}
        />

        {/* Requirement 1: Pix Section with QR Code and Email Pix Key */}
        <div id="pix-section-wrapper">
          <PixSection
            driver={driver}
            totalAmount={totalAmount}
            ridePrice={ridePrice}
            selectedServicesTotal={selectedServicesTotal}
            selectedTip={selectedTip}
            selectedServicesCount={selectedServiceIds.length}
            onClearTotal={handleClearTotal}
            viewMode={viewMode}
            onUpdateDriver={(updated) => {
              setDriver(updated);
              saveDriverProfile(updated);
            }}
          />
        </div>

        {/* Wi-Fi Connection & QR Code Section (Rendered right above Spotify) */}
        <WifiController
          driver={driver}
          isUnlocked={effectiveWifiUnlocked}
          isDriverView={viewMode === 'driver'}
          onOpenDriverConfig={handleOpenEditModal}
        />

        {/* Spotify Music Controller Section */}
        {driver.showSpotifyController !== false && (
          <SpotifyController
            isDriverView={viewMode === 'driver'}
            onOpenDriverConfig={handleOpenEditModal}
            isMusicUnlocked={effectiveMusicUnlocked}
            onUnlockClick={() =>
              handleOpenMercadoPagoModal(
                2.0,
                'Liberação do Serviço de Escolha de Músicas no Som do Veículo'
              )
            }
          />
        )}

        {/* Requirement 2: Additional Services Table / List */}
        <ServicesList
          services={services}
          selectedServiceIds={selectedServiceIds}
          productQuantities={productQuantities}
          purchasedProducts={effectivePurchasedProducts}
          unlockedServiceIds={allUnlockedServicesList}
          isDriverView={viewMode === 'driver'}
          onToggleService={handleToggleService}
          onUpdateProductQuantity={handleUpdateProductQuantity}
          onOpenDriverEditModal={handleOpenEditModal}
        />

        {/* Voluntary Driver Tip Section */}
        <TipSection
          selectedTip={selectedTip}
          onSelectTip={(amt) => setSelectedTip(amt)}
        />

        {/* Trust & Safe Footer Badge */}
        <footer className="pt-2 text-center text-xs text-slate-500 space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Pagamento direto e seguro via Pix sem taxas intermediárias</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Página desenvolvida para facilitar pagamentos e serviços adicionais durante a corrida.
          </p>
        </footer>
      </main>

      {/* Floating total summary bar when passenger selects options */}
      <TotalSummaryBar
        ridePrice={ridePrice}
        selectedServicesCount={selectedServiceIds.length}
        selectedServicesTotal={selectedServicesTotal}
        selectedTip={selectedTip}
        totalAmount={totalAmount}
        onScrollToPix={handleScrollToPix}
        onPayClick={() => {
          const descParts: string[] = [];
          if (selectedServicesTotal > 0) descParts.push(`Serviços A Bordo (${selectedServiceIds.length})`);
          if (selectedTip > 0) descParts.push(`Caixinha`);
          const description = descParts.length > 0 ? descParts.join(' + ') : 'Pagamento via Pix';

          handleOpenMercadoPagoModal(totalAmount, description);
        }}
      />

      {/* Mercado Pago Checkout & Instant Payment Modal */}
      <MercadoPagoModal
        isOpen={isMpModalOpen}
        onClose={() => setIsMpModalOpen(false)}
        totalAmount={mpModalAmount}
        description={mpModalDescription}
        selectedServicesCount={selectedServiceIds.length}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Driver Configuration Drawer/Modal */}
      <DriverEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        driver={driver}
        services={services}
        onSaveDriver={handleSaveDriver}
        onSaveServices={handleSaveServices}
        onResetDefaults={handleResetDefaults}
        onOpenPrintModal={() => setIsPrintModalOpen(true)}
        onOpenMercadoPagoModal={() => setIsMercadoPagoSettingsModalOpen(true)}
      />

      {/* Printable Seat Headrest Sign Modal */}
      <PrintSignModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        driver={driver}
        services={services}
        onSaveDriver={handleSaveDriver}
      />

      {/* Google Authentication Modal for Driver Access */}
      <GoogleAuthModal
        isOpen={isGoogleAuthModalOpen}
        onClose={() => setIsGoogleAuthModalOpen(false)}
        onSuccess={handleGoogleLoginSuccess}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutConfirmModalOpen}
        onClose={() => setIsLogoutConfirmModalOpen(false)}
        onConfirm={handleGoogleLogout}
        userEmail={driver.googleEmail}
      />

      {/* Mercado Pago Settings & Webhook Modal */}
      <MercadoPagoSettingsModal
        isOpen={isMercadoPagoSettingsModalOpen}
        onClose={() => setIsMercadoPagoSettingsModalOpen(false)}
      />

      {/* Blocking Full-Screen Registration Screen for Passenger View */}
      <PassengerRegistrationModal
        isOpen={viewMode === 'passenger' && !passengerSessions.some((s) => s.browserId === getOrCreateBrowserId() && s.status === 'active')}
        settings={sessionSettings}
        driverName={driver.name}
        carModel={driver.carModel}
        driverEmail={getEffectiveDriverEmail(driver.googleEmail)}
        onRegistered={(newSessId, initialRidePrice) => {
          setActiveSessionId(newSessId);
          if (initialRidePrice && initialRidePrice > 0) {
            handleUpdateRidePrice(initialRidePrice);
          }
        }}
      />
    </ExperienceApp>
  );
}

