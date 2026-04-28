// Orchestrateur :
//  1. Hash des critères → check searchCache Firestore (TTL 6h par défaut)
//      - HIT : on ressort les listings depuis Firestore, 0 scrape, retour < 1s
//      - MISS ou option `fresh` : on scrape live, persiste, met à jour le cache
//  2. Persistance : chaque listing dans /listings, chaque recherche dans /searches
//
// La logique de scoring/filter/sort est appliquée APRÈS récupération
// (que les données viennent du cache ou du live).

import { getScrapers, getAllMeta } from '../scrapers/registry.js';
import { filterListings, sortListings, scoreListings } from './filter.service.js';
import { enrichWithImport } from './estimate.service.js';
import { listingsCache } from './listings.cache.js';
import { firestoreService } from './firestore.service.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'aggregator' });

const PER_SOURCE_TIMEOUT_MS = parseInt(process.env.PER_SOURCE_TIMEOUT_MS, 10) || 15000;
const FIRESTORE_CACHE_TTL_MIN = parseInt(process.env.FIRESTORE_CACHE_TTL_MIN, 10) || 360; // 6h

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const err = new Error('source_timeout');
      err.status = 504;
      err.label = label;
      reject(err);
    }, ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function classifyError(err) {
  const msg = err?.message || '';
  if (err?.status === 403) return 'blocked';
  if (err?.status === 404) return 'not_found';
  if (err?.status === 429) return 'rate_limited';
  if (err?.status === 503) return 'unavailable';
  if (err?.status === 504 || msg === 'source_timeout' || /timeout/i.test(msg)) return 'timeout';
  if (msg === 'blocked_by_antibot' || msg === 'blocked_by_antibot_browser') return 'blocked';
  if (msg === 'fetch failed') return 'network_error';
  if (msg.startsWith('all_strategies_failed')) return 'parse_failed';
  if (msg === 'empty_results' || msg.includes('no_ads') || msg.includes('no_listings') || msg.includes('no_cards')) return 'empty';
  return 'error';
}

// Hash stable : même critères → même hash. Ignore page/pageSize/sort.
export function computeCriteriaHash(criteria) {
  const norm = {};
  for (const [k, v] of Object.entries(criteria || {})) {
    if (['page', 'pageSize', 'sort', 'fresh'].includes(k)) continue;
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    norm[k] = Array.isArray(v) ? [...v].sort() : v;
  }
  const serialized = Object.keys(norm).sort()
    .map((k) => `${k}=${Array.isArray(norm[k]) ? norm[k].join(',') : norm[k]}`)
    .join('&');
  // Sanitize pour Firestore doc ID (max 1500 bytes, pas de "/")
  return serialized.replace(/[\/#?]/g, '_').slice(0, 1500) || '__empty__';
}

export async function aggregatedSearch(criteria) {
  const startedAt = Date.now();
  const fresh = criteria.fresh === true || criteria.fresh === 'true';
  const wantedIds = Array.isArray(criteria.sources) && criteria.sources.length ? criteria.sources : null;

  // ÉTAPE 1 : tentative cache Firestore (sauf si fresh ou source explicite)
  if (!fresh && !wantedIds && firestoreService.isEnabled()) {
    const hash = computeCriteriaHash(criteria);
    const cached = await firestoreService.getCachedSearch(hash, { maxAgeMinutes: FIRESTORE_CACHE_TTL_MIN });
    if (cached?.listingIds?.length) {
      const listings = await firestoreService.getListingsByIds(cached.listingIds);
      if (listings.length > 0) {
        log.info('aggregator.cache_hit', { hash, count: listings.length, ageMin: cached.ageMinutes });
        return finalize({
          listings,
          criteria,
          startedAt,
          cacheStatus: { hit: true, ageMinutes: cached.ageMinutes, cachedAt: cached.cachedAt },
          sourceStatsOverride: null,
        });
      }
    }
  }

  // ÉTAPE 2 : scraping live
  const scrapers = getScrapers({ ids: wantedIds });
  const allMeta = getAllMeta();

  const settled = await Promise.allSettled(
    scrapers.map(async (s) => {
      const sStart = Date.now();
      try {
        const out = await withTimeout(s.search(criteria), PER_SOURCE_TIMEOUT_MS, s.id);
        return { scraper: s, items: out.items, source: out.source, error: out.error, durationMs: Date.now() - sStart };
      } catch (err) {
        return { scraper: s, error: err, durationMs: Date.now() - sStart, failed: true };
      }
    }),
  );

  const sourceStats = {};
  const allNormalized = [];
  let liveCount = 0, errorCount = 0;

  for (const m of allMeta) {
    sourceStats[m.id] = {
      label: m.label, country: m.country,
      enabled: m.enabled, catalogStatus: m.status,
      attempted: false, count: 0, durationMs: null,
      result: 'skipped', reason: m.enabled ? null : (m.reason || m.status),
    };
  }

  for (const r of settled) {
    if (r.status === 'rejected') continue;
    const v = r.value;
    const stats = sourceStats[v.scraper.id];
    stats.attempted = true;
    stats.durationMs = v.durationMs;

    if (v.failed) {
      stats.result = classifyError(v.error);
      stats.reason = (v.error?.message || 'unknown').slice(0, 200);
      stats.count = 0;
      errorCount++;
      continue;
    }

    try {
      const normalized = v.items.map((raw) => v.scraper.normalize(raw));
      allNormalized.push(...normalized);
      stats.count = normalized.length;
      stats.result = v.source === 'live' ? 'live' : v.source;
      stats.reason = null;
      if (stats.result === 'live') liveCount++;
    } catch (err) {
      stats.result = 'normalize_failed';
      stats.reason = err.message;
    }
  }

  const result = finalize({
    listings: allNormalized,
    criteria,
    startedAt,
    cacheStatus: { hit: false, ageMinutes: null, fresh },
    sourceStatsOverride: sourceStats,
    extra: {
      liveCount, errorCount,
      sourcesAttempted: scrapers.length,
      sourcesInCatalog: allMeta.length,
    },
  });

  // ÉTAPE 3 : persistance Firestore (async, ne bloque pas la réponse)
  if (firestoreService.isEnabled() && result.listings.length > 0 && !wantedIds) {
    const hash = computeCriteriaHash(criteria);
    const ids = result.listings.map((l) => l.id);
    queueMicrotask(() => {
      firestoreService.upsertListings(result.listings)
        .then(() => firestoreService.cacheSearch(hash, criteria, ids, { source: 'live' }))
        .catch((err) => log.warn('firestore.persist_failed', { msg: err.message }));
    });
  }

  // Enregistre la recherche dans /searches (audit / analytics)
  if (firestoreService.isEnabled()) {
    queueMicrotask(() => {
      firestoreService.recordSearch({
        criteria: cleanCriteriaForLog(criteria),
        resultsCount: result.total,
        source: result.cacheStatus.hit ? 'cache' : 'live',
        durationMs: result.durationMs,
        liveCount: result.liveCount ?? null,
        sourcesAttempted: result.sourcesAttempted ?? null,
        fresh,
      }).catch(() => {});
    });
  }

  return result;
}

function finalize({ listings, criteria, startedAt, cacheStatus, sourceStatsOverride, extra = {} }) {
  const deduped = dedup(listings);
  const enriched = enrichWithImport(deduped);
  listingsCache.putMany(enriched);

  const scored = scoreListings(enriched, criteria);
  const filtered = filterListings(scored, criteria);
  const sorted = sortListings(filtered, criteria.sort);

  const sourceStats = sourceStatsOverride ?? buildSourceStatsFromListings(enriched);

  const partialSources = Object.entries(sourceStats)
    .filter(([, s]) => s.attempted && s.result !== 'live')
    .map(([id, s]) => ({ id, error: s.reason, code: s.result }));

  return {
    total: sorted.length,
    rawCount: enriched.length,
    liveCount: extra.liveCount ?? Object.values(sourceStats).filter((s) => s.result === 'live').length,
    errorCount: extra.errorCount ?? 0,
    sourcesAttempted: extra.sourcesAttempted ?? 0,
    sourcesInCatalog: extra.sourcesInCatalog ?? 0,
    durationMs: Date.now() - startedAt,
    cacheStatus,
    partialSources,
    sourceStats,
    listings: enriched,
    results: sorted,
  };
}

// Quand on lit du cache, on fabrique un sourceStats simulé à partir des listings
// remontées (pour que le panel front affiche quand même qui contribue).
function buildSourceStatsFromListings(listings) {
  const stats = {};
  for (const m of getAllMeta()) {
    stats[m.id] = {
      label: m.label, country: m.country,
      enabled: m.enabled, catalogStatus: m.status,
      attempted: false, count: 0, durationMs: null,
      result: 'skipped', reason: 'served_from_cache',
    };
  }
  for (const l of listings) {
    const sid = l.source?.id;
    if (!sid || !stats[sid]) continue;
    stats[sid].count++;
    stats[sid].result = 'cache';
    stats[sid].attempted = true;
  }
  return stats;
}

function cleanCriteriaForLog(c) {
  const out = {};
  for (const [k, v] of Object.entries(c || {})) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (['page', 'pageSize', 'sort'].includes(k)) continue;
    out[k] = v;
  }
  return out;
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
