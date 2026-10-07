import { getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface AuthenticatedDriver {
  uid: string;
  name: string;
  email: string;
  photoUrl: string;
}

function mapDriver(user: User): AuthenticatedDriver {
  if (user.isAnonymous || !user.email) {
    throw new Error('Sessão atual não é uma Conta Google de motorista.');
  }

  return {
    uid: user.uid,
    name: user.displayName || user.email.split('@')[0] || 'Motorista Particular',
    email: user.email,
    photoUrl: user.photoURL || '',
  };
}

export async function signInDriverWithGoogle(): Promise<AuthenticatedDriver> {
  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInWithPopup(auth, googleProvider);
  return mapDriver(credential.user);
}

export async function ensurePassengerAuth(): Promise<string> {
  await setPersistence(auth, browserLocalPersistence);

  if (auth.currentUser) {
    if (!auth.currentUser.isAnonymous) {
      throw new Error('Uma conta de motorista está autenticada; a sessão anônima do passageiro não pode reutilizar essa identidade.');
    }
    return auth.currentUser.uid;
  }

  const credential = await signInAnonymously(auth);
  if (!credential.user.isAnonymous) {
    throw new Error('O Firebase não criou uma identidade anônima de passageiro.');
  }
  return credential.user.uid;
}

export function getCurrentAuthUid(): string | null {
  return auth.currentUser?.uid || null;
}

export async function signOutDriver(): Promise<void> {
  await signOut(auth);
}

export function subscribeDriverAuth(
  onChange: (driver: AuthenticatedDriver | null) => void
): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user || user.isAnonymous || !user.email) {
      onChange(null);
      return;
    }

    onChange(mapDriver(user));
  });
}

export function isDriverAuthenticated(): boolean {
  const user = auth.currentUser;
  return Boolean(user && !user.isAnonymous && user.email);
}

export function isPassengerAuthenticated(): boolean {
  return Boolean(auth.currentUser?.isAnonymous);
}
