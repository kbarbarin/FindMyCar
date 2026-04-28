import { create } from 'zustand';
import {
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  onAuthStateChanged,
} from '../services/auth/authService.js';

// Zustand store qui reflète l'état Firebase Auth.
// `initialize()` est appelé une fois au boot (App.jsx) — il s'abonne à
// `onAuthStateChanged` et met à jour le store à chaque changement (login,
// logout, refresh token côté SDK).

function toAuthUser(fbUser) {
  if (!fbUser) return null;
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    displayName: fbUser.displayName || null,
    emailVerified: fbUser.emailVerified,
  };
}

function readableError(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-email': return 'Adresse email invalide.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Email ou mot de passe incorrect.';
    case 'auth/email-already-in-use': return 'Cet email est déjà utilisé.';
    case 'auth/weak-password': return 'Mot de passe trop faible (8 caractères minimum).';
    case 'auth/too-many-requests': return 'Trop de tentatives, réessayez plus tard.';
    case 'auth/network-request-failed': return 'Problème de connexion réseau.';
    case 'auth/not-configured': return 'Authentification non configurée (variables Firebase manquantes).';
    default: return err?.message || 'Erreur d\'authentification.';
  }
}

let unsubscribe = null;
let initialized = false;

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  error: null,

  initialize() {
    if (initialized) return;
    initialized = true;
    unsubscribe = onAuthStateChanged((fbUser) => {
      set({ user: toAuthUser(fbUser), loading: false });
    });
  },

  teardown() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    initialized = false;
  },

  async signIn(email, password) {
    set({ error: null });
    try {
      const fbUser = await authSignIn(email, password);
      set({ user: toAuthUser(fbUser), error: null });
      return get().user;
    } catch (err) {
      set({ error: readableError(err) });
      throw err;
    }
  },

  async signUp(email, password, displayName) {
    set({ error: null });
    try {
      const fbUser = await authSignUp(email, password, displayName);
      set({ user: toAuthUser(fbUser), error: null });
      return get().user;
    } catch (err) {
      set({ error: readableError(err) });
      throw err;
    }
  },

  async signOut() {
    try {
      await authSignOut();
      set({ user: null, error: null });
    } catch (err) {
      set({ error: readableError(err) });
      throw err;
    }
  },

  clearError() { set({ error: null }); },
}));
