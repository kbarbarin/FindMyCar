# FindMyCar

Méta-moteur de recherche d'annonces de voitures d'occasion — agrégation multi-sources,
normalisation, suggestions intelligentes, mode import.

**V1 : 100 % locale, React JS (sans TypeScript), données mockées.**
**V2 : migration Firebase (Firestore + Functions + Auth) sans réécriture UI.**

## Démarrage

```bash
npm install
npm run dev
```

L'app est servie sur `http://localhost:5173`.

## Scripts

- `npm run dev` — serveur Vite en dev
- `npm run build` — build de prod dans `dist/`
- `npm run preview` — sert le build

## Structure

- `src/pages/` — pages React Router
- `src/components/` — UI (ui/, search/, results/, listing/)
- `src/services/search/` — moteur pur : filter / score / sort / suggestions
- `src/services/sources/` — connecteurs par marketplace (registry plugin-style)
- `src/services/normalization/` — mapping raw → NormalizedListing
- `src/services/aggregator/` — fan-out + dédup
- `src/services/import/` — calculs de frais d'import
- `src/services/persistence/` — port swap V1 localStorage ↔ V2 Firebase
- `src/store/` — Zustand (search + favorites)
- `src/mocks/` — datasets par source, formats volontairement divergents
- `src/config/app.config.js` — feature flags (bascule V1 / V2)

## Ajouter une source

1. Créer `src/services/sources/monsite.js` implémentant l'interface `{ id, label, country, enabled, priority, capabilities, fetchListings, normalize }`.
2. Créer le normalizer dans `src/services/normalization/normalizeListing.js` (même schéma cible).
3. Ajouter le connector dans `src/services/sources/registry.js`.

C'est tout. Aucune autre modification nécessaire.

## Passage à Firebase (V2)

1. Implémenter `src/services/persistence/firebaseAdapter.js` avec l'API Firestore (mêmes signatures que `localAdapter`).
2. Passer `APP_CONFIG.features.useFirebasePersistence` à `true`.
3. Pour les sources : réécrire `fetchListings` pour appeler une Cloud Function (ou Firestore), conserver `normalize`.
