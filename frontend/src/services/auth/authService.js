// Wrapper minimal autour de Firebase Auth.
// Utilise la persistance localStorage : la session survit aux refresh navigateur.
// Le SDK gère le refresh des ID tokens automatiquement — on n'expose JAMAIS
// `getRefreshToken()`. Pour appeler le backend, on demande un ID token frais
// via `auth.currentUser.getIdToken()` (cf. services/api/client.js).

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  updateProfile,
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from '../firebase/firebase.js';

let persistencePromise = null;

function ensureAuth() {
  if (!firebaseAuth) {
    const err = new Error('auth_not_configured');
    err.code = 'auth/not-configured';
    throw err;
  }
  if (!persistencePromise) {
    persistencePromise = setPersistence(firebaseAuth, browserLocalPersistence).catch((e) => {
      // eslint-disable-next-line no-console
      console.warn('[auth] setPersistence failed', e?.message);
    });
  }
  return persistencePromise;
}

export async function signUp(email, password, displayName) {
  await ensureAuth();
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  if (displayName && cred.user) {
    try { await updateProfile(cred.user, { displayName }); } catch { /* non bloquant */ }
  }
  return cred.user;
}

export async function signIn(email, password) {
  await ensureAuth();
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return cred.user;
}

export async function signOut() {
  if (!firebaseAuth) return;
  await fbSignOut(firebaseAuth);
}

export function getCurrentUser() {
  return firebaseAuth?.currentUser ?? null;
}

export function onAuthStateChanged(callback) {
  if (!firebaseAuth) {
    // Pas de Firebase -> on simule un état "non connecté" et on rend un noop.
    callback(null);
    return () => {};
  }
  // Initialise la persistance avant de s'abonner — sinon `currentUser` peut
  // valoir null pendant un instant après un reload.
  ensureAuth();
  return fbOnAuthStateChanged(firebaseAuth, callback);
}

export async function getIdToken(forceRefresh = false) {
  const user = firebaseAuth?.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export const authReady = isFirebaseConfigured;
