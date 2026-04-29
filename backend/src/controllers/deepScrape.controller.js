// Deep scrape : pagine sur plusieurs pages par source pour ramener bien plus
// d'annonces qu'une recherche standard. Simule une navigation normale via des
// delais aleatoires entre pages, ce qui rend le scrape plus long mais plus
// robuste face aux anti-bots.
//
// Endpoint : GET /api/scrape/deep/stream?make=...&model=...&maxPages=N&sources=a,b
// Format Server-Sent Events :
//   init           { totalSources, sources: [{id,label,country}], maxPages }
//   source-page-start { id, page }
//   source-page-done  { id, page, count, totalForSource, durationMs }
//   source-page-error { id, page, code, message, durationMs }
//   source-done    { id, pagesScanned, totalListings, durationMs, reason }
//   complete       { totalListings, perSource, durationMs }
//   abort          { reason }

import { criteriaFromQuery } from '../models/searchCriteria.model.js';
import { getScrapers } from '../scrapers/registry.js';
import { firestoreService } from '../services/firestore.service.js';
import { listingsCache } from '../services/listings.cache.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ controller: 'deepScrape' });

const PER_PAGE_TIMEOUT_MS = parseInt(process.env.DEEP_SCRAPE_PAGE_TIMEOUT_MS, 10) || 25000;
const DEFAULT_MAX_PAGES = parseInt(process.env.DEEP_SCRAPE_MAX_PAGES, 10) || 20;
const HARD_CAP_PAGES = 100; // garde-fou
// Delai aleatoire entre pages (par source) pour simuler la navigation humaine.
const PAGE_DELAY_MIN_MS = parseInt(process.env.DEEP_SCRAPE_DELAY_MIN_MS, 10) || 1500;
const PAGE_DELAY_MAX_MS = parseInt(process.env.DEEP_SCRAPE_DELAY_MAX_MS, 10) || 3500;

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { const e = new Error('page_timeout'); e.status = 504; reject(e); }, ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function classify(err) {
  const msg = err?.message || '';
  if (msg.includes('no_ads_in_payload') || msg.includes('no_listings_in_dom') ||
      msg.includes('no_listings') || msg.includes('no_cards') || msg === 'empty_results') {
    return 'empty';
  }
  if (err?.status === 403 || msg.includes('blocked_by_antibot')) return 'blocked';
  if (err?.status === 429) return 'rate_limited';
  if (err?.status === 504 || msg === 'page_timeout' || /timeout/i.test(msg)) return 'timeout';
  if (err?.status === 404) return 'not_found';
  if (msg === 'fetch failed') return 'network_error';
  if (msg.startsWith('all_strategies_failed')) return 'parse_failed';
  return 'error';
}

export async function deepScrapeStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
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
    const wantedIds = Array.isArray(criteria.sources) && criteria.sources.length ? criteria.sources : null;
    const requestedMax = parseInt(req.query.maxPages, 10) || DEFAULT_MAX_PAGES;
    const maxPages = Math.max(1, Math.min(HARD_CAP_PAGES, requestedMax));

    const scrapers = getScrapers({ ids: wantedIds });
    if (!scrapers.length) {
      send('abort', { reason: 'no_sources_selected' });
      return res.end();
    }

    send('init', {
      totalSources: scrapers.length,
      maxPages,
      sources: scrapers.map((s) => ({ id: s.id, label: s.label, country: s.country })),
    });

    const perSourceTotals = {};
    const allListings = [];

    // Toutes les sources en parallele, mais a l'interieur de chaque source on
    // pagine sequentiellement (pas le droit de marteler 1 site).
    await Promise.all(scrapers.map(async (s) => {
      if (aborted) return;
      const sourceStart = Date.now();
      let pagesScanned = 0;
      let consecutiveEmpty = 0;
      let consecutiveErrors = 0;
      let totalForSource = 0;
      const seenIds = new Set();
      let stopReason = 'completed';

      for (let page = 1; page <= maxPages; page++) {
        if (aborted) { stopReason = 'aborted'; break; }

        send('source-page-start', { id: s.id, page });
        const pageStart = Date.now();

        try {
          const items = await withTimeout(s.searchLive({ ...criteria, page }), PER_PAGE_TIMEOUT_MS);
          const durationMs = Date.now() - pageStart;
          const list = Array.isArray(items) ? items : [];

          if (list.length === 0) {
            consecutiveEmpty++;
            send('source-page-done', { id: s.id, page, count: 0, totalForSource, durationMs });
            if (consecutiveEmpty >= 2) { stopReason = 'no_more_results'; break; }
          } else {
            consecutiveEmpty = 0;
            consecutiveErrors = 0;
            // Normalise et deduplique localement par id de listing
            const normalized = list.map((raw) => {
              try { return s.normalize(raw); } catch { return null; }
            }).filter(Boolean).filter((l) => {
              if (!l.id) return false;
              if (seenIds.has(l.id)) return false;
              seenIds.add(l.id);
              return true;
            });

            totalForSource += normalized.length;
            allListings.push(...normalized);
            listingsCache.putMany(normalized);

            // Persistance Firestore par chunks (ne bloque pas le stream)
            if (firestoreService.isEnabled() && normalized.length) {
              queueMicrotask(() => {
                firestoreService.upsertListings(normalized).catch(() => {});
              });
            }

            send('source-page-done', { id: s.id, page, count: normalized.length, totalForSource, durationMs });
          }
          pagesScanned = page;
        } catch (err) {
          const durationMs = Date.now() - pageStart;
          const code = classify(err);
          send('source-page-error', {
            id: s.id, page, code,
            message: (err.message || 'unknown').slice(0, 200),
            durationMs,
          });
          if (code === 'empty') {
            consecutiveEmpty++;
            if (consecutiveEmpty >= 2) { stopReason = 'no_more_results'; break; }
          } else if (code === 'blocked' || code === 'rate_limited') {
            stopReason = code;
            break;
          } else {
            consecutiveErrors++;
            if (consecutiveErrors >= 3) { stopReason = 'too_many_errors'; break; }
          }
          pagesScanned = page;
        }

        // Delai humain avant la page suivante (sauf si c'est la derniere)
        if (page < maxPages && !aborted) {
          await sleep(rand(PAGE_DELAY_MIN_MS, PAGE_DELAY_MAX_MS));
        }
      }

      perSourceTotals[s.id] = { pagesScanned, totalListings: totalForSource, reason: stopReason };
      send('source-done', {
        id: s.id, pagesScanned, totalListings: totalForSource,
        durationMs: Date.now() - sourceStart, reason: stopReason,
      });
    }));

    if (aborted) return;

    // Recap final
    send('complete', {
      totalListings: allListings.length,
      perSource: perSourceTotals,
      durationMs: Date.now() - startedAt,
    });
    res.end();

    // Log audit
    if (firestoreService.isEnabled()) {
      queueMicrotask(() => {
        firestoreService.recordSearch({
          criteria, resultsCount: allListings.length,
          source: 'deep_scrape', durationMs: Date.now() - startedAt,
          fresh: true,
        }).catch(() => {});
      });
    }
  } catch (err) {
    log.error('deepScrape.fatal', { msg: err.message });
    send('abort', { reason: err.message });
    res.end();
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
