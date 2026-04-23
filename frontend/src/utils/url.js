// Sérialisation bidirectionnelle SearchCriteria <-> URLSearchParams.
// L'URL est la source de vérité pour les critères de recherche (deep-linking, back button).

const ARRAY_KEYS = new Set(['fuel', 'transmission', 'countries', 'sources', 'features']);
const NUMBER_KEYS = new Set([
  'yearMin', 'yearMax',
  'mileageMin', 'mileageMax',
  'priceMin', 'priceMax',
  'page', 'pageSize',
]);
const BOOL_KEYS = new Set(['firstHandOnly', 'importFriendly']);

export function criteriaToParams(criteria) {
  const params = new URLSearchParams();
  Object.entries(criteria).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      params.set(key, value.join(','));
    } else if (typeof value === 'boolean') {
      if (value) params.set(key, '1');
    } else {
      params.set(key, String(value));
    }
  });
  return params;
}

export function paramsToCriteria(params) {
  const out = {};
  for (const [key, value] of params.entries()) {
    if (ARRAY_KEYS.has(key)) {
      out[key] = value.split(',').filter(Boolean);
    } else if (NUMBER_KEYS.has(key)) {
      const n = Number(value);
      out[key] = Number.isFinite(n) ? n : null;
    } else if (BOOL_KEYS.has(key)) {
      out[key] = value === '1' || value === 'true';
    } else if (key === 'make' || key === 'model') {
      // Le navigateur peut décoder "+" en espace → "Prius+" arrive ici comme "Prius ".
      // On recompose la forme canonique quand possible.
      out[key] = value.trim().replace(/\s*\+\s*/g, '+');
    } else {
      out[key] = value;
    }
  }

  // Rattrapage : si l'URL a perdu le "+" du modèle (encodage défaillant), on essaie
  // de le reconstruire à partir de la chaîne de recherche brute.
  if (out.model && out.q) {
    const qLower = out.q.toLowerCase();
    const withPlus = `${out.model}+`.toLowerCase();
    if (!out.model.endsWith('+') && qLower.includes(withPlus)) {
      out.model = `${out.model}+`;
    }
  }

  return out;
}
