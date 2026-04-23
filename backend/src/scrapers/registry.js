// Registry des scrapers, construit depuis le catalogue.
//
// Le catalogue décrit TOUTES les sources qu'on expose dans l'UI (38+).
// L'implémentation est résolue via catalogEntry.implementation :
//   - Si une classe dédiée existe, on l'instancie.
//   - Sinon, on met un PendingSourceScraper (qui refuse de scraper mais
//     existe dans l'UI pour que l'utilisateur voie le catalogue complet).

import { SOURCES_CATALOG } from './sources.catalog.js';
import { LeboncoinScraper } from './leboncoin.scraper.js';
import { LacentraleScraper } from './lacentrale.scraper.js';
import { MobiledeScraper } from './mobilede.scraper.js';
import { Autoscout24Scraper } from './autoscout24.scraper.js';
import { ParuVenduScraper } from './paruvendu.scraper.js';
import { SubitoScraper } from './subito.scraper.js';
import { MarktplaatsScraper } from './marktplaats.scraper.js';
import { Auto24Scraper } from './auto24.scraper.js';
import { GenericScraper } from './generic.scraper.js';
import { PendingSourceScraper } from './pending.scraper.js';

const IMPL_REGISTRY = {
  leboncoin: () => new LeboncoinScraper(),
  lacentrale: () => new LacentraleScraper(),
  mobilede: () => new MobiledeScraper(),
  autoscout24: () => new Autoscout24Scraper(),
  paruvendu: () => new ParuVenduScraper(),
  subito: () => new SubitoScraper(),
  marktplaats: () => new MarktplaatsScraper(),
  auto24: () => new Auto24Scraper(),
  generic: (entry) => new GenericScraper(entry),
};

// Construction : une instance par entrée de catalogue.
// Les scrapers 'needs_proxy' sont auto-désactivés (enabled=false) sauf flag.
const SCRAPERS = SOURCES_CATALOG.map((entry) => {
  const factory = entry.implementation ? IMPL_REGISTRY[entry.implementation] : null;
  let scraper;
  if (factory) {
    scraper = factory(entry);
    scraper.catalogEntry = entry;
    scraper.status = entry.status;
  } else {
    scraper = new PendingSourceScraper(entry);
  }
  // Désactive par défaut les sources clairement bloquées sans proxy.
  if (entry.status === 'needs_proxy') scraper.enabled = false;
  return scraper;
});

// Appliquer les flags runtime (ENABLE_XXX pour les sources désactivées par défaut)
for (const s of SCRAPERS) {
  const envFlag = `ENABLE_${s.id.toUpperCase()}`;
  if (process.env[envFlag] === 'true') s.enabled = true;
  if (process.env[envFlag] === 'false') s.enabled = false;
}

export function getScrapers({ ids = null, onlyEnabled = true } = {}) {
  return SCRAPERS.filter((s) => {
    if (onlyEnabled && !s.enabled) return false;
    if (ids && ids.length && !ids.includes(s.id)) return false;
    return true;
  });
}

export function getScraperById(id) {
  return SCRAPERS.find((s) => s.id === id) ?? null;
}

export function getAllMeta() {
  return SCRAPERS.map((s) => ({
    id: s.id,
    label: s.label,
    country: s.country,
    enabled: s.enabled,
    status: s.catalogEntry?.status || (s.enabled ? 'live' : 'disabled'),
    reason: s.catalogEntry?.reason || null,
    baseUrl: s.baseUrl,
  }));
}
