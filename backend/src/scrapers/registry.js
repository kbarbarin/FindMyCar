// Registry des scrapers, construit depuis le catalogue.
//
// Auto-désactivation au boot :
//   - 'needs_proxy' : nécessitent un proxy résidentiel
//   - 'pending'     : implémentation existe mais URL/sélecteurs cassés ou jamais
//                     vérifiés. Désactivés pour ne pas polluer chaque recherche.
//
// Override runtime : ENABLE_<SOURCE_ID>=true / false force l'état.
// Les sources désactivées peuvent quand même être appelées via l'API si l'ID
// est passé explicitement dans `criteria.sources` (manual retry depuis le front).

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
  // Activation par défaut : seulement 'live' et 'experimental'.
  // Les autres statuts ('needs_proxy', 'pending') sont désactivés.
  scraper.enabled = entry.status === 'live' || entry.status === 'experimental';
  return scraper;
});

// Override par variable d'env
for (const s of SCRAPERS) {
  const flag = process.env[`ENABLE_${s.id.toUpperCase()}`];
  if (flag === 'true')  s.enabled = true;
  if (flag === 'false') s.enabled = false;
}

/**
 * Retourne les scrapers à utiliser pour une recherche.
 *
 * @param {Object} opts
 * @param {string[]|null} opts.ids        - Si fourni, retourne UNIQUEMENT ces ids
 *                                          (et bypass `onlyEnabled` → permet le manual retry).
 * @param {boolean} opts.onlyEnabled      - Quand `ids` n'est pas fourni, ne rend que les enabled.
 */
export function getScrapers({ ids = null, onlyEnabled = true } = {}) {
  if (ids && ids.length) {
    // Sélection explicite : on respecte la liste sans filtrer sur enabled.
    return SCRAPERS.filter((s) => ids.includes(s.id));
  }
  return SCRAPERS.filter((s) => !onlyEnabled || s.enabled);
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
