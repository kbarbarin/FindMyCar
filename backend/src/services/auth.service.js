// Auth service backend (Firebase Admin SDK).
//
// Token flow rappel :
//   1. Côté client, le SDK Firebase signe l'utilisateur et stocke en local
//      un refresh token (long lived) + un ID token (1h, JWT signé par Google).
//   2. Le client appelle `getIdToken()` qui rafraîchit le token JIT si besoin.
//      L'ID token est envoyé via `Authorization: Bearer <jwt>`.
//   3. Le backend (ICI) vérifie la signature + le projectId via Admin SDK.
//      Tout est stateless : pas de session côté serveur, pas de cookie.
//
// On RÉUTILISE l'app Admin déjà initialisée par firestore.service.js. Le SDK
// admin est un singleton — `initializeApp()` deux fois lève une erreur.

import { getAuth } from 'firebase-admin/auth';
import { getApps } from 'firebase-admin/app';
// Import volontaire : déclenche l'init de l'app admin si elle ne tourne pas.
import { firestoreService } from './firestore.service.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'auth' });

let cachedAuth = null;

function getAdminAuth() {
  if (cachedAuth) return cachedAuth;
  const apps = getApps();
  if (!apps.length) {
    // L'init firestore n'a pas réussi (pas de credentials). On peut quand
    // même tenter getAuth() — il échouera proprement à la verif. Mais on
    // log une fois pour faire remonter le cas en dev.
    log.warn('auth.no_admin_app', {
      hint: 'Firebase Admin non initialisé — vérifie GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT.',
    });
    return null;
  }
  cachedAuth = getAuth(apps[0]);
  return cachedAuth;
}

export const authService = {
  isReady() {
    // firestoreService.isEnabled() = true ⇒ Admin app initialisée
    return firestoreService.isEnabled();
  },

  async verifyIdToken(token) {
    const auth = getAdminAuth();
    if (!auth) {
      const err = new Error('admin_not_initialized');
      err.code = 'auth/admin-not-initialized';
      throw err;
    }
    // checkRevoked=false : on fait confiance à Firebase pour la TTL standard.
    return auth.verifyIdToken(token, false);
  },

  async getUser(uid) {
    const auth = getAdminAuth();
    if (!auth) return null;
    return auth.getUser(uid);
  },
};
