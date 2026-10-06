import { getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
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

function mapUser(user: User): AuthenticatedDriver {
  if (!user.email) {
    throw new Error('A Conta Google autenticada não possui e-mail disponível.');
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
  return mapUser(credential.user);
}

export async function signOutDriver(): Promise<void> {
  await signOut(auth);
}

export function subscribeDriverAuth(
  onChange: (driver: AuthenticatedDriver | null) => void
): () => void {
  return onAuthStateChanged(auth, (user) => {
    onChange(user ? mapUser(user) : null);
  });
}
