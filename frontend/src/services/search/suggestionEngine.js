// Génère des SearchSuggestion actionnables selon les critères + résultats actuels.
// Chaque suggestion contient un `patch` à appliquer sur SearchCriteria.

import { APP_CONFIG } from '../../config/app.config.js';
import { FUEL_FAMILIES, FUEL_LABEL } from '../../constants/fuels.js';
import { COUNTRY_LABEL } from '../../constants/countries.js';

export function proposeSuggestions({ criteria, filteredResults, allNormalized }) {
  const suggestions = [];
  const n = filteredResults.length;
  const threshold = APP_CONFIG.search.zeroResultsThreshold;

  // 1) Élargir l'année si trop peu de résultats
  if (n <= threshold && criteria.yearMin != null) {
    const loosenedYear = criteria.yearMin - 2;
    const count = allNormalized.filter((l) => !matchYearBlocking(l, { ...criteria, yearMin: loosenedYear })).length;
    const after = countWithPatch(allNormalized, criteria, { yearMin: loosenedYear });
    if (after > n) {
      suggestions.push({
        id: `expand-year-${loosenedYear}`,
        type: 'expand_year',
        label: `Élargir à ${new Date().getFullYear() - loosenedYear + 1} ans (année min ${loosenedYear})`,
        rationale: `${n} résultat(s) actuel(s), ${after} en élargissant de 2 ans.`,
        impactEstimate: { resultsBefore: n, resultsAfter: after },
        patch: { yearMin: loosenedYear },
      });
    }
  }

  // 2) Élargir les pays — très pertinent pour l'import
  if (n <= threshold) {
    const current = new Set(criteria.countries || []);
    const candidates = ['DE', 'BE', 'NL', 'IT'].filter((c) => !current.has(c));
    for (const c of candidates.slice(0, 2)) {
      const after = countWithPatch(allNormalized, criteria, { countries: [...current, c] });
      if (after > n) {
        suggestions.push({
          id: `expand-country-${c}`,
          type: 'expand_country',
          label: `Inclure le marché ${COUNTRY_LABEL[c]}`,
          rationale: `${after - n} annonce(s) supplémentaire(s) depuis ${COUNTRY_LABEL[c]}.`,
          impactEstimate: { resultsBefore: n, resultsAfter: after },
          patch: { countries: [...current, c], importFriendly: true },
        });
      }
    }
  }

  // 3) Élargir le kilométrage max (ou min)
  if (criteria.mileageMax != null && n <= threshold) {
    const loosened = Math.round(criteria.mileageMax * 1.15);
    const after = countWithPatch(allNormalized, criteria, { mileageMax: loosened });
    if (after > n) {
      suggestions.push({
        id: `expand-mileage-${loosened}`,
        type: 'expand_mileage',
        label: `Accepter jusqu'à ${loosened.toLocaleString('fr-FR')} km`,
        rationale: `+${after - n} annonce(s) en assouplissant de 15 %.`,
        impactEstimate: { resultsBefore: n, resultsAfter: after },
        patch: { mileageMax: loosened },
      });
    }
  }

  // 4) Carburants apparentés (hybride ↔ plugin hybride, essence ↔ diesel si thermique)
  if (criteria.fuel?.length === 1) {
    const current = criteria.fuel[0];
    const family = Object.entries(FUEL_FAMILIES).find(([, arr]) => arr.includes(current));
    if (family) {
      const alternatives = family[1].filter((f) => f !== current);
      for (const alt of alternatives) {
        const after = countWithPatch(allNormalized, criteria, { fuel: [current, alt] });
        if (after > n) {
          suggestions.push({
            id: `alt-fuel-${alt}`,
            type: 'alt_fuel',
            label: `Inclure aussi ${FUEL_LABEL[alt]}`,
            rationale: `Même famille de motorisation, +${after - n} résultat(s).`,
            impactEstimate: { resultsBefore: n, resultsAfter: after },
            patch: { fuel: [current, alt] },
          });
        }
      }
    }
  }

  // 5) Modèles proches (même marque, modèles voisins)
  if (criteria.make && criteria.model && n <= threshold) {
    const alts = findAltModels(allNormalized, criteria);
    for (const alt of alts.slice(0, 2)) {
      suggestions.push({
        id: `alt-model-${alt.model}`,
        type: 'alt_model',
        label: `Élargir au modèle ${alt.model} (${alt.count} annonce(s))`,
        rationale: `Même marque, modèle proche.`,
        impactEstimate: { resultsBefore: n, resultsAfter: n + alt.count },
        patch: { model: null, q: criteria.q?.replace(criteria.model, alt.model) ?? alt.model },
      });
    }
  }

  // 6) Signaler les marchés favorables à l'import si on est en mode FR-only
  if ((criteria.countries?.length ?? 0) === 1 && criteria.countries?.[0] === 'FR' && n > 0) {
    suggestions.push({
      id: 'import-market-hint',
      type: 'import_market',
      label: `Activer le mode import (Allemagne, Belgique)`,
      rationale: `Les mêmes modèles sont souvent plus abordables à l'étranger.`,
      impactEstimate: null,
      patch: { countries: ['FR', 'DE', 'BE'], importFriendly: true },
    });
  }

  return suggestions.slice(0, APP_CONFIG.search.maxSuggestions);
}

function matchYearBlocking(l, criteria) {
  if (l.year == null) return false;
  return criteria.yearMin != null && l.year < criteria.yearMin;
}

// Compte "quick and dirty" : on ré-applique les critères entiers avec le patch.
// Volumes V1 très faibles → largement suffisant. V2 : indexer.
function countWithPatch(allNormalized, criteria, patch) {
  const merged = { ...criteria, ...patch };
  return allNormalized.filter((l) => passes(l, merged)).length;
}

function passes(l, c) {
  if (c.make && l.make && c.make.toLowerCase() !== l.make.toLowerCase()) return false;
  if (c.model && l.model && c.model.toLowerCase() !== l.model.toLowerCase()) return false;
  if (c.yearMin != null && l.year != null && l.year < c.yearMin) return false;
  if (c.yearMax != null && l.year != null && l.year > c.yearMax) return false;
  if (c.mileageMin != null && l.mileageKm != null && l.mileageKm < c.mileageMin) return false;
  if (c.mileageMax != null && l.mileageKm != null && l.mileageKm > c.mileageMax) return false;
  if (c.priceMin != null && l.price?.amount != null && l.price.amount < c.priceMin) return false;
  if (c.priceMax != null && l.price?.amount != null && l.price.amount > c.priceMax) return false;
  if (c.fuel?.length && l.fuel && !c.fuel.includes(l.fuel)) return false;
  if (c.transmission?.length && l.transmission && !c.transmission.includes(l.transmission)) return false;
  if (c.countries?.length && l.country && !c.countries.includes(l.country)) return false;
  return true;
}

function findAltModels(all, criteria) {
  const sameMakeOtherModel = all.filter(
    (l) => l.make && l.make.toLowerCase() === criteria.make.toLowerCase() &&
    l.model && l.model.toLowerCase() !== criteria.model.toLowerCase(),
  );
  const counts = new Map();
  for (const l of sameMakeOtherModel) {
    counts.set(l.model, (counts.get(l.model) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);
}
