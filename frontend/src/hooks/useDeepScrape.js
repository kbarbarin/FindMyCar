// Hook qui gere une session de deep scrape via Server-Sent Events.
// Cote backend : GET /api/scrape/deep/stream?make=...&model=...&maxPages=N
//
// State retourne :
//   phase    : 'idle' | 'starting' | 'running' | 'done' | 'error'
//   sources  : Map { id -> { label, country, status, page, count, avgMs, totalDurationMs, error } }
//   totals   : { listings, pagesScanned, sourcesDone }
//   maxPages : N (defini par le backend)
//   error    : string | null
//
// Methode start(criteria, { maxPages, sources }) lance une nouvelle session.
// Methode stop() ferme l'EventSource en cours.

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../config/app.config.js';

const API_URL = import.meta.env.VITE_API_URL || APP_CONFIG.apiUrl || '';

const initialState = () => ({
  phase: 'idle',
  sources: {},
  totals: { listings: 0, pagesScanned: 0, sourcesDone: 0 },
  maxPages: 0,
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  error: null,
});

function buildUrl(criteria, opts) {
  const url = new URL('/api/scrape/deep/stream', API_URL || window.location.origin);
  for (const [k, v] of Object.entries(criteria || {})) {
    if (v == null || v === '') continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  if (opts?.maxPages) url.searchParams.set('maxPages', String(opts.maxPages));
  if (opts?.sources?.length) url.searchParams.set('sources', opts.sources.join(','));
  return url.toString();
}

export function useDeepScrape() {
  const [state, setState] = useState(initialState);
  const evtRef = useRef(null);

  const stop = useCallback(() => {
    if (evtRef.current) {
      evtRef.current.close();
      evtRef.current = null;
    }
    setState((s) => s.phase === 'running' ? { ...s, phase: 'done', finishedAt: Date.now() } : s);
  }, []);

  const start = useCallback((criteria, opts = {}) => {
    if (!API_URL) {
      setState({ ...initialState(), phase: 'error', error: 'backend_not_configured' });
      return;
    }
    if (evtRef.current) evtRef.current.close();

    setState({ ...initialState(), phase: 'starting', startedAt: Date.now() });
    const es = new EventSource(buildUrl(criteria, opts));
    evtRef.current = es;

    es.addEventListener('init', (e) => {
      const d = JSON.parse(e.data);
      const sources = {};
      for (const s of d.sources) {
        sources[s.id] = {
          id: s.id, label: s.label, country: s.country,
          status: 'pending', page: 0, count: 0, pageDurations: [],
          totalDurationMs: 0, error: null, reason: null,
        };
      }
      setState((s) => ({ ...s, phase: 'running', maxPages: d.maxPages, sources }));
    });

    es.addEventListener('source-page-start', (e) => {
      const d = JSON.parse(e.data);
      setState((s) => ({
        ...s,
        sources: {
          ...s.sources,
          [d.id]: { ...(s.sources[d.id] || {}), status: 'running', page: d.page },
        },
      }));
    });

    es.addEventListener('source-page-done', (e) => {
      const d = JSON.parse(e.data);
      setState((s) => {
        const prev = s.sources[d.id] || {};
        const pageDurations = [...(prev.pageDurations || []), d.durationMs];
        return {
          ...s,
          totals: {
            ...s.totals,
            listings: s.totals.listings + (d.count || 0),
            pagesScanned: s.totals.pagesScanned + 1,
          },
          sources: {
            ...s.sources,
            [d.id]: {
              ...prev,
              page: d.page,
              count: d.totalForSource,
              pageDurations,
              status: 'running',
            },
          },
        };
      });
    });

    es.addEventListener('source-page-error', (e) => {
      const d = JSON.parse(e.data);
      setState((s) => ({
        ...s,
        totals: { ...s.totals, pagesScanned: s.totals.pagesScanned + 1 },
        sources: {
          ...s.sources,
          [d.id]: {
            ...(s.sources[d.id] || {}),
            page: d.page,
            error: d.message,
            errorCode: d.code,
          },
        },
      }));
    });

    es.addEventListener('source-done', (e) => {
      const d = JSON.parse(e.data);
      setState((s) => ({
        ...s,
        totals: { ...s.totals, sourcesDone: s.totals.sourcesDone + 1 },
        sources: {
          ...s.sources,
          [d.id]: {
            ...(s.sources[d.id] || {}),
            status: 'done',
            page: d.pagesScanned,
            count: d.totalListings,
            totalDurationMs: d.durationMs,
            reason: d.reason,
          },
        },
      }));
    });

    es.addEventListener('complete', (e) => {
      const d = JSON.parse(e.data);
      setState((s) => ({
        ...s,
        phase: 'done',
        finishedAt: Date.now(),
        durationMs: d.durationMs,
        totals: { ...s.totals, listings: d.totalListings },
      }));
      es.close();
      evtRef.current = null;
    });

    es.addEventListener('abort', (e) => {
      const d = JSON.parse(e.data);
      setState((s) => ({ ...s, phase: 'error', error: d.reason }));
      es.close();
      evtRef.current = null;
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) return;
      setState((s) => s.phase === 'done' ? s : { ...s, phase: 'error', error: 'connection_lost' });
      es.close();
      evtRef.current = null;
    };
  }, []);

  useEffect(() => () => { if (evtRef.current) evtRef.current.close(); }, []);

  return { state, start, stop };
}
