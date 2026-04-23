// Orchestration : pour une requête, fan-out les scrapers, normalise, dédup,
// enrichit import, filtre, score, tri.

import { getScrapers } from '../scrapers/registry.js';
import { filterListings, sortListings, scoreListings } from './filter.service.js';
import { enrichWithImport } from './estimate.service.js';
import { listingsCache } from './listings.cache.js';
import { firestoreService } from './firestore.service.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'aggregator' });

export async function aggregatedSearch(criteria) {
  const scrapers = getScrapers({ ids: criteria.sources ?? null });
  const results = await Promise.allSettled(scrapers.map(async (s) => {
    const out = await s.search(criteria);
    return { scraper: s, items: out.items, source: out.source, error: out.error };
  }));

  const partialSources = [];
  const sourceStats = {};
  const allNormalized = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const s = scrapers[i];
    if (r.status === 'rejected') {
      partialSources.push({ id: s.id, error: r.reason?.message || 'unknown' });
      sourceStats[s.id] = { count: 0, source: 'error', error: r.reason?.message };
      continue;
    }
    const { scraper, items, source, error } = r.value;
    try {
      const normalized = items.map((raw) => scraper.normalize(raw));
      allNormalized.push(...normalized);
      sourceStats[scraper.id] = { count: normalized.length, source, error };
    } catch (err) {
      log.warn('normalize.failed', { source: scraper.id, msg: err.message });
      partialSources.push({ id: scraper.id, error: 'normalize_failed' });
    }
  }

  const deduped = dedup(allNormalized);
  const enriched = enrichWithImport(deduped);
  // Alimente l'index id→listing AVANT filtrage : même si une annonce n'est pas
  // dans les résultats filtrés actuels, elle reste retrouvable par son id.
  listingsCache.putMany(enriched);

  // Persistance Firestore asynchrone : ne bloque pas la réponse au user.
  // Si Firestore n'est pas configuré, no-op silencieux.
  if (firestoreService.isEnabled() && enriched.length > 0) {
    queueMicrotask(() => {
      firestoreService.upsertListings(enriched)
        .then((r) => log.debug('firestore.persisted', { written: r.written }))
        .catch((err) => log.warn('firestore.persist_failed', { msg: err.message }));
    });
  }

  const scored = scoreListings(enriched, criteria);
  const filtered = filterListings(scored, criteria);
  const sorted = sortListings(filtered, criteria.sort);

  return {
    total: sorted.length,
    partialSources,
    sourceStats,
    results: sorted,
  };
}

function fingerprint(l) {
  const km = l.mileageKm ? Math.round(l.mileageKm / 10000) : 'na';
  const pr = l.price?.amount ? Math.round(l.price.amount / 500) : 'na';
  return `${(l.make||'').toLowerCase()}|${(l.model||'').toLowerCase()}|${l.year||'na'}|${km}|${pr}`;
}
function dedup(listings) {
  const seen = new Map();
  for (const l of listings) {
    const fp = fingerprint(l);
    const existing = seen.get(fp);
    if (!existing) { seen.set(fp, l); continue; }
    const a = existing.meta?.fieldsMissing?.length ?? 99;
    const b = l.meta?.fieldsMissing?.length ?? 99;
    if (b < a) seen.set(fp, l);
    else if (b === a && l.country === 'FR' && existing.country !== 'FR') seen.set(fp, l);
  }
  return [...seen.values()];
}
