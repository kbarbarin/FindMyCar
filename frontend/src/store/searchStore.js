import { create } from 'zustand';
import { runAggregatedSearch } from '../services/aggregator/aggregator.js';

export const useSearchStore = create((set) => ({
  status: 'idle', // idle | loading | success | empty | error | partial
  results: [],
  suggestions: [],
  partialSources: [],
  sourceStats: null,
  fromBackend: false,
  error: null,
  lastCriteria: null,

  async runSearch(criteria) {
    const hasAnyCriteria = Object.entries(criteria).some(([k, v]) => {
      if (k === 'page' || k === 'pageSize' || k === 'sort') return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'boolean') return v;
      return v != null && v !== '';
    });
    if (!hasAnyCriteria) {
      set({ status: 'idle', results: [], suggestions: [], partialSources: [], sourceStats: null, error: null });
      return;
    }

    set({ status: 'loading', error: null, lastCriteria: criteria });
    try {
      const out = await runAggregatedSearch(criteria);
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
      });
    } catch (err) {
      console.error('[searchStore] runSearch failed', err);
      set({ status: 'error', error: err.message || 'Erreur inconnue' });
    }
  },

  reset() {
    set({ status: 'idle', results: [], suggestions: [], partialSources: [], sourceStats: null, error: null });
  },
}));
