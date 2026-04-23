import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { criteriaToParams, paramsToCriteria } from '../utils/url.js';

// URL = source de vérité pour les critères. Ce hook encapsule la (dé)sérialisation.
export function useCriteriaQuery() {
  const [searchParams, setSearchParams] = useSearchParams();

  const criteria = useMemo(() => paramsToCriteria(searchParams), [searchParams]);

  function setCriteria(next, { replace = false } = {}) {
    const merged = typeof next === 'function' ? next(criteria) : { ...criteria, ...next };
    const params = criteriaToParams(merged);
    setSearchParams(params, { replace });
  }

  return [criteria, setCriteria];
}
