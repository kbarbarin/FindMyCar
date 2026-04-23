// Filtre + scoring pur. Équivalent du searchEngine frontend,
// appliqué APRÈS normalisation côté serveur.

import { normalizeMake, normalizeModel } from '../normalizers/taxonomy.js';

const inRange = (v, min, max) => {
  if (v == null) return true; // null = pas de contrainte bloquante (cf. filter)
  if (min != null && v < min) return false;
  if (max != null && v > max) return false;
  return true;
};

export function filterListings(listings, c) {
  const make = c.make ? normalizeMake(c.make) : null;
  const model = c.model ? normalizeModel(c.model) : null;

  return listings.filter((l) => {
    if (make && l.make && l.make.toLowerCase() !== make.toLowerCase()) return false;
    if (model && l.model && l.model.toLowerCase() !== model.toLowerCase()) return false;
    if (c.yearMin != null && l.year != null && l.year < c.yearMin) return false;
    if (c.yearMax != null && l.year != null && l.year > c.yearMax) return false;
    if (c.mileageMin != null && l.mileageKm != null && l.mileageKm < c.mileageMin) return false;
    if (c.mileageMax != null && l.mileageKm != null && l.mileageKm > c.mileageMax) return false;
    if (c.priceMin != null && l.price?.amount != null && l.price.amount < c.priceMin) return false;
    if (c.priceMax != null && l.price?.amount != null && l.price.amount > c.priceMax) return false;
    if (c.fuel?.length && l.fuel && !c.fuel.includes(l.fuel)) return false;
    if (c.transmission?.length && l.transmission && !c.transmission.includes(l.transmission)) return false;
    if (c.countries?.length && l.country && !c.countries.includes(l.country)) return false;
    if (c.sources?.length && !c.sources.includes(l.source?.id)) return false;
    if (c.firstHandOnly && l.history?.firstHand !== true) return false;
    return true;
  });
}

const SORTERS = {
  relevance:    (a, b) => (b.rawScore ?? 0) - (a.rawScore ?? 0),
  price_asc:    (a, b) => (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity),
  price_desc:   (a, b) => (b.price?.amount ?? -Infinity) - (a.price?.amount ?? -Infinity),
  year_desc:    (a, b) => (b.year ?? 0) - (a.year ?? 0),
  mileage_asc:  (a, b) => (a.mileageKm ?? Infinity) - (b.mileageKm ?? Infinity),
  posted_desc:  (a, b) => new Date(b.postedAt ?? 0) - new Date(a.postedAt ?? 0),
};

export function sortListings(listings, sort = 'relevance') {
  return [...listings].sort(SORTERS[sort] || SORTERS.relevance);
}

// Score de pertinence simple (peut être raffiné sans changer l'API).
export function scoreListings(listings, criteria) {
  return listings.map((l) => {
    let s = 0;
    if (criteria.make && l.make?.toLowerCase() === criteria.make.toLowerCase()) s += 30;
    if (criteria.model && l.model?.toLowerCase() === criteria.model.toLowerCase()) s += 30;
    if (criteria.fuel?.length && criteria.fuel.includes(l.fuel)) s += 10;
    if (l.history?.accidentFree === true) s += 5;
    if (l.history?.firstHand === true) s += 3;
    if (l.meta?.fieldsMissing?.length === 0) s += 4;
    return { ...l, rawScore: s };
  });
}
