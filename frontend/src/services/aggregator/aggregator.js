// Orchestrateur côté client : délègue 100% au backend, pas de fallback mock.
// Si le backend est down, on remonte l'erreur — on n'invente pas de données.

import { proposeSuggestions } from '../search/suggestionEngine.js';
import { apiClient } from '../api/client.js';

export async function runAggregatedSearch(criteria, { fresh = false } = {}) {
  if (!apiClient.isConfigured()) {
    throw new Error('backend_not_configured');
  }
  const payload = await apiClient.search({ ...criteria, fresh, page: 1, pageSize: 500 });
  const results = payload.results || [];

  const suggestions = proposeSuggestions({
    criteria,
    filteredResults: results,
    allNormalized: results,
  });

  return {
    results,
    suggestions,
    partialSources: payload.partialSources || [],
    sourceStats: payload.sourceStats || {},
    estimation: payload.estimation,
    rawCount: payload.rawCount ?? results.length,
    liveCount: payload.liveCount ?? 0,
    sourcesAttempted: payload.sourcesAttempted ?? 0,
    sourcesInCatalog: payload.sourcesInCatalog ?? 0,
    durationMs: payload.durationMs ?? null,
    cacheStatus: payload.cacheStatus ?? null,
    fromBackend: true,
  };
}

// Trigger explicite d'UNE seule source (bouton "Réessayer" dans le panel).
// Le backend respecte les ids même si la source est désactivée par défaut.
export async function runSingleSource(sourceId, criteria) {
  if (!apiClient.isConfigured()) throw new Error('backend_not_configured');
  return apiClient.search({ ...criteria, sources: [sourceId], page: 1, pageSize: 200 });
}
