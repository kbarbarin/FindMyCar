// Consomme /api/search/stream via EventSource ET alimente le searchStore au fur
// et à mesure. C'est la SEULE source de vérité pour les recherches — pas de
// double fetch en parallèle vers /api/search.
//
// State retourné (pour l'UI live de la progress bar) :
//   phase  : 'idle' | 'cache_check' | 'scraping' | 'done' | 'error'
//   sources: { [id]: { label, country, status, count, durationMs } }
//   totalDone, totalAnnonces, cacheHit, error
//
// Le store (useSearchStore) est mis à jour quand la recherche se termine pour
// que les autres composants (résultats, panneau état des sources, suggestions…)
// puissent le lire comme avant.

import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../config/app.config.js';
import { useSearchStore } from '../store/searchStore.js';
import { proposeSuggestions } from '../services/search/suggestionEngine.js';

const API_URL = import.meta.env.VITE_API_URL || APP_CONFIG.apiUrl || '';

function buildUrl(criteria) {
  const url = new URL('/api/search/stream', API_URL || window.location.origin);
  for (const [k, v] of Object.entries(criteria || {})) {
    if (v == null || v === '') continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return url.toString();
}

const initial = () => ({
  phase: 'idle',
  sources: {},
  totalSources: 0,
  totalDone: 0,
  totalAnnonces: 0,
  cacheHit: null,
  error: null,
});

export function useStreamingSearch(criteria, { enabled = true } = {}) {
  const [state, setState] = useState(initial);
  const evtRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    if (!hasAnyCriteria(criteria)) {
      setState(initial());
      useSearchStore.setState({
        status: 'idle', results: [], suggestions: [],
        sourceStats: null, partialSources: [], cacheStatus: null,
        rawCount: 0, liveCount: 0, sourcesAttempted: 0, sourcesInCatalog: 0,
        durationMs: null, error: null,
      });
      return;
    }
    if (!API_URL) {
      setState({ ...initial(), phase: 'error', error: 'backend_not_configured' });
      useSearchStore.setState({ status: 'error', error: 'backend_not_configured' });
      return;
    }

    evtRef.current?.close();
    setState({ ...initial(), phase: 'cache_check' });
    useSearchStore.setState({ status: 'loading', error: null, lastCriteria: criteria });

    const es = new EventSource(buildUrl(criteria));
    evtRef.current = es;

    es.addEventListener('cache-hit', (e) => {
      const d = JSON.parse(e.data);
      setState((s) => ({ ...s, cacheHit: d, phase: 'cache_check' }));
    });

    es.addEventListener('start', (e) => {
      const d = JSON.parse(e.data);
      const sources = {};
      for (const x of d.sources) {
        sources[x.id] = { label: x.label, country: x.country, status: 'pending', count: 0, durationMs: null };
      }
      setState((s) => ({ ...s, phase: 'scraping', totalSources: d.totalSources, sources }));
    });

    es.addEventListener('source-started', (e) => {
      const d = JSON.parse(e.data);
      setState((s) => ({
        ...s,
        sources: { ...s.sources, [d.id]: { ...(s.sources[d.id] || {}), status: 'running' } },
      }));
    });

    es.addEventListener('source-done', (e) => {
      const d = JSON.parse(e.data);
      setState((s) => ({
        ...s,
        totalDone: s.totalDone + 1,
        totalAnnonces: s.totalAnnonces + (d.count || 0),
        sources: {
          ...s.sources,
          [d.id]: { ...(s.sources[d.id] || {}), status: 'done', count: d.count, durationMs: d.durationMs },
        },
      }));
    });

    es.addEventListener('source-error', (e) => {
      const d = JSON.parse(e.data);
      setState((s) => ({
        ...s,
        totalDone: s.totalDone + 1,
        sources: {
          ...s.sources,
          [d.id]: { ...(s.sources[d.id] || {}), status: 'error', error: d.code, message: d.message, durationMs: d.durationMs },
        },
      }));
    });

    es.addEventListener('complete', (e) => {
      const d = JSON.parse(e.data);
      const results = d.results || [];
      setState((s) => ({ ...s, phase: 'done' }));

      // Alimente le store : c'est ce que les autres composants (ResultsList,
      // SourceStatusPanel, CacheStatusBar, suggestions) lisent.
      const suggestions = proposeSuggestions({
        criteria, filteredResults: results, allNormalized: results,
      });
      const sourceStats = d.sourceStats || {};
      const liveCount = Object.values(sourceStats).filter((s) => s.result === 'live').length;
      const partialSources = Object.entries(sourceStats)
        .filter(([, s]) => s.attempted && s.result !== 'live')
        .map(([id, s]) => ({ id, error: s.reason, code: s.result }));

      useSearchStore.setState({
        status: results.length === 0 ? 'empty' : (partialSources.length ? 'partial' : 'success'),
        results,
        suggestions,
        partialSources,
        sourceStats,
        fromBackend: true,
        rawCount: d.rawCount ?? results.length,
        liveCount,
        sourcesAttempted: Object.values(sourceStats).filter((s) => s.attempted).length,
        sourcesInCatalog: Object.keys(sourceStats).length,
        durationMs: d.durationMs ?? null,
        cacheStatus: d.cacheStatus ?? null,
      });

      es.close();
    });

    es.addEventListener('abort', (e) => {
      const d = JSON.parse(e.data);
      setState((s) => ({ ...s, phase: 'error', error: d.reason }));
      useSearchStore.setState({ status: 'error', error: d.reason });
      es.close();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) return;
      setState((s) => s.phase === 'done' ? s : { ...s, phase: 'error', error: 'connection_lost' });
      useSearchStore.setState((curr) => curr.status === 'success'
        ? curr
        : { ...curr, status: 'error', error: 'connection_lost' });
      es.close();
    };

    return () => { es.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(criteria), enabled]);

  return state;
}

function hasAnyCriteria(c) {
  return Object.entries(c || {}).some(([k, v]) => {
    if (k === 'page' || k === 'pageSize' || k === 'sort') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'boolean') return v;
    return v != null && v !== '';
  });
}
