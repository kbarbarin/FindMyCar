// Score de pertinence d'une annonce vs. critères.
// Pondérations simples, lisibles. Ajustables sans changer l'API.

const WEIGHTS = {
  exactMakeModel: 40,
  fuelMatch: 15,
  transmissionMatch: 8,
  inYearRange: 15,
  inMileageRange: 10,
  inPriceRange: 10,
  featuresCoverage: 12,    // max si toutes les features demandées sont présentes
  firstHandBonus: 5,
  accidentFreeBonus: 4,
  recentPostingBonus: 5,   // annonce < 7 jours
  fieldsCompletenessBonus: 6, // pénalise les annonces pleines de nulls
};

export function scoreListing(listing, criteria) {
  let score = 0;

  if (criteria.make && listing.make && criteria.make.toLowerCase() === listing.make.toLowerCase()) {
    score += WEIGHTS.exactMakeModel * 0.5;
    if (criteria.model && listing.model && criteria.model.toLowerCase() === listing.model.toLowerCase()) {
      score += WEIGHTS.exactMakeModel * 0.5;
    }
  }

  if (criteria.fuel?.length && listing.fuel && criteria.fuel.includes(listing.fuel)) score += WEIGHTS.fuelMatch;
  if (criteria.transmission?.length && listing.transmission && criteria.transmission.includes(listing.transmission)) {
    score += WEIGHTS.transmissionMatch;
  }

  if (listing.year) {
    if ((criteria.yearMin == null || listing.year >= criteria.yearMin) &&
        (criteria.yearMax == null || listing.year <= criteria.yearMax)) {
      score += WEIGHTS.inYearRange;
    }
  }

  if (listing.mileageKm != null) {
    if ((criteria.mileageMin == null || listing.mileageKm >= criteria.mileageMin) &&
        (criteria.mileageMax == null || listing.mileageKm <= criteria.mileageMax)) {
      score += WEIGHTS.inMileageRange;
    }
  }

  if (listing.price?.amount != null) {
    if ((criteria.priceMin == null || listing.price.amount >= criteria.priceMin) &&
        (criteria.priceMax == null || listing.price.amount <= criteria.priceMax)) {
      score += WEIGHTS.inPriceRange;
    }
  }

  if (criteria.features?.length) {
    const listingSet = new Set(listing.features || []);
    const matched = criteria.features.filter((f) => listingSet.has(f)).length;
    score += (matched / criteria.features.length) * WEIGHTS.featuresCoverage;
  }

  if (criteria.firstHandOnly && listing.history?.firstHand === true) score += WEIGHTS.firstHandBonus;
  if (listing.history?.accidentFree === true) score += WEIGHTS.accidentFreeBonus;

  if (listing.postedAt) {
    const ageDays = (Date.now() - new Date(listing.postedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) score += WEIGHTS.recentPostingBonus;
  }

  // Pénalité douce si beaucoup de champs manquants.
  const missing = listing.meta?.fieldsMissing?.length ?? 0;
  if (missing < 4) score += WEIGHTS.fieldsCompletenessBonus;

  return Math.round(score * 100) / 100;
}
