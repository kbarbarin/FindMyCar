# FindMyCar — monorepo

Méta-moteur de recherche d'annonces de voitures d'occasion.
**V2 : scraping live des marketplaces**, sans proxy.

```
FindMyCar/
├── frontend/          # React + Vite (SPA)
├── backend/           # Node + Express + scrapers live
└── docker-compose.yml
```

## Ce qui tourne en live (sans proxy)

| Source | Status | Volume typique | Méthode |
|---|---|---|---|
| **Leboncoin** | ✅ live | 30-50 / recherche | fetch + parsing `__NEXT_DATA__` |
| **AutoScout24** | ✅ live | 15-25 / recherche | fetch + parsing `__NEXT_DATA__` |
| LaCentrale | ❌ bloqué | — | Akamai Bot Manager, nécessite proxy résidentiel |
| Mobile.de | ❌ bloqué | — | Akamai Bot Manager, nécessite proxy résidentiel |

Les deux sources live suffisent à couvrir le marché FR/EU : toute recherche renvoie entre 20 et 100+ annonces **réelles** avec prix, photos et liens vers les vraies annonces.

## Démarrage en 2 commandes

```bash
# backend
cd backend && npm install && npm run dev

# frontend (terminal 2)
cd frontend && npm install && npm run dev
```

Puis ouvre http://localhost:5173. Le front détecte automatiquement le backend sur http://localhost:3000 (cf. `frontend/.env`).

## Via Docker

```bash
docker compose up --build
```

- Frontend : http://localhost:8080
- Backend : http://localhost:3001/api/health

## Tester le backend directement

```bash
curl "http://localhost:3000/api/search?make=Toyota&model=Prius%2B&pageSize=3" | jq
curl "http://localhost:3000/api/search?make=Renault&model=Clio" | jq '.total'
curl "http://localhost:3000/api/estimate?make=Peugeot&model=308" | jq
```

## Modes du scraper

Le backend a 3 modes via `SCRAPER_MODE` (défaut : `live`) :

- **`live`** — scraping réel uniquement. Ne retourne rien si les sources bloquent.
- **`hybrid`** — tente le live, fallback sur le générateur mock si échec.
- **`mock`** — pas de réseau, générateur procédural uniquement.

Et 3 moteurs via `SCRAPER_ENGINE` (défaut : `auto`) :

- **`auto`** — chaque scraper utilise son engine préféré (Leboncoin/AS24 en fetch direct, LaCentrale/Mobile.de en browser si activés).
- **`fetch`** — undici + headers Chrome + cookies. Léger.
- **`browser`** — Playwright Chromium. Plus lourd, exécute le JS des pages, passe certaines protections.

## Réactiver LaCentrale / Mobile.de

Ces deux sources sont désactivées par défaut parce que Akamai Bot Manager les bloque même avec Playwright (détection TLS-fingerprint). Pour les réactiver, il faut :

- soit un **proxy résidentiel** (ScrapingBee, Bright Data, Oxylabs) : `SCRAPER_PROXY_URL=http://user:pass@…`
- soit un **fetcher spécialisé** comme `puppeteer-extra-plugin-stealth` qui patch tous les signaux anti-bot

Puis :

```bash
ENABLE_LACENTRALE=true ENABLE_MOBILEDE=true npm run dev
```

## Structure

- `frontend/src/services/aggregator/aggregator.js` — appelle le backend et fallback local si indispo
- `frontend/src/services/api/client.js` — client HTTP
- `backend/src/scrapers/` — un scraper par source, héritent de `BaseScraper`
- `backend/src/scrapers/base.scraper.js` — orchestration + auto-escalade fetch → browser
- `backend/src/normalizers/` — raw source format → `NormalizedListing` commun
- `backend/src/services/aggregator.service.js` — fan-out, dedup, filter, score, tri
- `backend/src/services/estimate.service.js` — médiane marché + coût import

## Points d'attention légaux

Leboncoin et AutoScout24 interdisent le scraping dans leurs CGU. Ce repo est un POC / projet portfolio. Pour un usage commercial, il faut :

- soit passer par leurs **APIs partenaires** (payantes, accords commerciaux)
- soit s'assurer de rester **sous leur radar** (rate limiting bas, User-Agent honnête avec contact, respect de `robots.txt`)

Consomme les données avec modération et respecte les limites des sources.
