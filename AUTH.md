# Authentification — FindMyCar

Auth basée sur **Firebase Auth (Email/Password)**. Frontend gère le cycle de vie
des tokens, backend les vérifie via Admin SDK. Aucune session côté serveur.

## Flow

```
[ Browser ]                                      [ Backend ]
  signIn()  ─────────────────────────►  Firebase Auth (Google)
            ◄────  ID token (1h JWT)
                                          authStore.user = { uid, email, ... }

  apiClient.search()                  Authorization: Bearer <ID token>
       ────────────────────────────►   middleware/auth.js verifyIdToken()
       ◄────────  JSON               req.user = { uid, email, name }

(SDK refresh transparent : getIdToken() renvoie toujours un token valide.)
```

- Le **refresh token** vit côté client uniquement (localStorage, géré par le
  SDK). Tu ne dois jamais y toucher.
- Chaque requête backend est **stateless** : on revérifie l'ID token à chaque
  appel.
- Le sign-out efface le refresh token local. Si un attaquant a volé un ID
  token déjà émis, il reste valide jusqu'à expiration (1h max).

## Setup

### 1. Activer Email/Password dans la console Firebase

- Project : `findmycar-354b0`
- https://console.firebase.google.com/project/findmycar-354b0/authentication/providers
- Active "Email/Password" (laisser "Email link" désactivé sauf besoin).

### 2. Frontend — variables d'env

Crée `frontend/.env.local` (gitignoré) :

```
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=findmycar-354b0.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=findmycar-354b0
VITE_FIREBASE_APP_ID=1:xxxx:web:xxxx
```

Récupère les valeurs ici :
Console Firebase → Project settings → General → Your apps → SDK setup → Config.

> Ces variables sont publiques par construction (bundle client). Elles ne sont
> pas un secret. La sécurité réelle vient des Firestore Rules + middleware
> backend.

### 3. Backend — credentials Admin SDK

Au choix :

- `FIREBASE_SERVICE_ACCOUNT=/abs/path/to/sa.json`
- `GOOGLE_APPLICATION_CREDENTIALS=/abs/path/to/sa.json`
- `gcloud auth application-default login` (dev local)
- Cloud Run / Functions : metadata server (rien à configurer)

L'app Admin est initialisée par `services/firestore.service.js`. Le service
`auth.service.js` la **réutilise** (pas de double init).

### 4. Déployer les rules Firestore

```
firebase deploy --only firestore:rules
```

## Tester end-to-end

1. `cd frontend && npm run dev` (port 5173)
2. `cd backend && npm run dev` (port 3000)
3. Ouvre http://localhost:5173/register, crée un compte.
4. Vérifie côté frontend : header montre l'email + bouton "Se déconnecter".
5. Vérifie l'API protégée :
   ```
   curl -H "Authorization: Bearer <ID_TOKEN>" http://localhost:3000/api/me
   ```
   Pour récupérer l'ID token rapidement, en console navigateur :
   ```js
   await firebase.auth().currentUser.getIdToken()
   // ou si non exposé globalement :
   await window.__authStore?.getState().user
   ```
6. Va sur `/favorites` (route protégée) — accessible.
7. Sign out → tente `/favorites` → redirection automatique vers `/login`.

## Composants ajoutés

### Frontend

- `services/firebase/firebase.js` — init Web SDK
- `services/auth/authService.js` — wrapper signUp/signIn/signOut/onAuthStateChanged
- `store/authStore.js` — store zustand
- `hooks/useAuth.js`
- `components/auth/RequireAuth.jsx` — garde de route
- `pages/LoginPage.jsx`, `pages/RegisterPage.jsx`, `pages/AccountPage.jsx`
- `services/api/client.js` — injection automatique du Bearer

### Backend

- `services/auth.service.js` — verifyIdToken via Admin SDK
- `middleware/auth.js` — `requireAuth` + `optionalAuth`
- `routes/me.routes.js` — `GET /api/me`
- `routes/favorites.routes.js` — `GET/POST /api/favorites`, `DELETE /api/favorites/:id`
- `firestore.rules` — règle `users/{uid}/...`

## Notes

- Le SDK Firebase met en cache les ID tokens et les rafraîchit ~5 min avant
  expiration. `getIdToken()` est donc bon marché et synchrone la plupart du
  temps.
- Les routes publiques (`/api/search`, `/api/listings`, `/api/stats`, etc.)
  restent ouvertes — le client envoie un Bearer si dispo, sinon non.
- Pour ajouter une route privée : `router.get('/x', requireAuth, ...)`.
