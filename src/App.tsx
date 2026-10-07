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
import { DriverProfile, AdditionalService, MercadoPagoPayment, PassengerSession, SessionSettings, Ride, getItemType } from './types';
import { HelpCircle, ShieldCheck, Eye, Smartphone, ArrowRight, Sparkles, LogOut, Database, Users } from 'lucide-react';
import { playPaymentSuccessSound } from './utils/audio';
import { PassengerSessionManager } from './components/PassengerSessionManager';
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
  subscribeRide,
  subscribeActiveRideForPassenger,
  subscribeDriverRides,
  saveRide,
  updateRideStatus,
} from './lib/firebase';

import { isDevEnvironment, getDriverEmailFromUrl, getEffectiveDriverEmail, getExperienceFromUrl, getRideIdFromUrl, navigateToExperience, getPublicPassengerUrl } from './utils/urlHelper';
import { AuthenticatedDriver, ensurePassengerAuth, signOutDriver, subscribeDriverAuth } from './lib/auth';
import { DriverApp } from './views/DriverApp';
import { PassengerApp } from './views/PassengerApp';
import { DriverRidePanel } from './components/DriverRidePanel';
import { DriverHistorySummary } from './components/DriverHistorySummary';
import { DriverRidePresets } from './components/DriverRidePresets';
import { useRideSession } from './state/useRideSession';
import { normalizeServiceId, normalizeServiceIds, SERVICE_IDS } from './domain/serviceIds';

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
  const [mpModalServiceIds, setMpModalServiceIds] = useState<string[]>([]);

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
  const [isAuthResolved, setIsAuthResolved] = useState<boolean>(false);

  // Passenger Sessions State
  const [passengerSessions, setPassengerSessions] = useState<PassengerSession[]>([]);
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>(DEFAULT_SESSION_SETTINGS);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [passengerAuthUid, setPassengerAuthUid] = useState<string | null>(null);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [driverRides, setDriverRides] = useState<Ride[]>([]);
  const rideIdFromUrl = getRideIdFromUrl();
  const driverEmailFromUrl = getDriverEmailFromUrl();

  const [viewMode, setViewMode] = useState<'driver' | 'passenger'>(() => getExperienceFromUrl());

  useEffect(() => {
    const syncRoute = () => setViewMode(getExperienceFromUrl());
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  useEffect(() => {
    if (viewMode === 'passenger') {
      if (!passengerAuthUid) {
        setCurrentRide(null);
        return () => {};
      }
      if (rideIdFromUrl) {
        return subscribeRide(rideIdFromUrl, setCurrentRide);
      }
      return subscribeActiveRideForPassenger(setCurrentRide, {
        driverUid: driver.authUid || null,
        driverEmail: driverEmailFromUrl || driver.googleEmail || null,
      });
    }
    return subscribeDriverRides(driver.authUid || null, (rides) => {
      setDriverRides(rides);
      const active = rides.find((ride) => ride.status === 'active') || null;
      setCurrentRide(active);
      if (active?.passengerSessionId) setActiveSessionId(active.passengerSessionId);
    });
  }, [
    viewMode,
    rideIdFromUrl,
    passengerAuthUid,
    driver.authUid,
    driver.googleEmail,
    driverEmailFromUrl,
  ]);

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
    const activeEmail =
      viewMode === 'driver'
        ? getEffectiveDriverEmail(driver.googleEmail)
        : undefined;

    // Temporary test mode: passengers see the latest connected driver's public profile.
    // Later this will be scoped by the QR-code / ride relationship.
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
        driverUid: driver.authUid || null,
        rideId: viewMode === 'passenger' ? (rideIdFromUrl || currentRide?.id || null) : null,
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
  }, [driver.googleEmail, driver.authUid, isGoogleAuthenticated, viewMode, passengerAuthUid, rideIdFromUrl, currentRide?.id]);

  useEffect(() => {
    if (viewMode !== 'driver' || !currentRide) return;
    const linkedSession = passengerSessions.find(
      (session) =>
        session.status === 'active' &&
        session.rideId === currentRide.id &&
        (!currentRide.driverUid || session.driverUid === currentRide.driverUid)
    );
    if (linkedSession && linkedSession.id !== activeSessionId) {
      setActiveSessionId(linkedSession.id);
    }
  }, [viewMode, currentRide?.id, currentRide?.driverUid, passengerSessions, activeSessionId]);

  // Passenger entry is frictionless, but only inside a valid active ride.
  useEffect(() => {
    if (
      viewMode !== 'passenger' ||
      !passengerAuthUid ||
      !currentRide ||
      currentRide.status !== 'active' ||
      (rideIdFromUrl && currentRide.id !== rideIdFromUrl)
    ) return;

    const existing = passengerSessions.find(
      (session) =>
        session.authUid === passengerAuthUid &&
        session.rideId === currentRide.id
    );

    if (existing) {
      setActiveSessionId(existing.status === 'active' ? existing.id : null);
      try {
        localStorage.setItem('pix_registered_session_id', existing.id);
      } catch {}
      return;
    }

    const sessionId = `sess_${currentRide.id}_${passengerAuthUid}`;
    const nowIso = new Date().toISOString();
    const session: PassengerSession = {
      id: sessionId,
      passengerName: 'Passageiro',
      browserId: getOrCreateBrowserId(),
      createdAt: nowIso,
      lastActiveAt: nowIso,
      status: 'active',
      unlockedServices: normalizeServiceIds(currentRide.defaultUnlockedServices || []),
      hasMusicUnlocked: normalizeServiceIds(
        currentRide.defaultUnlockedServices || []
      ).includes(SERVICE_IDS.MUSIC),
      ridePrice: currentRide.price,
      rideId: currentRide.id,
      driverUid: currentRide.driverUid,
      driverEmail: currentRide.driverEmail,
      authUid: passengerAuthUid,
    };

    savePassengerSession(session);
    setActiveSessionId(sessionId);
    try {
      localStorage.setItem('pix_registered_session_id', sessionId);
      localStorage.removeItem('pix_registered_passenger_name');
    } catch {}
  }, [
    viewMode,
    passengerAuthUid,
    passengerSessions,
    currentRide,
    rideIdFromUrl,
  ]);

  // Restore the authenticated driver from Firebase Auth, never from localStorage.
  useEffect(() => {
    return subscribeDriverAuth(async (authenticatedUser) => {
      if (!authenticatedUser) {
        setIsGoogleAuthenticated(false);
        setIsAuthResolved(true);
        localStorage.removeItem('pix_driver_google_auth');
        localStorage.removeItem('pix_driver_google_email');
        return;
      }

      setIsGoogleAuthenticated(true);
      setIsAuthResolved(true);
      // Email is kept only as a convenience cache/target hint; Firebase Auth remains authoritative.
      localStorage.setItem('pix_driver_google_email', authenticatedUser.email);

      const foundProfile = await fetchDriverProfileByEmail(authenticatedUser.email);
      const resolvedProfile: DriverProfile = foundProfile
        ? {
            ...foundProfile,
            googleAuthenticated: true,
            googleEmail: authenticatedUser.email,
            authUid: authenticatedUser.uid,
            name: foundProfile.name || authenticatedUser.name || 'Motorista Particular',
            photoUrl: foundProfile.photoUrl || authenticatedUser.photoUrl || '',
          }
        : {
            ...DEFAULT_DRIVER_PROFILE,
            name: authenticatedUser.name || 'Motorista Particular',
            photoUrl: authenticatedUser.photoUrl || '',
            googleAuthenticated: true,
            googleEmail: authenticatedUser.email,
            authUid: authenticatedUser.uid,
            pixKey: authenticatedUser.email,
            pixKeyType: 'email',
            receiverName: (authenticatedUser.name || 'Motorista Particular').toUpperCase(),
          };

      setDriver(resolvedProfile);
      // Promote the authenticated driver's latest profile to main_profile so passenger
      // devices receive the same driver/Pix data in real time.
      await saveDriverProfile(resolvedProfile);
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
    const effectiveRideId = rideIdFromUrl || currentRide?.id;
    if (effectiveRideId && s.rideId !== effectiveRideId) return false;
    if (viewMode === 'passenger' && passengerAuthUid && s.authUid !== passengerAuthUid) return false;
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
  const defaultUnlocked = currentRide?.defaultUnlockedServices || sessionSettings.defaultUnlockedServices || [];
  const currentSessionUnlocked = currentPassengerSession
    ? Array.from(new Set([...defaultUnlocked, ...currentPassengerSession.unlockedServices]))
    : Array.from(new Set(defaultUnlocked));

  const allUnlockedServicesList = normalizeServiceIds(currentSessionUnlocked);

  const passengerHasMusicUnlocked = Boolean(
    currentPassengerSession
      ? currentPassengerSession.unlockedServices.includes(SERVICE_IDS.MUSIC) ||
        currentPassengerSession.hasMusicUnlocked
      : localUnlockedServices.includes(SERVICE_IDS.MUSIC)
  );

  const effectiveMusicUnlocked =
    viewMode === 'driver' ? true : passengerHasMusicUnlocked;

  const passengerHasWifiUnlocked = Boolean(
    currentPassengerSession
      ? currentPassengerSession.unlockedServices.includes(SERVICE_IDS.WIFI)
      : localUnlockedServices.includes(SERVICE_IDS.WIFI)
  );

  const effectiveWifiUnlocked =
    viewMode === 'driver' ? true : passengerHasWifiUnlocked;

  // Firestore is authoritative for shared ride data; useRideSession is only a UI cache.
  useEffect(() => {
    const authoritativePrice = currentRide?.price ?? currentPassengerSession?.ridePrice;
    if (authoritativePrice !== undefined && authoritativePrice !== ridePrice) {
      setRidePrice(authoritativePrice);
    }
  }, [currentRide?.price, currentPassengerSession?.ridePrice, ridePrice]);

  const handleUpdateRidePrice = (price: number) => {
    setRidePrice(price);
    if (currentRide) {
      saveRide({ ...currentRide, price });
    }
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
    const canonicalId = normalizeServiceId(serviceId);
    const isCurrentlyUnlocked = allUnlockedServicesList.includes(canonicalId);

    if (viewMode === 'passenger') {
      if (isCurrentlyUnlocked) return;
      setSelectedServiceIds((prev) => {
        const normalized = normalizeServiceIds(prev);
        return normalized.includes(canonicalId)
          ? normalized.filter((id) => id !== canonicalId)
          : [...normalized, canonicalId];
      });
      return;
    }

    const activeSessions = passengerSessions.filter((s) => s.status === 'active');
    const nextState = !isCurrentlyUnlocked;
    const defaultList = normalizeServiceIds(sessionSettings.defaultUnlockedServices || []);
    const updatedDefault = nextState
      ? normalizeServiceIds([...defaultList, canonicalId])
      : defaultList.filter((id) => id !== canonicalId);

    saveSessionSettings({
      ...sessionSettings,
      defaultUnlockedServices: updatedDefault,
    });

    if (activeSessions.length > 0) {
      activeSessions.forEach((sess) => {
        toggleSessionServiceUnlock(
          sess.id,
          canonicalId,
          sess.unlockedServices,
          nextState
        );
      });
    } else {
      const newSessionId =
        registeredSessionId ||
        `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newSession: PassengerSession = {
        id: newSessionId,
        passengerName: registeredName || 'Passageiro',
        browserId: currentBrowserId,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        status: 'active',
        unlockedServices: updatedDefault,
        hasMusicUnlocked: updatedDefault.includes(SERVICE_IDS.MUSIC),
        authUid: driver.authUid,
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


  const handleStartRide = async (price: number) => {
    if (!driver.authUid || !driver.googleEmail) {
      setIsGoogleAuthModalOpen(true);
      return;
    }

    const existingActive =
      currentRide?.status === 'active'
        ? currentRide
        : driverRides.find((ride) => ride.status === 'active');

    if (existingActive) {
      const updated = { ...existingActive, price: Math.max(0, price || existingActive.price || 0) };
      await saveRide(updated);
      setCurrentRide(updated);
      setRidePrice(updated.price);
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(
      now.getTime() + Math.max(1, sessionSettings.autoExpireMinutes || 30) * 60_000
    ).toISOString();
    const rideId = `ride_${driver.authUid.slice(0, 10)}_${Date.now()}`;

    const newRide: Ride = {
      id: rideId,
      driverUid: driver.authUid,
      driverEmail: driver.googleEmail.trim().toLowerCase(),
      status: 'active',
      paymentStatus: 'unpaid',
      price: Math.max(0, price || 0),
      createdAt: nowIso,
      startedAt: nowIso,
      expiresAt,
      defaultUnlockedServices: normalizeServiceIds(
        sessionSettings.defaultUnlockedServices || []
      ),
    };

    await saveRide(newRide);
    setCurrentRide(newRide);
    setActiveSessionId(null);
    setRidePrice(newRide.price);
    setLocalRidePaidState(false);
    setLocalPaidRideAmount(0);
    setSelectedServiceIds([]);
    setProductQuantities({});
    setSelectedTip(0);
  };

  const handleEndRide = async () => {
    const targetRide =
      currentRide ||
      driverRides.find((ride) => ride.status === 'active');

    if (targetRide) {
      const endedAt = new Date().toISOString();
      await updateRideStatus(targetRide.id, 'completed', { endedAt });

      const rideSessions = passengerSessions.filter(
        (session) => session.rideId === targetRide.id && session.status === 'active'
      );
      await Promise.all(
        rideSessions.map((session) =>
          savePassengerSession({
            ...session,
            status: 'closed',
            lastActiveAt: endedAt,
          })
        )
      );
    }

    setCurrentRide(null);
    setActiveSessionId(null);
    setRidePrice(0);
    setLocalRidePaidState(false);
    setLocalPaidRideAmount(0);
    setSelectedServiceIds([]);
    setProductQuantities({});
    setSelectedTip(0);
  };

  useEffect(() => {
    if (
      viewMode !== 'driver' ||
      !isGoogleAuthenticated ||
      !currentRide ||
      currentRide.status !== 'active' ||
      !currentRide.expiresAt
    ) return;

    const remaining = new Date(currentRide.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      updateRideStatus(currentRide.id, 'expired', { endedAt: new Date().toISOString() });
      return;
    }

    const timer = window.setTimeout(() => {
      updateRideStatus(currentRide.id, 'expired', { endedAt: new Date().toISOString() });
    }, Math.min(remaining, 2_147_000_000));

    return () => window.clearTimeout(timer);
  }, [viewMode, isGoogleAuthenticated, currentRide?.id, currentRide?.status, currentRide?.expiresAt]);

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
  const handleOpenMercadoPagoModal = (
    amount?: number,
    description?: string,
    serviceIdsOverride?: string[]
  ) => {
    const finalAmt = amount !== undefined && amount > 0 ? amount : (totalAmount > 0 ? totalAmount : 2.0);
    const finalDesc = description || (selectedServiceIds.length > 0 ? 'Pagamento de Adicionais Selecionados' : 'Escolha de Músicas no Som do Veículo');
    setMpModalAmount(finalAmt);
    setMpModalDescription(finalDesc);
    setMpModalServiceIds(
      normalizeServiceIds(serviceIdsOverride && serviceIdsOverride.length > 0 ? serviceIdsOverride : selectedServiceIds)
    );
    setIsMpModalOpen(true);
  };

  // Payment effects are persisted only after the backend verifies Mercado Pago.
  const handlePaymentSuccess = async (payment: MercadoPagoPayment) => {
    const approved = payment.status === 'approved' && Boolean(payment.paymentActivated);
    if (!approved) return;

    if (payment.rideId && currentRide && payment.rideId !== currentRide.id) {
      console.warn('Pagamento aprovado pertence a outra corrida; ignorando atualização local.');
      return;
    }

    const unlockedFromPayment = normalizeServiceIds(payment.serviceIds || []);

    playPaymentSuccessSound();
    saveLocalUnlockedServices(unlockedFromPayment);

    if (payment.passengerSessionId && unlockedFromPayment.length > 0) {
      setPassengerSessions((prev) =>
        prev.map((session) =>
          session.id === payment.passengerSessionId
            ? {
                ...session,
                unlockedServices: normalizeServiceIds([
                  ...session.unlockedServices,
                  ...unlockedFromPayment,
                ]),
                hasMusicUnlocked:
                  session.hasMusicUnlocked ||
                  unlockedFromPayment.includes(SERVICE_IDS.MUSIC),
              }
            : session
        )
      );
    }

    setSelectedServiceIds([]);
    setProductQuantities({});
    setSelectedTip(0);
    setMpModalServiceIds([]);
    setIsMpModalOpen(false);

    if (payment.rideId && currentRide?.id === payment.rideId) {
      setCurrentRide({
        ...currentRide,
        paymentStatus: currentRide.paymentStatus,
        paymentId: payment.paymentId,
      });
    }
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
        navigateToExperience('driver');
        setIsGoogleAuthModalOpen(true);
      } else {
        navigateToExperience('driver');
      }
    } else {
      navigateToExperience('passenger', null, getEffectiveDriverEmail(driver.googleEmail));
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
    navigateToExperience('driver');
  };

  const handleGoogleLogout = async () => {
    try {
      await signOutDriver();
    } finally {
      setIsGoogleAuthenticated(false);
      localStorage.removeItem('pix_driver_google_auth');
      localStorage.removeItem('pix_driver_google_email');
      setDriver(DEFAULT_DRIVER_PROFILE);
      navigateToExperience('passenger', null, getEffectiveDriverEmail());
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

  const activePassengerUrl = currentRide
    ? getPublicPassengerUrl(driver.customPublicUrl, currentRide.driverEmail, currentRide.id)
    : undefined;

  useEffect(() => {
    if (viewMode === 'driver' && isAuthResolved && !isGoogleAuthenticated) {
      setIsGoogleAuthModalOpen(true);
    }
  }, [viewMode, isAuthResolved, isGoogleAuthenticated]);

  if (viewMode === 'driver' && isAuthResolved && !isGoogleAuthenticated) {
    return (
      <DriverApp
        header={
          <Header
            driver={driver}
            onOpenEditModal={() => setIsGoogleAuthModalOpen(true)}
            viewMode="driver"
            onToggleViewMode={() => navigateToExperience('passenger')}
            isDevEnv={true}
          />
        }
      >
        <main className="max-w-xl mx-auto px-4 mt-8">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
            <h2 className="font-black text-slate-900 text-lg">Área do motorista</h2>
            <p className="text-sm text-slate-500 mt-2">
              Faça login com sua Conta Google para acessar corridas, configurações e histórico.
            </p>
            <button
              type="button"
              onClick={() => setIsGoogleAuthModalOpen(true)}
              className="mt-5 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-black"
            >
              Entrar com Google
            </button>
          </section>
        </main>
        <GoogleAuthModal
          isOpen={isGoogleAuthModalOpen}
          onClose={() => navigateToExperience('passenger')}
          onSuccess={handleGoogleLoginSuccess}
        />
      </DriverApp>
    );
  }

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
          isDevEnv={isDevEnv || viewMode === 'driver'}
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

        {viewMode === 'driver' && (
          <DriverRidePresets
            onSelect={(preset) => {
              setRidePrice(preset.defaultPrice);
              saveSessionSettings({
                ...sessionSettings,
                autoExpireMinutes: preset.autoExpireMinutes,
                defaultUnlockedServices: normalizeServiceIds(preset.unlockedServices),
              });
            }}
          />
        )}

        {viewMode === 'driver' && (
          <DriverRidePanel
            activeSession={
              passengerSessions.find((session) => session.id === activeSessionId) ||
              passengerSessions.find((session) => session.status === 'active')
            }
            ridePrice={ridePrice}
            isRidePaid={isRidePaid}
            onStartRide={handleStartRide}
            onEndRide={handleEndRide}
            passengerUrl={activePassengerUrl}
          />
        )}

        {viewMode === 'driver' && (
          <DriverHistorySummary sessions={passengerSessions} />
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
            onPayClick={(amount) => {
              const descParts: string[] = [];
              if (ridePrice > 0) descParts.push('Corrida');
              if (selectedServicesTotal > 0) descParts.push(`Serviços A Bordo (${selectedServiceIds.length})`);
              if (selectedTip > 0) descParts.push('Caixinha');
              handleOpenMercadoPagoModal(
                amount,
                descParts.length > 0 ? descParts.join(' + ') : 'Pagamento via Pix'
              );
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
                'Liberação do Serviço de Escolha de Músicas no Som do Veículo',
                [SERVICE_IDS.MUSIC]
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
        rideId={currentRide?.id || rideIdFromUrl}
        passengerSessionId={currentPassengerSession?.id || activeSessionId}
        serviceIds={mpModalServiceIds}
        productQuantities={productQuantities}
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


    </ExperienceApp>
  );
}

