import { create } from 'zustand';
import { runAggregatedSearch, runSingleSource } from '../services/aggregator/aggregator.js';

export const useSearchStore = create((set, get) => ({
  status: 'idle', // idle | loading | success | empty | error | partial
  results: [],
  suggestions: [],
  partialSources: [],
  sourceStats: null,
  fromBackend: false,
  rawCount: 0,
  liveCount: 0,
  sourcesAttempted: 0,
  sourcesInCatalog: 0,
  durationMs: null,
  cacheStatus: null, // { hit, ageMinutes, fresh } depuis le backend
  error: null,
  lastCriteria: null,
  triggeringSourceId: null, // id du scraper actuellement en retry manuel

  async runSearch(criteria, { fresh = false } = {}) {
    const hasAnyCriteria = Object.entries(criteria).some(([k, v]) => {
      if (k === 'page' || k === 'pageSize' || k === 'sort') return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'boolean') return v;
      return v != null && v !== '';
    });
    if (!hasAnyCriteria) {
      set({
        status: 'idle', results: [], suggestions: [], partialSources: [],
        sourceStats: null, error: null, cacheStatus: null,
        rawCount: 0, liveCount: 0, sourcesAttempted: 0, sourcesInCatalog: 0, durationMs: null,
      });
      return;
    }

    set({ status: 'loading', error: null, lastCriteria: criteria });
    try {
      const out = await runAggregatedSearch(criteria, { fresh });
      let status = 'success';
      if (out.results.length === 0) status = 'empty';
      else if (out.partialSources?.length > 0) status = 'partial';
      set({
        status,
        results: out.results,
        suggestions: out.suggestions,
        partialSources: out.partialSources ?? [],
        sourceStats: out.sourceStats ?? null,
        fromBackend: Boolean(out.fromBackend),
        rawCount: out.rawCount ?? 0,
        liveCount: out.liveCount ?? 0,
        sourcesAttempted: out.sourcesAttempted ?? 0,
        sourcesInCatalog: out.sourcesInCatalog ?? 0,
        durationMs: out.durationMs ?? null,
        cacheStatus: out.cacheStatus ?? null,
      });
    } catch (err) {
      console.error('[searchStore] runSearch failed', err);
      set({ status: 'error', error: err.message || 'Erreur inconnue' });
    }
  },

  // Force le rescrap : appelle le backend avec fresh=true, bypass le cache Firestore.
  async forceRescrape() {
    const c = get().lastCriteria;
    if (!c) return;
    return get().runSearch(c, { fresh: true });
  },

  // Trigger manuel d'une source unique : merge les nouveaux résultats avec
  // l'agrégat existant et met à jour la ligne sourceStats[sourceId].
  async triggerSource(sourceId) {
    const { lastCriteria, results: existing, sourceStats: existingStats } = get();
    if (!lastCriteria) return;

    set({ triggeringSourceId: sourceId });
    try {
      const payload = await runSingleSource(sourceId, lastCriteria);
      const newResults = payload.results || [];

      // Merge : on enlève les anciens résultats de cette source puis on ajoute les nouveaux.
      const filtered = existing.filter((l) => l.source?.id !== sourceId);
      const merged = [...filtered, ...newResults];

      const nextStats = { ...(existingStats || {}) };
      // Le backend renvoie un sourceStats COMPLET (toutes sources). On extrait
      // juste celle qu'on vient de retrigger.
      if (payload.sourceStats?.[sourceId]) {
        nextStats[sourceId] = payload.sourceStats[sourceId];
      }

      set({
        results: merged,
        sourceStats: nextStats,
        triggeringSourceId: null,
      });
    } catch (err) {
      console.error('[searchStore] triggerSource failed', err);
      set({ triggeringSourceId: null });
    }
  },

  reset() {
    set({
      status: 'idle', results: [], suggestions: [], partialSources: [],
      sourceStats: null, error: null,
    });
  },
}));
