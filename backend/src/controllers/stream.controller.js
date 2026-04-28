// Endpoint Server-Sent Events : pousse au front les événements de scraping en
// temps réel — par source, avec count et durée. Le client met à jour sa
// barre de progression au fur et à mesure plutôt que d'attendre 5-15s.
//
// Format des events :
//   start        { totalSources, sources: [{ id, label, country }] }
//   cache-hit    { ageMinutes, count }
//   source-started { id }
//   source-done    { id, count, durationMs, status }
//   source-error   { id, code, message, durationMs }
//   complete       { total, results: [...], sourceStats, durationMs }
//   abort          { reason }

import { criteriaFromQuery } from '../models/searchCriteria.model.js';
import { getScrapers, getAllMeta } from '../scrapers/registry.js';
import { firestoreService } from '../services/firestore.service.js';
import { listingsCache } from '../services/listings.cache.js';
import { computeCriteriaHash } from '../services/aggregator.service.js';
import { filterListings, sortListings, scoreListings } from '../services/filter.service.js';
import { enrichWithImport } from '../services/estimate.service.js';
import { computeEstimate } from '../services/estimate.service.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ controller: 'stream' });
const PER_SOURCE_TIMEOUT_MS = parseInt(process.env.PER_SOURCE_TIMEOUT_MS, 10) || 15000;
const FIRESTORE_CACHE_TTL_MIN = parseInt(process.env.FIRESTORE_CACHE_TTL_MIN, 10) || 360;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { const e = new Error('source_timeout'); e.status = 504; reject(e); }, ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
function classifyError(err) {
  const msg = err?.message || '';
  if (err?.status === 403 || msg.includes('blocked_by_antibot')) return 'blocked';
  if (err?.status === 404) return 'not_found';
  if (err?.status === 429) return 'rate_limited';
  if (err?.status === 503) return 'unavailable';
  if (err?.status === 504 || msg === 'source_timeout' || /timeout/i.test(msg)) return 'timeout';
  if (msg === 'fetch failed') return 'network_error';
  if (msg.startsWith('all_strategies_failed')) return 'parse_failed';
  if (msg.includes('no_ads') || msg.includes('no_listings') || msg.includes('no_cards')) return 'empty';
  return 'error';
}

export async function searchStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // désactive le buffering Nginx
  res.flushHeaders();

  const send = (event, data) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const startedAt = Date.now();
  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    const criteria = criteriaFromQuery(req.query);
    const fresh = criteria.fresh === true || criteria.fresh === 'true';
    const wantedIds = Array.isArray(criteria.sources) && criteria.sources.length ? criteria.sources : null;

    // 1) Cache Firestore
    if (!fresh && !wantedIds && firestoreService.isEnabled()) {
      const hash = computeCriteriaHash(criteria);
      const cached = await firestoreService.getCachedSearch(hash, { maxAgeMinutes: FIRESTORE_CACHE_TTL_MIN });
      if (cached?.listingIds?.length) {
        const listings = await firestoreService.getListingsByIds(cached.listingIds);
        if (listings.length > 0) {
          send('cache-hit', { ageMinutes: cached.ageMinutes, count: listings.length });
          const out = finalize(listings, criteria, startedAt, { hit: true, ageMinutes: cached.ageMinutes });
          send('complete', out);
          return res.end();
        }
      }
    }

    // 2) Live scraping streamé
    const scrapers = getScrapers({ ids: wantedIds });
    const allMeta = getAllMeta();

    send('start', {
      totalSources: scrapers.length,
      catalogSize: allMeta.length,
      sources: scrapers.map((s) => ({
        id: s.id, label: s.label, country: s.country, status: s.catalogEntry?.status,
      })),
    });

    const sourceStats = {};
    for (const m of allMeta) {
      sourceStats[m.id] = {
        label: m.label, country: m.country,
        enabled: m.enabled, catalogStatus: m.status,
        attempted: false, count: 0, durationMs: null,
        result: 'skipped', reason: m.enabled ? null : (m.reason || m.status),
      };
    }

    const allNormalized = [];

    // Tous en parallèle, mais on émet à chaque résolution
    await Promise.all(scrapers.map(async (s) => {
      if (aborted) return;
      send('source-started', { id: s.id, label: s.label });
      const sStart = Date.now();
      try {
        const out = await withTimeout(s.search(criteria), PER_SOURCE_TIMEOUT_MS);
        const items = out.items || [];
        const normalized = items.map((raw) => s.normalize(raw));
        allNormalized.push(...normalized);
        sourceStats[s.id] = {
          ...sourceStats[s.id],
          attempted: true,
          count: normalized.length,
          durationMs: Date.now() - sStart,
          result: out.source === 'live' ? 'live' : out.source,
          reason: null,
        };
        send('source-done', { id: s.id, count: normalized.length, durationMs: Date.now() - sStart, status: out.source });
      } catch (err) {
        sourceStats[s.id] = {
          ...sourceStats[s.id],
          attempted: true,
          count: 0,
          durationMs: Date.now() - sStart,
          result: classifyError(err),
          reason: (err.message || 'unknown').slice(0, 200),
        };
        send('source-error', {
          id: s.id, code: classifyError(err),
          message: (err.message || 'unknown').slice(0, 200),
          durationMs: Date.now() - sStart,
        });
      }
    }));

    if (aborted) return;

    const finalized = finalize(allNormalized, criteria, startedAt, { hit: false, fresh });
    finalized.sourceStats = sourceStats;

    // Persistance Firestore async
    if (firestoreService.isEnabled() && finalized.results.length > 0 && !wantedIds) {
      const hash = computeCriteriaHash(criteria);
      const ids = finalized.listings.map((l) => l.id);
      queueMicrotask(() => {
        firestoreService.upsertListings(finalized.listings)
          .then(() => firestoreService.cacheSearch(hash, criteria, ids, { source: 'live' }))
          .catch(() => {});
      });
    }
    if (firestoreService.isEnabled()) {
      queueMicrotask(() => {
        firestoreService.recordSearch({
          criteria, resultsCount: finalized.total, source: 'live',
          durationMs: finalized.durationMs, fresh,
        }).catch(() => {});
      });
    }

    send('complete', finalized);
    res.end();
  } catch (err) {
    log.error('stream.error', { msg: err.message });
    send('abort', { reason: err.message });
    res.end();
  }
}

function finalize(listings, criteria, startedAt, cacheStatus) {
  const deduped = dedup(listings);
  const enriched = enrichWithImport(deduped);
  listingsCache.putMany(enriched);

  const scored = scoreListings(enriched, criteria);
  const filtered = filterListings(scored, criteria);
  const sorted = sortListings(filtered, criteria.sort);

  return {
    total: sorted.length,
    rawCount: enriched.length,
    durationMs: Date.now() - startedAt,
    cacheStatus,
    estimation: computeEstimate(sorted),
    results: sorted.slice(0, 500),
    listings: enriched,
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
    const e = seen.get(fp);
    if (!e) { seen.set(fp, l); continue; }
    const a = e.meta?.fieldsMissing?.length ?? 99;
    const b = l.meta?.fieldsMissing?.length ?? 99;
    if (b < a) seen.set(fp, l);
    else if (b === a && l.country === 'FR' && e.country !== 'FR') seen.set(fp, l);
  }
  return [...seen.values()];
}
