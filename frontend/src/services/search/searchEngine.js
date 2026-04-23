// Moteur pur : filter + score + sort. Aucun I/O. Entièrement testable.

import { inRange, isNonEmpty } from '../../utils/ranges.js';
import { scoreListing } from './scoring.js';
import { normalizeMake, normalizeModel } from '../normalization/taxonomy.js';

// Mots de structure qu'on ignore dans le matching texte — ils viennent du langage
// naturel ("moins de 10 ans") et ne sont jamais dans les titres d'annonce.
const TEXT_STOPWORDS = new Set([
  'de', 'des', 'du', 'le', 'la', 'les', 'un', 'une', 'et', 'ou',
  'moins', 'plus', 'ans', 'an', 'km', 'kms', 'avec', 'sans', 'que',
  'budget', 'max', 'min', 'entre',
]);

export function filterListings(listings, criteria) {
  // Normalisation défensive des critères venant de l'URL (le navigateur peut décoder
  // "%2B" en espace → "Prius+" devient "Prius "). On recanonicalise ici pour être
  // robuste à ces cas de bord.
  const normalizedMake = criteria.make ? normalizeMake(criteria.make) : null;
  const normalizedModel = criteria.model ? normalizeModel(criteria.model) : null;

  // Dès qu'un critère structuré a été extrait, on considère que le texte brut a
  // déjà servi et on N'APPLIQUE PAS de filtre plein-texte sur le titre.
  const hasStructured = Boolean(
    normalizedMake || normalizedModel ||
    criteria.yearMin != null || criteria.yearMax != null ||
    criteria.mileageMin != null || criteria.mileageMax != null ||
    criteria.priceMin != null || criteria.priceMax != null ||
    (criteria.fuel && criteria.fuel.length) ||
    (criteria.transmission && criteria.transmission.length) ||
    (criteria.countries && criteria.countries.length) ||
    (criteria.features && criteria.features.length) ||
    criteria.firstHandOnly,
  );

  return listings.filter((l) => {
    if (normalizedMake && l.make && !equalsLoose(l.make, normalizedMake)) return false;
    if (normalizedModel && l.model && !equalsLoose(l.model, normalizedModel)) return false;

    if (criteria.q && !hasStructured && !matchText(l, criteria.q)) return false;

    // Plages numériques
    if (!inRange(l.year, criteria.yearMin, criteria.yearMax)) {
      if (l.year != null) return false;
    }
    if (!inRange(l.mileageKm, criteria.mileageMin, criteria.mileageMax)) {
      if (l.mileageKm != null) return false;
    }
    if (!inRange(l.price?.amount, criteria.priceMin, criteria.priceMax)) {
      if (l.price?.amount != null) return false;
    }

    if (isNonEmpty(criteria.fuel) && l.fuel && !criteria.fuel.includes(l.fuel)) return false;
    if (isNonEmpty(criteria.transmission) && l.transmission && !criteria.transmission.includes(l.transmission)) return false;
    if (isNonEmpty(criteria.countries) && l.country && !criteria.countries.includes(l.country)) return false;
    if (isNonEmpty(criteria.sources) && !criteria.sources.includes(l.source?.id)) return false;

    if (isNonEmpty(criteria.features)) {
      const set = new Set(l.features || []);
      if (!criteria.features.every((f) => set.has(f))) return false;
    }

    if (criteria.firstHandOnly && l.history?.firstHand !== true) return false;

    return true;
  });
}

function equalsLoose(a, b) {
  const normA = normalizeModel(String(a));
  const normB = normalizeModel(String(b));
  return normA.toLowerCase() === normB.toLowerCase();
}

function matchText(listing, q) {
  if (!q) return true;
  // Tokens pertinents uniquement : on retire les stopwords et les nombres purs
  // (qui viennent souvent des bornes "10 ans", "200 000 km" et pas du titre).
  const tokens = q.toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1 && !TEXT_STOPWORDS.has(t) && !/^\d+$/.test(t));
  if (tokens.length === 0) return true;
  const hay = [listing.title, listing.make, listing.model, listing.version]
    .filter(Boolean).join(' ').toLowerCase();
  // Au moins un token significatif doit matcher.
  return tokens.some((t) => hay.includes(t));
}

export function scoreAndSort(listings, criteria) {
  const scored = listings.map((l) => ({ ...l, rawScore: scoreListing(l, criteria) }));
  const sort = criteria.sort || 'relevance';
  const sorters = {
    relevance: (a, b) => b.rawScore - a.rawScore,
    price_asc: (a, b) => (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity),
    price_desc: (a, b) => (b.price?.amount ?? -Infinity) - (a.price?.amount ?? -Infinity),
    year_desc: (a, b) => (b.year ?? 0) - (a.year ?? 0),
    mileage_asc: (a, b) => (a.mileageKm ?? Infinity) - (b.mileageKm ?? Infinity),
    posted_desc: (a, b) => (new Date(b.postedAt ?? 0)) - (new Date(a.postedAt ?? 0)),
  };
  return scored.sort(sorters[sort] || sorters.relevance);
}
