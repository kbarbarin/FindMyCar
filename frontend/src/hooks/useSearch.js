import { useEffect } from 'react';
import { useSearchStore } from '../store/searchStore.js';

export function useSearch(criteria) {
  const runSearch = useSearchStore((s) => s.runSearch);
  const status = useSearchStore((s) => s.status);
  const results = useSearchStore((s) => s.results);
  const suggestions = useSearchStore((s) => s.suggestions);
  const error = useSearchStore((s) => s.error);
  const partialSources = useSearchStore((s) => s.partialSources);
  const sourceStats = useSearchStore((s) => s.sourceStats);
  const fromBackend = useSearchStore((s) => s.fromBackend);

  useEffect(() => {
    runSearch(criteria);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(criteria)]);

  return { status, results, suggestions, error, partialSources, sourceStats, fromBackend };
}
