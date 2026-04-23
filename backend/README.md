# FindMyCar Backend

API Node.js + Express qui agrège plusieurs marketplaces auto, normalise les annonces et expose une API REST consommée par le front.

## Stack

- **Node 20** (ESM, `"type": "module"`)
- **Express** — routes, middlewares
- **undici** — client HTTP (supporte les proxies, plus rapide que node-fetch)
- **cheerio** — parsing HTML pour les scrapers
- **p-queue** — concurrency par source
- **helmet + cors + express-rate-limit + morgan** — sécurité / logs standards

## Structure

```
src/
├── server.js                  # entrée, gestion arrêt propre
├── app.js                     # assemblage Express
├── config/index.js            # env vars typées
├── routes/                    # URL → controller
├── controllers/               # parse req → service → réponse
├── services/
│   ├── aggregator.service.js  # fan-out + normalisation + dédup
│   ├── filter.service.js      # filtre + scoring pur
│   ├── estimate.service.js    # médiane marché + import
│   └── cache.service.js       # cache in-memory TTL
├── scrapers/
│   ├── base.scraper.js        # socle commun (fallback mock, anti-bot detection)
│   ├── leboncoin.scraper.js
│   ├── lacentrale.scraper.js
│   ├── mobilede.scraper.js
│   ├── autoscout24.scraper.js
│   └── registry.js
├── normalizers/               # raw source format → NormalizedListing
├── models/                    # JSDoc + factories (pas d'ORM)
├── middleware/
├── mocks/                     # catalog + generator procédural (fallback)
└── utils/                     # logger, http, etc.
```

## Démarrage

```bash
cp .env.example .env
npm install
npm run dev      # reload sur modification
npm start        # production
```

## Modes du scraper (`SCRAPER_MODE`)

- `mock` — pas de réseau, uniquement le générateur procédural. Parfait pour démo / tests.
- `live` — uniquement scraping réel. Échoue si la source bloque.
- `hybrid` — tente le scraping, tombe sur le mock en cas d'échec. **Recommandé**.

## Endpoints

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Ping + status + modes |
| `GET` | `/api/sources` | Liste des sources et leur état |
| `GET` | `/api/search?make=...&model=...&yearMin=...` | Recherche agrégée paginée |
| `GET` | `/api/listings/:id` | Fiche détail (id = `sourceId:sourceRef`) |
| `GET` | `/api/estimate?make=...&model=...` | Médiane marché + statistiques |

Exemple :
```bash
curl "http://localhost:3000/api/search?make=Toyota&model=Prius%2B&pageSize=3"
```

## Scraping : réalité

Les sites ciblés (Leboncoin, LaCentrale, Mobile.de, AutoScout24) sont protégés par **DataDome**, **Cloudflare**, **Akamai**. Depuis une IP datacenter, les requêtes directes sont **détectées en ~100 ms** et renvoient un challenge JS ou un captcha.

Pour passer en production :

1. **Proxy résidentiel** : ajouter `SCRAPER_PROXY_URL=http://user:pass@gate.scrapingbee.com:8886` (ou Bright Data / Oxylabs). Coût typique : 20 à 200 €/mois.
2. **Ou browser automation** : remplacer `undici.fetch` par **Playwright** ou **Puppeteer** (plus lourd, ~150 Mo d'image Docker en plus, mais contourne certaines protections).
3. **Ou API partenaire** : payantes et accessibles sur demande.

Le code implémenté ici est **prêt** : chaque scraper détecte le blocage via `isBlockingPage()` et bascule sur le fallback mock en mode `hybrid`. Les sélecteurs et les chemins d'extraction (`__NEXT_DATA__`, `__NUXT_DATA__`, `__INITIAL_STATE__`) sont exacts au moment du livrable mais **ces sites changent leur HTML** régulièrement — prévoir de la maintenance.

## Variables d'environnement

Voir `.env.example`. Les principales :

- `PORT` (3000)
- `CORS_ORIGIN` — origin du front, séparé par virgule si plusieurs
- `SCRAPER_MODE` — `mock` / `live` / `hybrid`
- `SCRAPER_PROXY_URL` — proxy HTTP pour passer les anti-bots
- `CACHE_TTL_SECONDS` — TTL du cache mémoire (600 par défaut)
- `RATE_LIMIT_MAX` — requêtes/minute par IP (120 par défaut)
- `SCRAPER_CONCURRENCY` — parallélisme max par source (2 par défaut)

## Docker

Build + run isolé :
```bash
docker build -t findmycar-backend .
docker run --rm -p 3001:3000 -e SCRAPER_MODE=mock findmycar-backend
curl http://localhost:3001/api/health
```

Ou via `docker-compose up --build` depuis la racine du monorepo.

## Tests rapides

```bash
# Santé du serveur
curl http://localhost:3000/api/health | jq

# Agrégation
curl "http://localhost:3000/api/search?make=Toyota&model=Prius%2B&pageSize=5" | jq '.total'

# Estimation marché
curl "http://localhost:3000/api/estimate?make=Toyota&model=Prius%2B" | jq
```
