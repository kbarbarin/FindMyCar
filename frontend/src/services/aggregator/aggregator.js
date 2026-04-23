// Orchestrateur : fan-out sur les connecteurs, normalisation, dédup, filtre,
// scoring, suggestions, enrichissement import.
//
// Stratégie :
//   - Si le backend est configuré (VITE_API_URL) ET joignable, on délègue tout
//     au backend (qui fait scraping ou mocks côté serveur).
//   - Sinon : fallback V1 local → générateur procédural dans le navigateur.
//
// Ça permet d'utiliser le site même quand le backend est down, et de ne pas
// tout re-implémenter deux fois : la logique pure reste partagée.

import { getConnectors } from '../sources/registry.js';
import { filterListings, scoreAndSort } from '../search/searchEngine.js';
import { proposeSuggestions } from '../search/suggestionEngine.js';
import { enrichListingsWithImport } from '../import/importInsights.js';
import { fingerprint } from '../../utils/ids.js';
import { apiClient } from '../api/client.js';

let backendStatus = 'unknown'; // unknown | ok | down

export async function runAggregatedSearch(criteria) {
  if (apiClient.isConfigured() && backendStatus !== 'down') {
    try {
      const out = await runViaBackend(criteria);
      backendStatus = 'ok';
      return out;
    } catch (err) {
      console.warn('[aggregator] backend unreachable, fallback local', err?.message);
      backendStatus = 'down';
      // continue avec le fallback local
    }
  }
  return runLocally(criteria);
}

async function runViaBackend(criteria) {
  // On demande une grosse page au backend pour garder la main sur la pagination
  // côté front (déjà implémentée dans ResultsList).
  const payload = await apiClient.search({ ...criteria, page: 1, pageSize: 500 });
  const results = payload.results || [];

  // Le backend renvoie déjà des NormalizedListing scored, filtrés, triés et
  // enrichis import. On régénère juste les suggestions côté front car elles
  // dépendent de tout le corpus normalisé (on pourrait aussi les générer côté
  // backend — à faire en itération suivante).
  const suggestions = proposeSuggestions({
    criteria,
    filteredResults: results,
    allNormalized: results,
  });

  return {
    results,
    suggestions,
    partialSources: payload.partialSources || [],
    sourceStats: payload.sourceStats,
    estimation: payload.estimation,
    fromBackend: true,
  };
}

async function runLocally(criteria) {
  const connectors = getConnectors({ ids: criteria.sources ?? null, countries: null });

  const settled = await Promise.allSettled(
    connectors.map(async (c) => ({ connector: c, raw: await c.fetchListings(criteria) })),
  );

  const partialSources = [];
  const allNormalized = [];

  for (const s of settled) {
    if (s.status === 'rejected') {
      partialSources.push({ id: 'unknown', error: s.reason?.message || 'fetch_failed' });
      continue;
    }
    const { connector, raw } = s.value;
    try {
      allNormalized.push(...raw.map((r) => connector.normalize(r)));
    } catch (err) {
      console.error(`[aggregator] normalize failed for source ${connector.id}`, err);
      partialSources.push({ id: connector.id, error: 'normalize_failed' });
    }
  }

  const dedup = dedupByFingerprint(allNormalized);
  const enriched = enrichListingsWithImport(dedup);
  const filtered = filterListings(enriched, criteria);
  const sorted = scoreAndSort(filtered, criteria);
  const suggestions = proposeSuggestions({
    criteria, filteredResults: sorted, allNormalized: enriched,
  });

  return { results: sorted, suggestions, partialSources, fromBackend: false };
}

function dedupByFingerprint(listings) {
  const byFp = new Map();
  for (const l of listings) {
    const fp = fingerprint(l);
    const existing = byFp.get(fp);
    if (!existing) { byFp.set(fp, l); continue; }
    const a = existing.meta?.fieldsMissing?.length ?? 99;
    const b = l.meta?.fieldsMissing?.length ?? 99;
    if (b < a) byFp.set(fp, l);
    else if (b === a && l.country === 'FR' && existing.country !== 'FR') byFp.set(fp, l);
  }
  return [...byFp.values()];
}
