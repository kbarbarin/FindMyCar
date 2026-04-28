// Initialisation Firebase Web SDK.
// La config est lue via les variables d'environnement Vite (préfixe VITE_).
// Toute valeur exposée ici est PUBLIQUE par construction (bundle client) — ce
// sont des identifiants de projet, pas des secrets. La sécurité réelle vit
// dans Firestore Rules + middleware backend `requireAuth`.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function isConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

let firebaseApp = null;
let firebaseAuth = null;

if (isConfigured()) {
  firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
} else if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.warn(
    '[firebase] config absente — auth désactivée. ' +
    'Définis VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID dans .env.local',
  );
}

export { firebaseApp, firebaseAuth };
export const isFirebaseConfigured = isConfigured;
