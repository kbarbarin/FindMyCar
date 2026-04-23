// Scraper placeholder pour les sources présentes dans le catalogue mais
// non encore implémentées (status: 'pending') ou bloquées par anti-bot sans
// proxy (status: 'needs_proxy'). Retourne toujours [] avec une erreur claire
// que l'aggregator propage dans sourceStats.

import { BaseScraper } from './base.scraper.js';
import { emptyListing, makeListingId } from '../models/listing.model.js';

export class PendingSourceScraper extends BaseScraper {
  constructor(catalogEntry) {
    super({
      id: catalogEntry.id,
      label: catalogEntry.label,
      country: catalogEntry.country,
      baseUrl: catalogEntry.baseUrl,
      preferredEngine: catalogEntry.preferredEngine || 'fetch',
    });
    this.enabled = false; // pas activé par défaut
    this.catalogEntry = catalogEntry;
  }

  buildSearchUrl(criteria) {
    return this.catalogEntry.searchUrl?.(criteria ?? {}) ?? this.baseUrl;
  }

  // En cas d'appel quand même (via ENABLE_xxx), on renvoie une erreur explicite.
  async searchLive() {
    const reason = this.catalogEntry.reason || 'not_implemented';
    const err = new Error(reason);
    err.status = 501;
    throw err;
  }

  parseHtml() { throw new Error('pending_scraper_no_parse'); }
  async generateMock() { return []; }
  normalize(raw) { return emptyListing({ id: makeListingId(this.id, raw.id || 'x') }); }
}
